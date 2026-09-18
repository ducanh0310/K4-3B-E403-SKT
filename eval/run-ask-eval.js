import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { createAnswerer } from '../src/answer.js';
import { loadConfig } from '../src/config.js';
import { openDatabase } from '../src/database.js';
import { createLlmClient } from '../src/llm.js';

export function evaluateAskResult(item, result) {
  const answer = String(result.answer || '').toLowerCase();
  const expectedKinds = item.expectedKinds || [item.expectedKind];
  const checks = {
    kind: expectedKinds.includes(result.kind),
    source: result.kind !== 'answered' || !item.expectedSourceRequired || Boolean(result.sources?.length),
    keyword: result.kind !== 'answered' || !item.expectedAny?.length || item.expectedAny.some(keyword => answer.includes(String(keyword).toLowerCase())),
  };
  return { pass: Object.values(checks).every(Boolean), checks };
}

function cell(value) {
  return String(value ?? '').replaceAll('|', '\\|').replace(/\s+/g, ' ').trim();
}

function renderReport(rows, generatedAt) {
  const passed = rows.filter(row => row.pass).length;
  const lines = [
    '# `/ask` Evaluation',
    '',
    `Generated: ${generatedAt}`,
    '',
    `Result: **${passed}/${rows.length} passed (${((passed / rows.length) * 100).toFixed(1)}%)**`,
    '',
    '| ID | Category | Expected | Actual | Sources | Pass | Actual answer | TA expected |',
    '|---|---|---|---|---:|:---:|---|---|',
  ];
  for (const row of rows) {
    lines.push(`| ${row.id} | ${row.category} | ${cell(row.expectedKinds?.join(' / ') || row.expectedKind)} | ${row.actualKind} | ${row.sourceCount} | ${row.pass ? '✅' : '❌'} | ${cell(row.answer).slice(0, 240)} | ${cell(row.taExpected)} |`);
  }
  return `${lines.join('\n')}\n`;
}

async function main(env = process.env, argv = process.argv.slice(2)) {
  const config = loadConfig(env, { replay: true });
  const db = openDatabase(config.databasePath);
  const referenceDb = config.demoDatabasePath ? openDatabase(config.demoDatabasePath) : null;
  const llm = createLlmClient({ baseUrl: config.llmBaseUrl, model: config.llmModel });
  const answerer = createAnswerer({ db, referenceDb, llm });
  const cases = JSON.parse(readFileSync(new URL('./ask-cases.json', import.meta.url), 'utf8'));
  const rows = [];
  try {
    for (const item of cases) {
      try {
        const result = await answerer.answer(item.question);
        const evaluation = evaluateAskResult(item, result);
        rows.push({ ...item, ...evaluation, actualKind: result.kind, sourceCount: result.sources?.length || 0, answer: result.answer || '' });
      } catch (error) {
        rows.push({ ...item, pass: false, actualKind: 'error', sourceCount: 0, answer: error.message });
      }
    }
  } finally {
    referenceDb?.close();
    db.close();
  }
  const report = renderReport(rows, new Date().toISOString());
  const outputIndex = argv.indexOf('--output');
  if (outputIndex >= 0 && argv[outputIndex + 1]) writeFileSync(path.resolve(argv[outputIndex + 1]), report);
  process.stdout.write(report);
  process.exitCode = rows.every(row => row.pass) ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) await main();
