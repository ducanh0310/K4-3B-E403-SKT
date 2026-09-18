import { timingSafeEqual } from 'node:crypto';
import { createServer } from 'node:http';

import { deriveStatus } from './digest.js';

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]);
}

function safeUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? escapeHtml(url.href) : '';
  } catch {
    return '';
  }
}

function statusClass(status) {
  return status.toLowerCase().replace(/[^a-z_]/g, '');
}

const TOPIC_LABELS = {
  assignment: 'Assignment',
  deadline: 'Deadline',
  submission: 'Submission',
  technical: 'Technical',
  learning_content: 'Learning Content',
  attendance: 'Attendance',
  account_access: 'Account Access',
  schedule: 'Schedule',
  other: 'Khác',
};

const STATUS_WEIGHT = { STUCK: 4, NEEDS_REVIEW: 3, DISCUSSING: 2, OPEN: 1 };

function compareIssues(left, right) {
  return (STATUS_WEIGHT[right.derivedStatus] || 0) - (STATUS_WEIGHT[left.derivedStatus] || 0)
    || right.uniqueAskers - left.uniqueAskers
    || right.questionCount - left.questionCount
    || new Date(right.lastSeen) - new Date(left.lastSeen);
}

function renderIssueRows(issues) {
  return issues.map(issue => {
    const jumpUrl = safeUrl(issue.representativeJumpUrl);
    const source = issue.officialSources?.[0];
    const sourceUrl = safeUrl(source?.sourceUrl);
    const evidence = issue.requiresOfficialSource
      ? (sourceUrl ? `<a href="${sourceUrl}" target="_blank" rel="noreferrer">Nguồn chính thức</a>` : '<span class="missing">Thiếu nguồn</span>')
      : '<span class="muted">Không yêu cầu</span>';
    return `<tr>
      <td><span class="badge ${statusClass(issue.derivedStatus)}">${escapeHtml(issue.derivedStatus)}</span></td>
      <td><strong>${escapeHtml(issue.title)}</strong><small>${escapeHtml(issue.id)}</small></td>
      <td>${issue.uniqueAskers} học viên</td><td>${issue.questionCount} câu</td><td>${evidence}</td>
      <td>${jumpUrl ? `<a href="${jumpUrl}" target="_blank" rel="noreferrer">Mở Discord ↗</a>` : '—'}</td>
    </tr>`;
  }).join('');
}

function renderIssueTable(issues) {
  return `<div class="table"><table><thead><tr><th>Trạng thái</th><th>Issue</th><th>Người hỏi</th><th>Số câu</th><th>Evidence</th><th>Hành động</th></tr></thead><tbody>${renderIssueRows(issues)}</tbody></table></div>`;
}

