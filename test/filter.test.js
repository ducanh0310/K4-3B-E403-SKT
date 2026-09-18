import assert from 'node:assert/strict';
import test from 'node:test';

import { classifyMessage } from '../src/filter.js';

test('filters bots, empty content, emoji-only content, and acknowledgements', () => {
  assert.equal(classifyMessage({ isBot: true, content: 'question' }).kind, 'ignore');
  assert.equal(classifyMessage({ isBot: false, content: '   ' }).kind, 'ignore');
  assert.equal(classifyMessage({ isBot: false, content: '😂🔥' }).kind, 'ignore');
  assert.equal(classifyMessage({ isBot: false, content: 'em cảm ơn ạ' }).kind, 'ignore');
});

test('keeps ordinary questions and technical incident descriptions', () => {
  assert.equal(classifyMessage({ isBot: false, content: 'Lab 2 hạn mấy giờ?' }).kind, 'candidate');
  assert.equal(classifyMessage({ isBot: false, content: 'OPA chưa lấy được policy bundle, health check báo 500' }).kind, 'candidate');
});

test('marks moderator announcements as official source candidates', () => {
  assert.equal(classifyMessage({ isBot: false, authorRoles: ['TA'], content: 'Deadline Lab 2 là 23:59' }).kind, 'official_source_candidate');
});
