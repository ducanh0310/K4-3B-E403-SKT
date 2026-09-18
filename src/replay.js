import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { loadConfig } from './config.js';
import { loadDiscordCsv } from './csv.js';
import { openDatabase } from './database.js';
import { buildDigest } from './digest.js';
import { createPipeline } from './pipeline.js';

function topicsFor(text) {
  const value = text.toLowerCase();
  const topics = [];
  if (/lab|nộp|deadline|hạn/.test(value)) topics.push('assignment');
  if (/deadline|hạn|23h59|23:59/.test(value)) topics.push('deadline');
  if (/cvat|opa|docker|error|lỗi/.test(value)) topics.push('technical');
  if (/điểm danh|zoom/.test(value)) topics.push('attendance');
  if (/team|nhóm|đội/.test(value)) topics.push('team');
  if (/xp|standup|ticket/.test(value)) topics.push('support');
  return topics.length ? topics : ['other'];
}

function titleFor(text, topics) {
  if (/thẻ học viên/iu.test(text)) return 'Student card';
  if (topics.includes('deadline') && /lab/i.test(text)) return 'Lab deadline and late submission';
  if (/cvat|opa/i.test(text)) return 'CVAT OPA error';
  if (/clone|fork|commit|pull request|\bpr\b/iu.test(text) && /lab|repo|github/iu.test(text)) return 'Lab Git workflow';
  if (topics.includes('attendance')) return 'Attendance and Zoom';
  if (topics.includes('team')) return 'Team formation';
  if (/daily|standup/i.test(text)) return 'Daily standup';
  if (/\bxp\b/iu.test(text)) return 'XP lookup and rules';
  if (/ticket/iu.test(text)) return 'Support ticket';
  return text.replace(/\s+/g, ' ').slice(0, 72);
}

function titleTokens(title) {
  return new Set(title.toLowerCase().match(/[\p{L}\p{N}]+/gu) || []);
}

function titleOverlap(left, right) {
  const leftTokens = titleTokens(left);
  const rightTokens = titleTokens(right);
  if (!leftTokens.size || !rightTokens.size) return 0;
  const shared = [...leftTokens].filter(token => rightTokens.has(token)).length;
  return shared / Math.min(leftTokens.size, rightTokens.size);
}

export function createFakeLlm() {
  return {
    async completeJson({ purpose, input }) {
      if (purpose === 'extract_questions') {
        const content = input.content.trim();
        const looksRelevant = /\?|cho hỏi|hỏi|làm sao|không được|không thấy|chưa thấy|bị lỗi|error|cvat|opa|deadline|hạn|nộp|điểm danh|ticket|xp|standup/iu.test(content);
        if (!looksRelevant) return { questions: [] };
        const parts = content.split(/\?+|\s+(?:với|và)\s+(?=[A-ZÀ-Ỹ]|lab|cvat)/iu).map(part => part.trim()).filter(part => part.length > 5);
        return { questions: parts.map(text => {
          const topics = topicsFor(text);
          return { text, title: titleFor(text, topics), summary: text, topics, confidence: 0.8, urgency: /khóa|deadline|hạn/iu.test(text) ? 'high' : 'normal', requires_official_source: /deadline|hạn|điểm danh|lịch/iu.test(text) };
        }) };
      }
      if (purpose === 'assess_resolution') return { status: 'NO_CHANGE', confidence: 1 };
      if (purpose === 'match_official_source') return { supports_answer: false, source_id: null, confidence: 0 };
      if (purpose !== 'match_issue') throw new Error(`Unsupported replay LLM purpose: ${purpose}`);
      const questionTopics = new Set(input.question.topics.filter(topic => topic !== 'other'));
      const candidate = input.candidates.find(item =>
        item.title.toLowerCase() === input.question.title.toLowerCase()
        || (item.topics.some(topic => questionTopics.has(topic)) && titleOverlap(item.title, input.question.title) >= 0.5),
      );
      return candidate ? { same_issue: true, issue_id: candidate.id, confidence: 0.9 } : { same_issue: false, issue_id: null, confidence: 0 };
    },
  };
}

function normalizeRow(row) {
  return {
    id: row.msg_id,
    guildId: row.guild,
    channelId: row.channel,
    authorId: row.author,
    isBot: row.is_bot === 'True',
    content: row.content,
    replyTo: row.reply_to || null,
    createdAt: `${row.created_at_vn.replace(' ', 'T')}:00+07:00`,
    jumpUrl: `discord://message/${row.msg_id}`,
  };
}

export async function replayRows(rows, { pipeline, db, now = new Date() }) {
  let processed = 0;
  const sorted = [...rows].sort((left, right) => left.created_at_vn.localeCompare(right.created_at_vn));
  for (const row of sorted) {
    const result = await pipeline.processMessage(normalizeRow(row));
    if (result.kind === 'processed' && result.issues.length) processed += 1;
  }
  return { processed, total: sorted.length, digest: buildDigest(db.listIssueStats(), { now }) };
}

async function main() {
  const config = loadConfig(process.env, { replay: true });
  const projectDir = path.dirname(fileURLToPath(import.meta.url));
  const defaultCsv = path.resolve(projectDir, '../../hackathon-data-20260917/data/discord-pack/k4_messages.csv');
  const csvPath = process.argv[2] || defaultCsv;
  const db = openDatabase(process.env.DATABASE_PATH || ':memory:');
  try {
    const rows = await loadDiscordCsv(csvPath);
    const pipeline = createPipeline({ db, llm: createFakeLlm() });
    const lastTime = rows.at(-1)?.created_at_vn || '2026-09-18 20:00';
    const result = await replayRows(rows, { pipeline, db, now: new Date(`${lastTime.replace(' ', 'T')}:00+07:00`) });
    console.log(`Replayed ${result.total} messages; processed ${result.processed} candidates.`);
    console.log(result.digest.text);
  } finally {
    db.close();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) await main();
