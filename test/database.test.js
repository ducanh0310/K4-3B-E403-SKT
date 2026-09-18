import assert from 'node:assert/strict';
import test from 'node:test';

import { openDatabase } from '../src/database.js';

test('stores messages idempotently and supports multiple questions per message', () => {
  const db = openDatabase(':memory:');
  const message = { id: 'M1', guildId: 'G', channelId: 'C', authorId: 'A', isBot: false, content: 'Two questions', createdAt: '2026-09-18T08:00:00+07:00' };
  assert.equal(db.insertMessage(message), true);
  assert.equal(db.insertMessage(message), false);
  db.insertQuestion({ id: 'Q1', messageId: 'M1', authorId: 'A', text: 'CVAT lỗi', topics: ['technical'], confidence: 0.9, createdAt: message.createdAt });
  db.insertQuestion({ id: 'Q2', messageId: 'M1', authorId: 'A', text: 'Lab hạn mấy giờ', topics: ['deadline'], confidence: 0.9, createdAt: message.createdAt });
  assert.equal(db.countQuestions(), 2);
  db.close();
});

test('finds issue candidates with SQLite FTS', () => {
  const db = openDatabase(':memory:');
  db.createIssue({ id: 'I1', title: 'CVAT OPA policy error', summary: 'Không tải được policy bundle', topics: ['technical', 'cvat'], status: 'OPEN', confidence: 0.9, firstSeen: '2026-09-18T08:00:00+07:00', lastSeen: '2026-09-18T08:00:00+07:00' });
  db.createIssue({ id: 'I2', title: 'Lab 2 deadline', summary: 'Hạn nộp Lab 2', topics: ['assignment', 'deadline'], status: 'OPEN', confidence: 0.9, firstSeen: '2026-09-18T08:00:00+07:00', lastSeen: '2026-09-18T08:00:00+07:00' });
  assert.deepEqual(db.searchIssues('policy bundle', 5).map(issue => issue.id), ['I1']);
  db.close();
});

test('finds candidates by controlled topic when wording differs', () => {
  const db = openDatabase(':memory:');
  db.createIssue({
    id: 'cvat',
    title: 'CVAT OPA error',
    summary: 'OPA không tải policy bundle',
    topics: ['technical'],
    status: 'OPEN',
    confidence: 0.9,
    firstSeen: '2026-09-18T08:00:00+07:00',
    lastSeen: '2026-09-18T08:00:00+07:00',
  });

  const candidates = db.findIssueCandidates({
    title: 'Policy service failure',
    text: 'Dịch vụ xác thực không đồng bộ cấu hình',
    topics: ['technical'],
  }, 12);

  assert.deepEqual(candidates.map(item => item.id), ['cvat']);
  db.close();
});

test('updates, merges, and reopens issues', () => {
  const db = openDatabase(':memory:');
  const createdAt = '2026-09-18T08:00:00+07:00';
  db.insertMessage({ id: 'M1', guildId: 'G', channelId: 'C', authorId: 'A', isBot: false, content: 'OPA lỗi', createdAt });
  db.insertQuestion({ id: 'Q1', messageId: 'M1', authorId: 'A', text: 'OPA lỗi', topics: ['technical'], confidence: 0.9, createdAt });
  db.createIssue({ id: 'SOURCE', title: 'OPA lỗi', summary: 'OPA lỗi', topics: ['technical'], status: 'OPEN', confidence: 0.9, firstSeen: createdAt, lastSeen: createdAt });
  db.createIssue({ id: 'TARGET', title: 'CVAT OPA error', summary: 'Policy bundle lỗi', topics: ['technical'], status: 'OPEN', confidence: 0.9, firstSeen: createdAt, lastSeen: createdAt });
  db.linkQuestion('SOURCE', 'Q1');

  assert.equal(db.updateIssueStatus('SOURCE', 'RESOLVED', '2026-09-18T09:00:00+07:00').status, 'RESOLVED');
  assert.ok(db.getIssue('SOURCE').resolvedAt);
  assert.equal(db.updateIssueStatus('SOURCE', 'OPEN').resolvedAt, null);
  assert.equal(db.mergeIssues('SOURCE', 'TARGET').id, 'TARGET');
  assert.equal(db.getIssue('SOURCE'), null);
  assert.deepEqual(db.findIssuesByMessage('M1').map(issue => issue.id), ['TARGET']);
  db.close();
});

