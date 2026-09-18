import assert from 'node:assert/strict';
import test from 'node:test';

import { openDatabase } from '../src/database.js';
import { createIssueManager } from '../src/issue-manager.js';

function fixture() {
  const db = openDatabase(':memory:');
  for (const [index, text] of ['Xem điểm danh ở đâu?', 'Điểm danh của em bị sai', 'Quy định nghỉ học'].entries()) {
    const id = `Q${index + 1}`;
    db.insertMessage({ id: `M${index + 1}`, guildId: 'G', channelId: 'C', authorId: `A${index}`, isBot: false, content: text, createdAt: `2026-09-18T${8 + index}:00:00Z` });
    db.insertQuestion({ id, messageId: `M${index + 1}`, authorId: `A${index}`, text, topics: ['attendance'], confidence: 0.9, createdAt: `2026-09-18T${8 + index}:00:00Z` });
  }
  db.createIssue({ id: 'SOURCE', title: 'Attendance', summary: 'Mixed', topics: ['attendance'], status: 'OPEN', confidence: 0.9, firstSeen: '2026-09-18T08:00:00Z', lastSeen: '2026-09-18T10:00:00Z' });
  for (const id of ['Q1', 'Q2', 'Q3']) db.linkQuestion('SOURCE', id);
  return db;
}

test('validates AI split groups and preserves uncertain questions', async () => {
  const db = fixture();
  const llm = { completeJson: async () => ({ groups: [
    { key: 'lookup', title: 'Lookup', topics: ['attendance'], question_ids: ['Q1', 'UNKNOWN'], confidence: 0.94 },
    { key: 'appeal', title: 'Appeal', topics: ['attendance'], question_ids: ['Q1', 'Q2'], confidence: 0.92 },
    { key: 'policy', title: 'Policy', topics: ['attendance'], question_ids: ['Q3'], confidence: 0.6 },
  ] }) };
  const proposal = await createIssueManager({ db, llm }).analyze('SOURCE');
  assert.deepEqual(proposal.groups.flatMap(group => group.questionIds), ['Q1', 'Q2']);
  assert.deepEqual(proposal.unassignedQuestionIds, ['Q3']);
  db.close();
});

test('applies a reviewed proposal and invalidates it', async () => {
  const db = fixture();
  const llm = { completeJson: async () => ({ groups: [
    { key: 'lookup', title: 'Lookup', topics: ['attendance'], question_ids: ['Q1'], confidence: 0.94 },
    { key: 'appeal', title: 'Appeal', topics: ['attendance'], question_ids: ['Q2'], confidence: 0.92 },
  ] }) };
  const manager = createIssueManager({ db, llm });
  const proposal = await manager.analyze('SOURCE');
  const issues = manager.applyProposal(proposal.id, { keepGroupKey: 'lookup' });
  assert.equal(issues.length, 2);
  assert.equal(manager.getProposal(proposal.id), null);
  assert.deepEqual(db.getIssueBundle('SOURCE').questions.map(item => item.id).sort(), ['Q1', 'Q3']);
  db.close();
});
