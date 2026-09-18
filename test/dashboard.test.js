import assert from 'node:assert/strict';
import { once } from 'node:events';
import test from 'node:test';

import { renderDashboard, startDashboard } from '../src/dashboard.js';

test('renders a read-only issue dashboard with official evidence', () => {
  const html = renderDashboard([
    {
      id: 'lab-deadline', title: 'Lab 2 deadline', summary: 'Hạn nộp Lab 2', status: 'OPEN',
      firstSeen: '2026-09-18T08:00:00+07:00', lastSeen: '2026-09-18T09:00:00+07:00',
      uniqueAskers: 3, questionCount: 4, urgency: 'high', requiresOfficialSource: true,
      officialSources: [{ title: 'Thông báo Lab 2', sourceUrl: 'https://discord.test/source' }],
      representativeJumpUrl: 'https://discord.com/channels/G/C/M',
    },
  ], { now: new Date('2026-09-18T13:00:00Z'), stuckAfterHours: 4, title: 'K4 Dataset Demo', eyebrow: '1.092 tin đã ẩn danh' });
  assert.match(html, /K4 Dataset Demo/);
  assert.match(html, /1\.092 tin đã ẩn danh/);
  assert.match(html, /STUCK/);
  assert.match(html, /3 học viên/);
  assert.match(html, /Nguồn chính thức/);
  assert.match(html, /discord\.com\/channels/);
});

test('escapes issue text and rejects unsafe links', () => {
  const html = renderDashboard([
    {
      id: 'unsafe', title: '<script>alert(1)</script>', summary: 'x', status: 'OPEN',
      firstSeen: '2026-09-18T12:00:00+07:00', lastSeen: '2026-09-18T12:00:00+07:00',
      uniqueAskers: 1, questionCount: 1, urgency: 'normal', officialSources: [],
      representativeJumpUrl: 'javascript:alert(1)',
    },
  ], { now: new Date('2026-09-18T13:00:00Z') });
  assert.doesNotMatch(html, /<script>alert/);
  assert.doesNotMatch(html, /javascript:/);
  assert.match(html, /&lt;script&gt;/);
});

test('dashboard requires configured HTTP Basic credentials', async t => {
  const db = { listIssueStats: () => [] };
  const server = startDashboard({ db, port: 0, username: 'ta', password: 'secret', logger: { log() {}, error() {} } });
  t.after(() => server.close());
  await once(server, 'listening');
  const { port } = server.address();

  const missing = await fetch(`http://127.0.0.1:${port}/healthz`);
  assert.equal(missing.status, 401);
  assert.match(missing.headers.get('www-authenticate'), /^Basic /);

  const wrong = await fetch(`http://127.0.0.1:${port}/`, {
    headers: { authorization: `Basic ${Buffer.from('ta:wrong').toString('base64')}` },
  });
  assert.equal(wrong.status, 401);

  const accepted = await fetch(`http://127.0.0.1:${port}/`, {
    headers: { authorization: `Basic ${Buffer.from('ta:secret').toString('base64')}` },
  });
  assert.equal(accepted.status, 200);
});

test('dashboard remains accessible when credentials are not configured', async t => {
  const server = startDashboard({ db: { listIssueStats: () => [] }, port: 0, logger: { log() {}, error() {} } });
  t.after(() => server.close());
  await once(server, 'listening');
  const { port } = server.address();
  assert.equal((await fetch(`http://127.0.0.1:${port}/healthz`)).status, 200);
});
