import assert from 'node:assert/strict';
import test from 'node:test';

import { openDatabase } from '../src/database.js';
import { mergeDemoData } from '../src/merge-demo.js';

test('merges recent demo data into live DB with stable prefixed ids', () => {
  const liveDb = openDatabase(':memory:');
  const demoDb = openDatabase(':memory:');
  const recent = '2026-09-13T08:00:00.000Z';
  const old = '2026-07-01T08:00:00.000Z';

  demoDb.insertMessage({ id: 'M1', guildId: 'G', channelId: 'C', authorId: 'A', authorRoles: [], isBot: false, content: 'Lab 2 deadline?', createdAt: recent });
  demoDb.insertQuestion({ id: 'M1:1', messageId: 'M1', authorId: 'A', text: 'Lab 2 deadline?', topics: ['deadline'], confidence: 0.9, createdAt: recent });
  demoDb.createIssue({ id: 'I1', title: 'Lab 2 deadline', summary: 'Hỏi hạn Lab 2', topics: ['deadline'], status: 'OPEN', confidence: 0.9, firstSeen: recent, lastSeen: recent });
  demoDb.linkQuestion('I1', 'M1:1');
  demoDb.insertMessage({ id: 'OLD', guildId: 'G', channelId: 'C', authorId: 'A', authorRoles: [], isBot: false, content: 'old', createdAt: old });

  const first = mergeDemoData({ liveDb, demoDb, cutoff: '2026-08-19T00:00:00.000Z' });
  const second = mergeDemoData({ liveDb, demoDb, cutoff: '2026-08-19T00:00:00.000Z' });

  assert.deepEqual(first, { messages: 1, questions: 1, issues: 1, links: 1 });
  assert.deepEqual(second, { messages: 0, questions: 0, issues: 0, links: 0 });
  assert.equal(liveDb.raw.prepare("SELECT COUNT(*) AS count FROM messages WHERE id = 'demo:M1'").get().count, 1);
  assert.equal(liveDb.raw.prepare("SELECT COUNT(*) AS count FROM messages WHERE id = 'demo:OLD'").get().count, 0);
  assert.equal(liveDb.getIssue('demo:I1').title, 'Lab 2 deadline');
  assert.deepEqual(liveDb.searchIssues('Lab 2 deadline', 5).map(issue => issue.id), ['demo:I1']);

  liveDb.close();
  demoDb.close();
});
