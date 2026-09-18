import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

function json(value) {
  return JSON.stringify(value ?? []);
}

function parseIssue(row) {
  return row ? {
    id: row.id,
    title: row.title,
    summary: row.summary,
    topics: JSON.parse(row.topics || '[]'),
    status: row.status,
    confidence: row.confidence,
    urgency: row.urgency,
    requiresOfficialSource: Boolean(row.requires_official_source),
    firstSeen: row.first_seen,
    lastSeen: row.last_seen,
    resolvedAt: row.resolved_at,
    representativeJumpUrl: row.representative_jump_url,
  } : null;
}

function parseSource(row) {
  return row ? {
    id: row.id,
    title: row.title,
    content: row.content,
    sourceUrl: row.source_url,
    validUntil: row.valid_until,
    createdAt: row.created_at,
  } : null;
}

function ftsQuery(query) {
  const terms = query.toLowerCase().match(/[\p{L}\p{N}_-]+/gu) || [];
  return terms.map(term => `"${term.replaceAll('"', '""')}"`).join(' OR ');
}

export function openDatabase(filePath) {
  if (filePath !== ':memory:') mkdirSync(path.dirname(path.resolve(filePath)), { recursive: true });
  const sqlite = new DatabaseSync(filePath);
  sqlite.exec(`
    PRAGMA foreign_keys = ON;
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY, guild_id TEXT, channel_id TEXT, thread_id TEXT,
      author_id TEXT NOT NULL, author_roles TEXT NOT NULL DEFAULT '[]',
      is_bot INTEGER NOT NULL, content TEXT NOT NULL, reply_to TEXT,
      jump_url TEXT, created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS questions (
      id TEXT PRIMARY KEY, message_id TEXT NOT NULL REFERENCES messages(id),
      author_id TEXT NOT NULL, text TEXT NOT NULL, topics TEXT NOT NULL,
      confidence REAL NOT NULL, urgency TEXT NOT NULL DEFAULT 'normal',
      requires_official_source INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS issues (
      id TEXT PRIMARY KEY, title TEXT NOT NULL, summary TEXT NOT NULL,
      topics TEXT NOT NULL, status TEXT NOT NULL, confidence REAL NOT NULL,
      urgency TEXT NOT NULL DEFAULT 'normal', requires_official_source INTEGER NOT NULL DEFAULT 0,
      first_seen TEXT NOT NULL, last_seen TEXT NOT NULL, resolved_at TEXT,
      representative_jump_url TEXT
    );
    CREATE TABLE IF NOT EXISTS issue_questions (
      issue_id TEXT NOT NULL REFERENCES issues(id), question_id TEXT NOT NULL REFERENCES questions(id),
      PRIMARY KEY (issue_id, question_id)
    );
    CREATE TABLE IF NOT EXISTS official_sources (
      id TEXT PRIMARY KEY, title TEXT NOT NULL, content TEXT NOT NULL,
      source_url TEXT, valid_until TEXT, created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS issue_sources (
      issue_id TEXT NOT NULL REFERENCES issues(id),
      source_id TEXT NOT NULL REFERENCES official_sources(id),
      confidence REAL NOT NULL,
      PRIMARY KEY (issue_id, source_id)
    );
    CREATE TABLE IF NOT EXISTS issue_answers (
      id TEXT PRIMARY KEY, issue_id TEXT NOT NULL, title TEXT NOT NULL,
      content TEXT NOT NULL, source_url TEXT, created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS llm_cache (
      cache_key TEXT PRIMARY KEY, response_json TEXT NOT NULL, created_at TEXT NOT NULL
    );
    CREATE VIRTUAL TABLE IF NOT EXISTS issue_search USING fts5(issue_id UNINDEXED, title, summary, topics);
    CREATE VIRTUAL TABLE IF NOT EXISTS official_source_search USING fts5(source_id UNINDEXED, title, content);
    CREATE VIRTUAL TABLE IF NOT EXISTS issue_answer_search USING fts5(answer_id UNINDEXED, title, content);
  `);

  const insertMessageStatement = sqlite.prepare(`
    INSERT OR IGNORE INTO messages
      (id, guild_id, channel_id, thread_id, author_id, author_roles, is_bot, content, reply_to, jump_url, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertQuestionStatement = sqlite.prepare(`
    INSERT INTO questions
      (id, message_id, author_id, text, topics, confidence, urgency, requires_official_source, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const upsertIssueStatement = sqlite.prepare(`
    INSERT INTO issues
      (id, title, summary, topics, status, confidence, urgency, requires_official_source, first_seen, last_seen, representative_jump_url)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      title=excluded.title, summary=excluded.summary, topics=excluded.topics,
      status=excluded.status, confidence=excluded.confidence, urgency=excluded.urgency,
      requires_official_source=excluded.requires_official_source,
      last_seen=excluded.last_seen,
      representative_jump_url=COALESCE(excluded.representative_jump_url, issues.representative_jump_url)
  `);

  return {
    insertMessage(message) {
      return insertMessageStatement.run(
        message.id, message.guildId || '', message.channelId || '', message.threadId || '',
        message.authorId, json(message.authorRoles), message.isBot ? 1 : 0, message.content,
        message.replyTo || null, message.jumpUrl || null, message.createdAt,
      ).changes === 1;
    },
    insertQuestion(question) {
      insertQuestionStatement.run(
        question.id, question.messageId, question.authorId, question.text, json(question.topics),
        question.confidence, question.urgency || 'normal', question.requiresOfficialSource ? 1 : 0,
        question.createdAt,
      );
    },
    countQuestions() {
      return sqlite.prepare('SELECT COUNT(*) AS count FROM questions').get().count;
    },
    createIssue(issue) {
      upsertIssueStatement.run(
        issue.id, issue.title, issue.summary, json(issue.topics), issue.status,
        issue.confidence, issue.urgency || 'normal', issue.requiresOfficialSource ? 1 : 0,
        issue.firstSeen, issue.lastSeen, issue.representativeJumpUrl || null,
      );
      sqlite.prepare('DELETE FROM issue_search WHERE issue_id = ?').run(issue.id);
      sqlite.prepare('INSERT INTO issue_search (issue_id, title, summary, topics) VALUES (?, ?, ?, ?)')
        .run(issue.id, issue.title, issue.summary, (issue.topics || []).join(' '));
      return this.getIssue(issue.id);
    },
    getIssue(id) {
      return parseIssue(sqlite.prepare('SELECT * FROM issues WHERE id = ?').get(id));
    },
    searchIssues(query, limit = 10) {
      const match = ftsQuery(query);
      if (!match) return [];
      return sqlite.prepare(`
        SELECT issues.* FROM issue_search JOIN issues ON issues.id = issue_search.issue_id
        WHERE issue_search MATCH ? ORDER BY bm25(issue_search) LIMIT ?
      `).all(match, limit).map(parseIssue);
    },
    linkQuestion(issueId, questionId) {
      sqlite.prepare('INSERT OR IGNORE INTO issue_questions (issue_id, question_id) VALUES (?, ?)').run(issueId, questionId);
    },
    findIssuesByMessage(messageId) {
      return sqlite.prepare(`
        SELECT DISTINCT i.* FROM issues i
        JOIN issue_questions iq ON iq.issue_id = i.id
        JOIN questions q ON q.id = iq.question_id
        WHERE q.message_id = ?
      `).all(messageId).map(parseIssue);
    },
    updateIssueStatus(id, status, now = new Date().toISOString()) {
      if (!['OPEN', 'DISCUSSING', 'RESOLVED', 'NEEDS_REVIEW'].includes(status)) throw new Error(`Invalid issue status: ${status}`);
      const result = sqlite.prepare(`
        UPDATE issues SET status = ?, resolved_at = ? WHERE id = ?
      `).run(status, status === 'RESOLVED' ? now : null, id);
      if (!result.changes) throw new Error(`Issue not found: ${id}`);
      return this.getIssue(id);
    },
    mergeIssues(sourceId, targetId) {
      if (sourceId === targetId) throw new Error('Cannot merge an issue into itself');
      const source = this.getIssue(sourceId);
      const target = this.getIssue(targetId);
      if (!source || !target) throw new Error('Source or target issue not found');
      sqlite.exec('BEGIN');
      try {
        sqlite.prepare('INSERT OR IGNORE INTO issue_questions SELECT ?, question_id FROM issue_questions WHERE issue_id = ?').run(targetId, sourceId);
        sqlite.prepare('DELETE FROM issue_questions WHERE issue_id = ?').run(sourceId);
        sqlite.prepare('INSERT OR IGNORE INTO issue_sources SELECT ?, source_id, confidence FROM issue_sources WHERE issue_id = ?').run(targetId, sourceId);
        sqlite.prepare('DELETE FROM issue_sources WHERE issue_id = ?').run(sourceId);
        sqlite.prepare('UPDATE issue_answers SET issue_id = ? WHERE issue_id = ?').run(targetId, sourceId);
        sqlite.prepare('DELETE FROM issues WHERE id = ?').run(sourceId);
        sqlite.prepare('DELETE FROM issue_search WHERE issue_id = ?').run(sourceId);
        this.createIssue({
          ...target,
          topics: [...new Set([...target.topics, ...source.topics])],
          lastSeen: new Date(target.lastSeen) > new Date(source.lastSeen) ? target.lastSeen : source.lastSeen,
          requiresOfficialSource: target.requiresOfficialSource || source.requiresOfficialSource,
          representativeJumpUrl: target.representativeJumpUrl || source.representativeJumpUrl,
        });
        sqlite.exec('COMMIT');
      } catch (error) {
        sqlite.exec('ROLLBACK');
        throw error;
      }
      return this.getIssue(targetId);
    },
    addOfficialSource(source) {
      sqlite.prepare(`
        INSERT INTO official_sources (id, title, content, source_url, valid_until, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET title=excluded.title, content=excluded.content,
          source_url=excluded.source_url, valid_until=excluded.valid_until, created_at=excluded.created_at
      `).run(source.id, source.title, source.content, source.sourceUrl || null, source.validUntil || null, source.createdAt);
      sqlite.prepare('DELETE FROM official_source_search WHERE source_id = ?').run(source.id);
      sqlite.prepare('INSERT INTO official_source_search (source_id, title, content) VALUES (?, ?, ?)')
        .run(source.id, source.title, source.content);
      return parseSource(sqlite.prepare('SELECT * FROM official_sources WHERE id = ?').get(source.id));
    },
    searchOfficialSources(query, limit = 5) {
      const match = ftsQuery(query);
      if (!match) return [];
      return sqlite.prepare(`
        SELECT s.* FROM official_source_search f
        JOIN official_sources s ON s.id = f.source_id
        WHERE official_source_search MATCH ?
        ORDER BY bm25(official_source_search), s.created_at DESC LIMIT ?
      `).all(match, limit).map(parseSource);
    },
    addIssueAnswer(answer) {
      sqlite.prepare(`
        INSERT INTO issue_answers (id, issue_id, title, content, source_url, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET issue_id=excluded.issue_id, title=excluded.title,
          content=excluded.content, source_url=excluded.source_url, created_at=excluded.created_at
      `).run(answer.id, answer.issueId, answer.title, answer.content, answer.sourceUrl || null, answer.createdAt);
      sqlite.prepare('DELETE FROM issue_answer_search WHERE answer_id = ?').run(answer.id);
      sqlite.prepare('INSERT INTO issue_answer_search (answer_id, title, content) VALUES (?, ?, ?)')
        .run(answer.id, answer.title, answer.content);
      return answer;
    },
    searchKnowledge(query, limit = 6) {
      const match = ftsQuery(query);
      if (!match) return [];
      const official = this.searchOfficialSources(query, limit).map(source => ({ ...source, kind: 'official' }));
      const answers = sqlite.prepare(`
        SELECT a.* FROM issue_answer_search f
        JOIN issue_answers a ON a.id = f.answer_id
        WHERE issue_answer_search MATCH ?
        ORDER BY bm25(issue_answer_search), a.created_at DESC LIMIT ?
      `).all(match, limit).map(row => ({
        id: row.id,
        kind: 'ta_answer',
        title: row.title,
        content: row.content,
        sourceUrl: row.source_url,
        createdAt: row.created_at,
      }));
      return [...official, ...answers].slice(0, limit);
    },
    backfillIssueAnswers() {
      const result = sqlite.prepare(`
        INSERT OR IGNORE INTO issue_answers (id, issue_id, title, content, source_url, created_at)
        SELECT m.id || ':' || i.id, i.id, i.title, m.content, m.jump_url, m.created_at
        FROM issues i
        JOIN issue_questions iq ON iq.issue_id = i.id
        JOIN questions q ON q.id = iq.question_id
        JOIN messages m ON m.reply_to = q.message_id
        WHERE i.status = 'RESOLVED' AND EXISTS (
          SELECT 1 FROM json_each(m.author_roles)
          WHERE lower(value) IN ('ta', 'mod', 'coach', 'admin')
        )
      `).run();
      sqlite.prepare('DELETE FROM issue_answer_search');
      sqlite.prepare('INSERT INTO issue_answer_search (answer_id, title, content) SELECT id, title, content FROM issue_answers').run();
      return result.changes;
    },
    linkIssueSource(issueId, sourceId, confidence) {
      sqlite.prepare('INSERT OR REPLACE INTO issue_sources (issue_id, source_id, confidence) VALUES (?, ?, ?)')
        .run(issueId, sourceId, confidence);
    },
    listIssueStats() {
      const rows = sqlite.prepare(`
        SELECT i.*, COUNT(q.id) AS question_count, COUNT(DISTINCT q.author_id) AS unique_askers
        FROM issues i
        LEFT JOIN issue_questions iq ON iq.issue_id = i.id
        LEFT JOIN questions q ON q.id = iq.question_id
        GROUP BY i.id
      `).all();
      const sources = sqlite.prepare(`
        SELECT s.*, x.confidence FROM issue_sources x
        JOIN official_sources s ON s.id = x.source_id
        WHERE x.issue_id = ? ORDER BY x.confidence DESC, s.created_at DESC
      `);
      return rows.map(row => ({
        ...parseIssue(row),
        questionCount: Number(row.question_count),
        uniqueAskers: Number(row.unique_askers),
        officialSources: sources.all(row.id).map(source => ({ ...parseSource(source), confidence: source.confidence })),
      }));
    },
    getCached(key) {
      const row = sqlite.prepare('SELECT response_json FROM llm_cache WHERE cache_key = ?').get(key);
      return row ? JSON.parse(row.response_json) : null;
    },
    setCached(key, value, createdAt = new Date().toISOString()) {
      sqlite.prepare('INSERT OR REPLACE INTO llm_cache (cache_key, response_json, created_at) VALUES (?, ?, ?)')
        .run(key, JSON.stringify(value), createdAt);
    },
    pruneBefore(cutoff) {
      sqlite.exec('BEGIN');
      try {
        sqlite.prepare('DELETE FROM issue_questions WHERE question_id IN (SELECT id FROM questions WHERE created_at < ?)').run(cutoff);
        const questions = sqlite.prepare('DELETE FROM questions WHERE created_at < ?').run(cutoff).changes;
        const messages = sqlite.prepare('DELETE FROM messages WHERE created_at < ?').run(cutoff).changes;
        sqlite.prepare('DELETE FROM issue_questions WHERE issue_id IN (SELECT id FROM issues WHERE last_seen < ?)').run(cutoff);
        sqlite.prepare('DELETE FROM issue_sources WHERE issue_id IN (SELECT id FROM issues WHERE last_seen < ?)').run(cutoff);
        const issues = sqlite.prepare('DELETE FROM issues WHERE last_seen < ?').run(cutoff).changes;
        const cache = sqlite.prepare('DELETE FROM llm_cache WHERE created_at < ?').run(cutoff).changes;
        sqlite.prepare('DELETE FROM issue_answers WHERE created_at < ?').run(cutoff);
        sqlite.prepare('DELETE FROM issue_search WHERE issue_id NOT IN (SELECT id FROM issues)').run();
        sqlite.prepare('DELETE FROM issue_answer_search WHERE answer_id NOT IN (SELECT id FROM issue_answers)').run();
        sqlite.exec('COMMIT');
        return { messages, questions, issues, cache };
      } catch (error) {
        sqlite.exec('ROLLBACK');
        throw error;
      }
    },
    raw: sqlite,
    close() { sqlite.close(); },
  };
}
