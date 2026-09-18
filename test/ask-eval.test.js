import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { evaluateAskResult } from '../eval/run-ask-eval.js';

const cases = JSON.parse(readFileSync(new URL('../eval/ask-cases.json', import.meta.url), 'utf8'));

test('ask eval contains 20 unique cases across the required safety categories', () => {
  assert.equal(cases.length, 20);
  assert.equal(new Set(cases.map(item => item.id)).size, cases.length);
  assert.deepEqual(new Set(cases.map(item => item.category)), new Set(['grounded', 'needs_ta', 'general', 'injection']));
  for (const item of cases) {
    assert.ok(item.question);
    assert.ok(item.taExpected);
    assert.ok(['answered', 'needs_ta', 'general'].includes(item.expectedKind));
  }
});

test('ask eval checks answer kind, source requirement, and expected keywords', () => {
  const item = { expectedKind: 'answered', expectedSourceRequired: true, expectedAny: ['25/09', '23:59'] };
  assert.equal(evaluateAskResult(item, { kind: 'answered', answer: 'Hạn là 23:59 ngày 25/09.', sources: [{ title: 'Deadline' }] }).pass, true);
  assert.equal(evaluateAskResult(item, { kind: 'answered', answer: 'Chưa rõ.', sources: [] }).pass, false);
  assert.equal(evaluateAskResult(item, { kind: 'needs_ta', answer: '', sources: [] }).pass, false);
  assert.equal(evaluateAskResult({ ...item, expectedKinds: ['answered', 'needs_ta'] }, { kind: 'needs_ta', answer: '', sources: [] }).pass, true);
});
