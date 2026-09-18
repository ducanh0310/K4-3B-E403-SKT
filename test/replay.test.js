import assert from 'node:assert/strict';
import test from 'node:test';

import { openDatabase } from '../src/database.js';
import { createPipeline } from '../src/pipeline.js';
import { createFakeLlm, replayRows } from '../src/replay.js';

test('fake replay LLM handles all pipeline purposes', async () => {
  const llm = createFakeLlm();
  assert.deepEqual(await llm.completeJson({ purpose: 'assess_resolution', input: {} }), { status: 'NO_CHANGE', confidence: 1 });
  assert.deepEqual(await llm.completeJson({ purpose: 'match_official_source', input: {} }), { supports_answer: false, source_id: null, confidence: 0 });
});

test('replays rows chronologically and produces a digest', async () => {
  const db = openDatabase(':memory:');
  const pipeline = createPipeline({ db, llm: createFakeLlm() });
  const rows = [
    { msg_id: 'M77155', guild: 'G', channel: 'C', author: 'BOT', is_bot: 'True', created_at_vn: '2026-09-13 00:15', reply_to: 'M75012', content: 'Daily muộn không có XP' },
    { msg_id: 'M07416', guild: 'G', channel: 'C', author: 'A', is_bot: 'False', created_at_vn: '2026-09-12 23:54', reply_to: '', content: 'Hạn nộp Lab02?' },
    { msg_id: 'M75012', guild: 'G', channel: 'C', author: 'B', is_bot: 'False', created_at_vn: '2026-09-13 00:15', reply_to: '', content: 'Nộp lab muộn trừ bao nhiêu điểm?' },
  ];
  const result = await replayRows(rows, { pipeline, db, now: new Date('2026-09-13T20:00:00+07:00') });
  assert.equal(result.processed, 2);
  assert.match(result.digest.text, /Lab/);
  db.close();
});
