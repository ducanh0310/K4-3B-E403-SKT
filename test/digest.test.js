import assert from 'node:assert/strict';
import test from 'node:test';

import { buildDigest, deriveStatus } from '../src/digest.js';

const now = new Date('2026-09-18T20:00:00+07:00');

test('derives STUCK after four hours but preserves resolved status', () => {
  assert.equal(deriveStatus({ status: 'OPEN', firstSeen: '2026-09-18T12:00:00+07:00' }, now, 4), 'STUCK');
  assert.equal(deriveStatus({ status: 'RESOLVED', firstSeen: '2026-09-17T12:00:00+07:00' }, now, 4), 'RESOLVED');
});

test('hot topics use unique askers and action list excludes resolved issues', () => {
  const digest = buildDigest([
    { id: 'spam', title: 'Spam issue', status: 'OPEN', firstSeen: '2026-09-18T19:00:00+07:00', uniqueAskers: 1, questionCount: 8, urgency: 'normal' },
    { id: 'real', title: 'CVAT issue', status: 'OPEN', firstSeen: '2026-09-18T12:00:00+07:00', uniqueAskers: 3, questionCount: 3, urgency: 'normal', representativeJumpUrl: 'https://discord.test/x' },
    { id: 'done', title: 'Resolved', status: 'RESOLVED', firstSeen: '2026-09-17T12:00:00+07:00', uniqueAskers: 10, questionCount: 10, urgency: 'high' },
  ], { now, stuckAfterHours: 4 });
  assert.equal(digest.hotTopics[0].id, 'real');
  assert.equal(digest.actionItems[0].derivedStatus, 'STUCK');
  assert.ok(!digest.actionItems.some(issue => issue.id === 'done'));
  assert.match(digest.text, /CVAT issue/);
});

test('shows whether logistics issues have official evidence', () => {
  const withoutSource = buildDigest([
    { id: 'deadline', title: 'Lab 2 deadline', status: 'OPEN', firstSeen: '2026-09-18T19:00:00+07:00', uniqueAskers: 2, questionCount: 2, urgency: 'normal', requiresOfficialSource: true, officialSources: [] },
  ], { now, stuckAfterHours: 4 });
  assert.match(withoutSource.text, /Chưa có nguồn chính thức/);

  const withSource = buildDigest([
    { id: 'deadline', title: 'Lab 2 deadline', status: 'OPEN', firstSeen: '2026-09-18T19:00:00+07:00', uniqueAskers: 2, questionCount: 2, urgency: 'normal', requiresOfficialSource: true, officialSources: [{ title: 'Thông báo Lab 2', sourceUrl: 'https:\/\/discord.test\/source' }] },
  ], { now, stuckAfterHours: 4 });
  assert.match(withSource.text, /discord\.test\/source/);
});