test('indexes official sources and links evidence to issues', () => {
  const db = openDatabase(':memory:');
  db.createIssue({ id: 'I1', title: 'Lab 2 deadline', summary: 'Hạn nộp Lab 2', topics: ['deadline'], status: 'OPEN', confidence: 0.9, requiresOfficialSource: true, firstSeen: '2026-09-18T08:00:00+07:00', lastSeen: '2026-09-18T08:00:00+07:00' });
  db.addOfficialSource({ id: 'S1', title: 'Thông báo Lab 2', content: 'Lab 2 hạn nộp 23:59 ngày 20/09', sourceUrl: 'https://discord.test/source', createdAt: '2026-09-18T07:00:00+07:00' });
  assert.deepEqual(db.searchOfficialSources('Lab 2 hạn nộp', 5).map(source => source.id), ['S1']);
  db.linkIssueSource('I1', 'S1', 0.96);
  const [issue] = db.listIssueStats();
  assert.equal(issue.officialSources[0].sourceUrl, 'https://discord.test/source');
  db.close();
});

test('indexes TA answers and combines them with official sources for RAG', () => {
  const db = openDatabase(':memory:');
  db.addOfficialSource({ id: 'S1', title: 'CVAT setup', content: 'Phải bật Docker trước', sourceUrl: 'https://discord.test/source', createdAt: '2026-09-18T07:00:00+07:00' });
  db.addIssueAnswer({ id: 'A1', issueId: 'I1', title: 'CVAT startup error', content: 'Bật Docker rồi khởi động lại CVAT', sourceUrl: 'https://discord.test/answer', createdAt: '2026-09-18T08:00:00+07:00' });
  const knowledge = db.searchKnowledge('CVAT Docker', 5);
  assert.deepEqual(knowledge.map(item => item.id).sort(), ['A1', 'S1']);
  assert.deepEqual(knowledge.map(item => item.kind).sort(), ['official', 'ta_answer']);
  db.close();
});

test('backfills RAG knowledge from existing resolved TA replies', () => {
  const db = openDatabase(':memory:');
  const createdAt = '2026-09-18T08:00:00+07:00';
  db.insertMessage({ id: 'Q', guildId: 'G', channelId: 'C', authorId: 'STUDENT', isBot: false, content: 'CVAT không chạy', createdAt });
  db.insertMessage({ id: 'A', guildId: 'G', channelId: 'C', authorId: 'TA', authorRoles: ['TA'], isBot: false, content: 'Bật Docker rồi chạy lại CVAT', replyTo: 'Q', jumpUrl: 'https://discord.test/answer', createdAt });
  db.insertQuestion({ id: 'Q:1', messageId: 'Q', authorId: 'STUDENT', text: 'CVAT không chạy', topics: ['technical'], confidence: 0.9, createdAt });
  db.createIssue({ id: 'I', title: 'CVAT startup error', summary: 'CVAT không chạy', topics: ['technical'], status: 'RESOLVED', confidence: 0.9, firstSeen: createdAt, lastSeen: createdAt });
  db.linkQuestion('I', 'Q:1');
  assert.equal(db.backfillIssueAnswers(), 1);
  assert.deepEqual(db.searchKnowledge('Docker CVAT', 5).map(item => item.id), ['A:I']);
  db.close();
});

