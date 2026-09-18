import assert from 'node:assert/strict';
import test from 'node:test';

import { createAnswerer, formatAnswer } from '../src/answer.js';
import { openDatabase } from '../src/database.js';

test('returns needs_ta without calling the LLM when retrieval is empty', async () => {
  const db = openDatabase(':memory:');
  const answerer = createAnswerer({ db, llm: { completeJson: async () => assert.fail('LLM should not be called') } });
  const result = await answerer.answer('CVAT sửa thế nào?');
  assert.equal(result.kind, 'needs_ta');
  assert.match(formatAnswer(result), /TA\/MOD/);
  db.close();
});

test('shows related issues from the existing dataset without treating them as evidence', async () => {
  const db = openDatabase(':memory:');
  const referenceDb = openDatabase(':memory:');
  referenceDb.createIssue({ id: 'REF1', title: 'Lab 2 deadline', summary: 'Nhiều học viên hỏi hạn Lab 2', topics: ['assignment', 'deadline'], status: 'OPEN', confidence: 0.9, firstSeen: '2026-09-13T08:00:00+07:00', lastSeen: '2026-09-13T09:00:00+07:00' });
  const answerer = createAnswerer({ db, referenceDb, llm: { completeJson: async () => assert.fail('Reference issues are not trusted evidence') } });
  const result = await answerer.answer('Lab 2 deadline là khi nào?');
  assert.equal(result.kind, 'needs_ta');
  assert.deepEqual(result.relatedIssues.map(issue => issue.id), ['REF1']);
  assert.match(formatAnswer(result), /dataset tham khảo/);
  assert.match(formatAnswer(result), /Lab 2 deadline/);
  db.close();
  referenceDb.close();
});

test('answers only with retrieved official and TA sources', async () => {
  const db = openDatabase(':memory:');
  db.addOfficialSource({ id: 'S1', title: 'Lab 2 deadline', content: 'Hạn nộp là 23:59 ngày 20/09', sourceUrl: 'https://discord.test/source', createdAt: '2026-09-18T07:00:00+07:00' });
  db.addIssueAnswer({ id: 'A1', issueId: 'I1', title: 'Lab 2 deadline', content: 'Nộp trên LMS trước 23:59.', sourceUrl: 'https://discord.test/answer', createdAt: '2026-09-18T08:00:00+07:00' });
  const llm = { completeJson: async request => {
    assert.equal(request.purpose, 'answer_question');
    assert.deepEqual(request.input.sources.map(source => source.id).sort(), ['A1', 'S1']);
    return { answer: 'Lab 2 nộp trên LMS trước 23:59 ngày 20/09.', confidence: 0.94, source_ids: ['S1', 'A1'], needs_ta: false };
  } };
  const result = await createAnswerer({ db, llm }).answer('Lab 2 hạn lúc nào và nộp ở đâu?');
  assert.equal(result.kind, 'answered');
  assert.equal(result.sources.length, 2);
  assert.match(formatAnswer(result), /Nguồn/);
  db.close();
});

test('rejects answers citing sources outside retrieval', async () => {
  const db = openDatabase(':memory:');
  db.addOfficialSource({ id: 'S1', title: 'Lab 2 deadline', content: 'Hạn nộp 23:59', sourceUrl: 'https://discord.test/source', createdAt: '2026-09-18T07:00:00+07:00' });
  const llm = { completeJson: async () => ({ answer: 'Bịa', confidence: 0.99, source_ids: ['UNKNOWN'], needs_ta: false }) };
  assert.equal((await createAnswerer({ db, llm }).answer('Lab 2 deadline')).kind, 'needs_ta');
  db.close();
});
