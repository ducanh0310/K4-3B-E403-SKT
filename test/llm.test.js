import assert from 'node:assert/strict';
import test from 'node:test';

import { createLlmClient, parseJsonContent } from '../src/llm.js';

test('parses plain and fenced JSON', () => {
  assert.deepEqual(parseJsonContent('{"ok":true}'), { ok: true });
  assert.deepEqual(parseJsonContent('```json\n{"ok":true}\n```'), { ok: true });
  assert.throws(() => parseJsonContent('not json'), /valid JSON/);
});

test('caches structured responses', async () => {
  let calls = 0;
  const cache = new Map();
  const client = createLlmClient({
    baseUrl: 'http://example.test/v1', model: 'test-model', cache,
    fetchImpl: async () => {
      calls += 1;
      return { ok: true, json: async () => ({ choices: [{ message: { content: '{"questions":[]}' } }] }) };
    },
  });
  assert.deepEqual(await client.completeJson({ purpose: 'extract', input: 'hello' }), { questions: [] });
  assert.deepEqual(await client.completeJson({ purpose: 'extract', input: 'hello' }), { questions: [] });
  assert.equal(calls, 1);
});

test('surfaces HTTP failures', async () => {
  const client = createLlmClient({ baseUrl: 'x', model: 'm', fetchImpl: async () => ({ ok: false, status: 503, text: async () => 'down' }) });
  await assert.rejects(client.completeJson({ purpose: 'x', input: 'y' }), /503/);
});