test('prunes raw context and cache but preserves verified knowledge', () => {
  const db = openDatabase(':memory:');
  db.insertMessage({ id: 'OLD', guildId: 'G', channelId: 'C', authorId: 'A', isBot: false, content: 'old', createdAt: '2026-08-01T00:00:00Z' });
  db.insertQuestion({ id: 'OLD:1', messageId: 'OLD', authorId: 'A', text: 'old', topics: ['other'], confidence: 0.5, createdAt: '2026-08-01T00:00:00Z' });
  db.createIssue({ id: 'OLD-I', title: 'Old issue', summary: 'old', topics: ['other'], status: 'OPEN', confidence: 0.5, firstSeen: '2026-08-01T00:00:00Z', lastSeen: '2026-08-01T00:00:00Z' });
  db.linkQuestion('OLD-I', 'OLD:1');
  db.setCached('old-cache', { ok: true }, '2026-08-01T00:00:00Z');
  db.addIssueAnswer({ id: 'OLD-A', issueId: 'OLD-I', title: 'Legacy TA fix', content: 'restart legacy service', createdAt: '2026-08-01T00:00:00Z' });
  db.addOfficialSource({ id: 'OLD-S', title: 'Old official source', content: 'verified old policy', createdAt: '2026-08-01T00:00:00Z' });

  const result = db.pruneBefore('2026-08-19T00:00:00Z');
  assert.equal(result.messages, 1);
  assert.equal(db.countQuestions(), 0);
  assert.equal(db.getIssue('OLD-I'), null);
  assert.equal(db.getCached('old-cache'), null);
  assert.deepEqual(db.searchKnowledge('restart legacy', 5).map(item => item.id), ['OLD-A']);
  assert.deepEqual(db.searchKnowledge('official policy', 5).map(item => item.id), ['OLD-S']);
  db.close();
});

function seededSplitDatabase() {
  const db = openDatabase(':memory:');
  for (const [index, text] of ['Xem điểm danh ở đâu?', 'Điểm danh của em bị sai', 'Quy định nghỉ học'].entries()) {
    const id = `Q${index + 1}`;
    db.insertMessage({ id: `M${index + 1}`, guildId: 'G', channelId: 'C', authorId: `A${index + 1}`, isBot: false, content: text, createdAt: `2026-09-18T0${index + 8}:00:00Z` });
    db.insertQuestion({ id, messageId: `M${index + 1}`, authorId: `A${index + 1}`, text, topics: ['attendance'], confidence: 0.9, createdAt: `2026-09-18T0${index + 8}:00:00Z` });
  }
  for (const id of ['SOURCE', 'TARGET']) db.createIssue({ id, title: id, summary: id, topics: ['attendance'], status: 'OPEN', confidence: 0.9, firstSeen: '2026-09-18T08:00:00Z', lastSeen: '2026-09-18T10:00:00Z' });
  for (const id of ['Q1', 'Q2', 'Q3']) db.linkQuestion('SOURCE', id);
  db.addOfficialSource({ id: 'S1', title: 'Attendance policy', content: 'Official', createdAt: '2026-09-18T08:00:00Z' });
  db.linkIssueSource('SOURCE', 'S1', 0.9);
  return db;
}

test('moves selected questions between issues atomically', () => {
  const db = seededSplitDatabase();
  db.moveQuestions({ sourceId: 'SOURCE', targetId: 'TARGET', questionIds: ['Q1', 'Q2'] });
  assert.deepEqual(db.getIssueBundle('SOURCE').questions.map(item => item.id), ['Q3']);
  assert.deepEqual(db.getIssueBundle('TARGET').questions.map(item => item.id).sort(), ['Q1', 'Q2']);
  assert.throws(() => db.moveQuestions({ sourceId: 'SOURCE', targetId: 'TARGET', questionIds: ['Q1'] }), /does not belong/);
  db.close();
});

test('splits an issue without copying official evidence', () => {
  const db = seededSplitDatabase();
  db.splitIssue({ sourceId: 'SOURCE', keep: { title: 'Attendance lookup', summary: 'Lookup', topics: ['attendance'], questionIds: ['Q1'] }, groups: [{ id: 'SPLIT', title: 'Attendance appeal', summary: 'Appeal', topics: ['attendance'], questionIds: ['Q2', 'Q3'], confidence: 0.9 }] });
  assert.deepEqual(db.getIssueBundle('SOURCE').questions.map(item => item.id), ['Q1']);
  assert.deepEqual(db.getIssueBundle('SPLIT').questions.map(item => item.id).sort(), ['Q2', 'Q3']);
  assert.equal(db.getIssueBundle('SPLIT').officialSources.length, 0);
  assert.equal(db.getIssue('SPLIT').status, 'NEEDS_REVIEW');
  db.close();
});
