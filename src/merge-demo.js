import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { openDatabase } from './database.js';

export function mergeDemoData({ liveDb, demoDb, cutoff, prefix = 'demo:' }) {
  const live = liveDb.raw;
  const demo = demoDb.raw;
  const counts = { messages: 0, questions: 0, issues: 0, links: 0 };
  const insertMessage = live.prepare(`
    INSERT OR IGNORE INTO messages
      (id, guild_id, channel_id, thread_id, author_id, author_roles, is_bot, content, reply_to, jump_url, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)
  `);
  const insertQuestion = live.prepare(`
    INSERT OR IGNORE INTO questions
      (id, message_id, author_id, text, topics, confidence, urgency, requires_official_source, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertIssue = live.prepare(`
    INSERT OR IGNORE INTO issues
      (id, title, summary, topics, status, confidence, urgency, requires_official_source, first_seen, last_seen, resolved_at, representative_jump_url)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
  `);
  const insertLink = live.prepare('INSERT OR IGNORE INTO issue_questions (issue_id, question_id) VALUES (?, ?)');
  const deleteSearch = live.prepare('DELETE FROM issue_search WHERE issue_id = ?');
  const insertSearch = live.prepare('INSERT INTO issue_search (issue_id, title, summary, topics) VALUES (?, ?, ?, ?)');

  live.exec('BEGIN');
  try {
    for (const row of demo.prepare('SELECT * FROM messages WHERE created_at >= ? ORDER BY created_at').all(cutoff)) {
      counts.messages += insertMessage.run(
        `${prefix}${row.id}`,
        `${prefix}${row.guild_id || ''}`,
        `${prefix}${row.channel_id || ''}`,
        row.thread_id ? `${prefix}${row.thread_id}` : '',
        `${prefix}${row.author_id}`,
        row.author_roles,
        row.is_bot,
        row.content,
        row.reply_to ? `${prefix}${row.reply_to}` : null,
        row.created_at,
      ).changes;
    }
    for (const row of demo.prepare('SELECT * FROM questions WHERE created_at >= ? ORDER BY created_at').all(cutoff)) {
      counts.questions += insertQuestion.run(
        `${prefix}${row.id}`,
        `${prefix}${row.message_id}`,
        `${prefix}${row.author_id}`,
        row.text,
        row.topics,
        row.confidence,
        row.urgency,
        row.requires_official_source,
        row.created_at,
      ).changes;
    }
    for (const row of demo.prepare('SELECT * FROM issues WHERE last_seen >= ? ORDER BY first_seen').all(cutoff)) {
      const id = `${prefix}${row.id}`;
      const inserted = insertIssue.run(
        id,
        row.title,
        row.summary,
        row.topics,
        row.status,
        row.confidence,
        row.urgency,
        row.requires_official_source,
        row.first_seen,
        row.last_seen,
        row.resolved_at,
      ).changes;
      counts.issues += inserted;
      if (inserted) {
        deleteSearch.run(id);
        insertSearch.run(id, row.title, row.summary, JSON.parse(row.topics || '[]').join(' '));
      }
    }
    for (const row of demo.prepare(`
      SELECT iq.* FROM issue_questions iq
      JOIN issues i ON i.id = iq.issue_id
      JOIN questions q ON q.id = iq.question_id
      WHERE i.last_seen >= ? AND q.created_at >= ?
    `).all(cutoff, cutoff)) {
      counts.links += insertLink.run(`${prefix}${row.issue_id}`, `${prefix}${row.question_id}`).changes;
    }
    live.exec('COMMIT');
    return counts;
  } catch (error) {
    live.exec('ROLLBACK');
    throw error;
  }
}

async function main(env = process.env) {
  if (!env.DEMO_DATABASE_PATH) throw new Error('DEMO_DATABASE_PATH is required');
  const days = Number(env.CONTEXT_RETENTION_DAYS || 30);
  if (!Number.isFinite(days) || days <= 0) throw new Error('CONTEXT_RETENTION_DAYS must be positive');
  const cutoff = new Date(Date.now() - days * 86_400_000).toISOString();
  const liveDb = openDatabase(path.resolve(env.DATABASE_PATH || './data/bot.db'));
  const demoDb = openDatabase(path.resolve(env.DEMO_DATABASE_PATH));
  try {
    console.log(JSON.stringify({ cutoff, ...mergeDemoData({ liveDb, demoDb, cutoff }) }));
  } finally {
    demoDb.close();
    liveDb.close();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) await main();