function authorized(request, username, password) {
  if (!username || !password) return true;
  const actual = Buffer.from(request.headers.authorization || '');
  const expected = Buffer.from(`Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function renderDashboard(issues, {
  now = new Date(),
  stuckAfterHours = 4,
  title = 'TA Course Assistant',
  eyebrow = 'Discord-native · Read-only',
} = {}) {
  const active = issues
    .map(issue => ({ ...issue, derivedStatus: deriveStatus(issue, now, stuckAfterHours) }))
    .filter(issue => issue.derivedStatus !== 'RESOLVED')
    .sort(compareIssues);
  const stuck = active.filter(issue => issue.derivedStatus === 'STUCK').length;
  const questions = active.reduce((total, issue) => total + issue.questionCount, 0);
  const topicCount = new Set(active.map(issue => issue.topics?.[0] || 'other')).size;
  const updated = new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Ho_Chi_Minh' }).format(now);
  const lowPriority = active.filter(issue => issue.uniqueAskers === 1
    && !['high', 'critical'].includes(issue.urgency)
    && !['NEEDS_REVIEW', 'OPEN'].includes(issue.derivedStatus));
  const lowPriorityIds = new Set(lowPriority.map(issue => issue.id));
  const grouped = new Map();
  for (const issue of active.filter(item => !lowPriorityIds.has(item.id))) {
    const topic = TOPIC_LABELS[issue.topics?.[0]] ? issue.topics[0] : 'other';
    if (!grouped.has(topic)) grouped.set(topic, []);
    grouped.get(topic).push(issue);
  }
  const sections = [...grouped.entries()].map(([topic, topicIssues]) => `<section class="topic"><h2>${TOPIC_LABELS[topic]}</h2><p>${topicIssues.length} issue · ${topicIssues.reduce((total, issue) => total + issue.uniqueAskers, 0)} lượt người hỏi</p>${renderIssueTable(topicIssues.sort(compareIssues))}</section>`).join('');
  const lowPrioritySection = lowPriority.length
    ? `<details><summary>Khác / ít phổ biến (${lowPriority.length})</summary>${renderIssueTable(lowPriority.sort(compareIssues))}</details>`
    : '';
  const content = sections || lowPrioritySection || '<section class="table empty">Không có issue đang mở.</section>';

  return `<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="refresh" content="30"><title>${escapeHtml(title)}</title><style>
  :root{color-scheme:dark;--bg:#090c13;--panel:#111827;--line:#263248;--text:#eef2ff;--muted:#94a3b8;--accent:#8b5cf6}*{box-sizing:border-box}body{margin:0;background:radial-gradient(circle at top,#17203a 0,var(--bg) 42%);color:var(--text);font:15px/1.5 system-ui,-apple-system,Segoe UI,sans-serif}main{width:min(1180px,calc(100% - 32px));margin:auto;padding:36px 0}header{display:flex;justify-content:space-between;gap:24px;align-items:end;margin-bottom:24px}nav{display:flex;gap:8px;margin-top:14px}nav a{padding:7px 11px;border:1px solid var(--line);border-radius:999px;text-decoration:none}h1{margin:0;font-size:clamp(26px,4vw,42px);letter-spacing:-.04em}h2{margin:0;font-size:24px}p{margin:6px 0 0;color:var(--muted)}.metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:24px}.metric,.table{background:rgba(17,24,39,.88);border:1px solid var(--line);border-radius:16px;box-shadow:0 20px 60px rgba(0,0,0,.25)}.metric{padding:18px}.metric b{display:block;font-size:30px}.metric span,small,.muted{color:var(--muted)}.topic{margin:26px 0}.topic>.table{margin-top:12px}.table{overflow:auto}details{margin-top:28px}summary{cursor:pointer;font-weight:700;color:#c4b5fd;margin-bottom:12px}table{width:100%;border-collapse:collapse;min-width:820px}th,td{text-align:left;padding:14px 16px;border-bottom:1px solid var(--line)}th{font-size:12px;text-transform:uppercase;letter-spacing:.08em;color:var(--muted)}tr:last-child td{border:0}small{display:block;font-family:ui-monospace,monospace;margin-top:3px}.badge{display:inline-block;padding:4px 9px;border-radius:999px;font-size:12px;font-weight:700;background:#334155}.badge.stuck{background:#7f1d1d;color:#fecaca}.badge.needs_review{background:#713f12;color:#fde68a}.badge.discussing{background:#164e63;color:#a5f3fc}.badge.open{background:#312e81;color:#c7d2fe}a{color:#c4b5fd;text-underline-offset:3px}.missing{color:#fca5a5;font-weight:650}.empty{padding:40px;text-align:center;color:var(--muted)}@media(max-width:800px){header{display:block}.metrics{grid-template-columns:repeat(2,1fr)}main{padding-top:24px}}@media(max-width:520px){.metrics{grid-template-columns:1fr}}
  </style></head><body><main><header><div><p>${escapeHtml(eyebrow)}</p><h1>${escapeHtml(title)}</h1><p>Cập nhật ${escapeHtml(updated)} · tự làm mới sau 30 giây</p><nav aria-label="Chọn dữ liệu"><a href="/">Live</a><a href="/demo">K4 Dataset</a></nav></div></header><section class="metrics" aria-label="Tổng quan"><div class="metric"><b>${topicCount}</b><span>nhóm chủ đề</span></div><div class="metric"><b>${active.length}</b><span>issue đang mở</span></div><div class="metric"><b>${stuck}</b><span>issue bị kẹt</span></div><div class="metric"><b>${questions}</b><span>câu hỏi đang theo dõi</span></div></section>${content}${lowPrioritySection && sections ? lowPrioritySection : ''}</main></body></html>`;
}

export function startDashboard({ db, demoDb = null, host = '127.0.0.1', port = 8787, stuckAfterHours = 4, username = '', password = '', logger = console }) {
  const server = createServer((request, response) => {
    if (!authorized(request, username, password)) {
      response.writeHead(401, {
        'content-type': 'text/plain; charset=utf-8',
        'www-authenticate': 'Basic realm="TA Dashboard"',
        'cache-control': 'no-store',
      });
      response.end('authentication required');
      return;
    }
    if (request.url === '/healthz') {
      response.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
      response.end('ok');
      return;
    }
    const pathname = new URL(request.url, 'http://localhost').pathname;
    if (pathname !== '/' && (pathname !== '/demo' || !demoDb)) {
      response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      response.end('not found');
      return;
    }
    response.writeHead(200, {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
      'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'",
      'x-content-type-options': 'nosniff',
    });
    const isDemo = pathname === '/demo';
    response.end(renderDashboard((isDemo ? demoDb : db).listIssueStats(), {
      stuckAfterHours,
      title: isDemo ? 'K4 Dataset Demo' : 'TA Course Assistant',
      eyebrow: isDemo ? '1.092 tin đã ẩn danh · 12–14/09/2026' : 'Discord-native · Read-only',
    }));
  });
  server.on('error', error => logger.error('dashboard failed', error));
  server.listen(port, host, () => logger.log(`TA dashboard listening on http://${host}:${port}`));
  return server;
}
