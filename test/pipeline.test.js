import assert from 'node:assert/strict';
import test from 'node:test';

import { openDatabase } from '../src/database.js';
import { createPipeline } from '../src/pipeline.js';

function fakeLlm(responses) {
  return { completeJson: async () => responses.shift() };
}

function message(overrides = {}) {
  return { id: 'M1', guildId: 'G', channelId: 'C', authorId: 'A', isBot: false, content: 'CVAT lỗi và Lab 2 hạn mấy giờ?', createdAt: '2026-09-18T08:00:00+07:00', ...overrides };
}

test('splits one message into multiple issues', async () => {
  const db = openDatabase(':memory:');
  const pipeline = createPipeline({ db, llm: fakeLlm([{ questions: [
    { text: 'CVAT không chạy', title: 'CVAT startup error', topics: ['technical'], confidence: 0.95 },
    { text: 'Deadline Lab 2', title: 'Lab 2 deadline', topics: ['assignment', 'deadline'], confidence: 0.96, requires_official_source: true },
  ] }]) });
  const result = await pipeline.processMessage(message());
  assert.equal(result.issues.length, 2);
  assert.equal(db.countQuestions(), 2);
  db.close();
});

test('rejects non-support content and normalizes topics', async () => {
  const db = openDatabase(':memory:');
  const pipeline = createPipeline({ db, llm: fakeLlm([
    { support_relevant: false, questions: [] },
    { support_relevant: true, questions: [{
      text: 'Lab 2 nộp ở đâu?',
      title: 'Lab 2 submission',
      summary: 'Nơi nộp Lab 2',
      topics: ['submission', 'UNKNOWN', 'submission', 'other'],
      confidence: 0.95,
      urgency: 'normal',
      requires_official_source: true,
    }] },
  ]) });

  const announcement = await pipeline.processMessage(message({ id: 'ANN', content: 'Thông báo workshop tối nay' }));
  assert.equal(announcement.kind, 'ignored');
  assert.equal(announcement.reason, 'not_support_request');

  const result = await pipeline.processMessage(message({ id: 'Q', content: 'Lab 2 nộp ở đâu?' }));
  assert.deepEqual(result.issues[0].topics, ['submission']);
  db.close();
});

test('merges high confidence and routes medium confidence to review', async () => {
  const db = openDatabase(':memory:');
  db.createIssue({ id: 'cvat-opa', title: 'CVAT OPA error', summary: 'Policy bundle lỗi', topics: ['technical'], status: 'OPEN', confidence: 0.9, firstSeen: '2026-09-17T08:00:00+07:00', lastSeen: '2026-09-17T08:00:00+07:00' });
  const extraction = { questions: [{ text: 'OPA không tải bundle', title: 'OPA bundle error', topics: ['technical'], confidence: 0.94 }] };
  const high = createPipeline({ db, llm: fakeLlm([extraction, { same_issue: true, issue_id: 'cvat-opa', confidence: 0.91 }]) });
  assert.equal((await high.processMessage(message({ id: 'M2', content: 'OPA không tải bundle' }))).issues[0].id, 'cvat-opa');
  const medium = createPipeline({ db, llm: fakeLlm([extraction, { same_issue: true, issue_id: 'cvat-opa', confidence: 0.7 }]) });
  const reviewed = await medium.processMessage(message({ id: 'M3', content: 'OPA lại lỗi' }));
  assert.equal(reviewed.issues[0].status, 'NEEDS_REVIEW');
  assert.notEqual(reviewed.issues[0].id, 'cvat-opa');
  db.close();
});

test('ignores bot messages', async () => {
  const db = openDatabase(':memory:');
  const pipeline = createPipeline({ db, llm: fakeLlm([]) });
  const result = await pipeline.processMessage(message({ isBot: true }));
  assert.equal(result.kind, 'ignored');
  assert.equal(db.countQuestions(), 0);
  db.close();
});

test('ignores non-moderator messages in official knowledge channels', async () => {
  const db = openDatabase(':memory:');
  const pipeline = createPipeline({
    db,
    llm: { completeJson: async () => assert.fail('LLM should not process student content in a knowledge channel') },
    officialChannelIds: new Set(['KNOWLEDGE']),
  });
  const result = await pipeline.processMessage(message({ channelId: 'KNOWLEDGE', content: 'Deadline là ngày em đoán' }));
  assert.equal(result.kind, 'ignored');
  assert.equal(result.reason, 'official_channel_non_staff');
  db.close();
});

test('marks an issue resolved when a confident reply answers it', async () => {
  const db = openDatabase(':memory:');
  db.insertMessage(message({ id: 'QUESTION', content: 'CVAT lỗi' }));
  db.insertQuestion({ id: 'QUESTION:1', messageId: 'QUESTION', authorId: 'A', text: 'CVAT lỗi', topics: ['technical'], confidence: 0.9, createdAt: '2026-09-18T08:00:00+07:00' });
  db.createIssue({ id: 'cvat', title: 'CVAT error', summary: 'CVAT lỗi', topics: ['technical'], status: 'OPEN', confidence: 0.9, firstSeen: '2026-09-18T08:00:00+07:00', lastSeen: '2026-09-18T08:00:00+07:00' });
  db.linkQuestion('cvat', 'QUESTION:1');
  const pipeline = createPipeline({ db, llm: fakeLlm([{ status: 'RESOLVED', confidence: 0.94 }, { questions: [] }]) });

  const result = await pipeline.processMessage(message({ id: 'ANSWER', replyTo: 'QUESTION', content: 'Em bật Docker rồi chạy lại là được nhé', authorId: 'TA', authorRoles: ['TA'], isModerator: true, jumpUrl: 'https://discord.test/answer' }));
  assert.equal(result.resolutionIssues[0].status, 'RESOLVED');
  assert.equal(db.getIssue('cvat').status, 'RESOLVED');
  assert.deepEqual(db.searchKnowledge('Docker', 5).map(item => item.id), ['ANSWER:cvat']);
  db.close();
});

test('stores trusted announcements only from configured official channels', async () => {
  const db = openDatabase(':memory:');
  const pipeline = createPipeline({ db, llm: fakeLlm([]), officialChannelIds: new Set(['OFFICIAL']) });
  const result = await pipeline.processMessage(message({ id: 'S1', channelId: 'OFFICIAL', authorRoles: ['TA'], content: 'Lab 2 hạn nộp 23:59 ngày 20/09', jumpUrl: 'https://discord.test/source' }));
  assert.equal(result.kind, 'official_source_saved');
  assert.deepEqual(db.searchOfficialSources('Lab 2', 5).map(source => source.id), ['S1']);
  db.close();
});

test('attaches verified official evidence to logistics issues', async () => {
  const db = openDatabase(':memory:');
  db.addOfficialSource({ id: 'S1', title: 'Lab 2 deadline', content: 'Lab 2 hạn nộp 23:59 ngày 20/09', sourceUrl: 'https://discord.test/source', createdAt: '2026-09-18T07:00:00+07:00' });
  const pipeline = createPipeline({ db, llm: fakeLlm([
    { questions: [{ text: 'Lab 2 hạn mấy giờ?', title: 'Lab 2 deadline', topics: ['assignment', 'deadline'], confidence: 0.95, requires_official_source: true }] },
    { supports_answer: true, source_id: 'S1', confidence: 0.96 },
  ]) });
  const result = await pipeline.processMessage(message({ content: 'Lab 2 hạn mấy giờ?' }));
  assert.equal(result.issues[0].requiresOfficialSource, true);
  assert.equal(db.listIssueStats()[0].officialSources[0].id, 'S1');
  db.close();
});
