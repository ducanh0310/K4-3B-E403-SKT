import assert from 'node:assert/strict';
import test from 'node:test';

import { parseCsv } from '../src/csv.js';

test('parses quoted commas, newlines, and escaped quotes', () => {
  const rows = parseCsv('a,b,c\n1,"two, parts","line 1\nline 2"\n2,"say ""hi""",ok\n');
  assert.deepEqual(rows, [
    { a: '1', b: 'two, parts', c: 'line 1\nline 2' },
    { a: '2', b: 'say "hi"', c: 'ok' },
  ]);
});

test('accepts the Discord dataset header', () => {
  const header = 'msg_id,guild,channel,author,is_bot,msg_type,created_at_vn,reply_to,mentions_bot,n_attachments,n_chars,content\n';
  assert.deepEqual(parseCsv(header), []);
});
