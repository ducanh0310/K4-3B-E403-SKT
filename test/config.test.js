import assert from 'node:assert/strict';
import test from 'node:test';

import { loadConfig } from '../src/config.js';

test('live mode requires a Discord token', () => {
  assert.throws(() => loadConfig({}, { replay: false }), /DISCORD_BOT_TOKEN/);
});

test('replay mode uses safe defaults without Discord credentials', () => {
  const config = loadConfig({}, { replay: true });
  assert.equal(config.llmModel, 'ag/gemini-3.8-flash-low');
  assert.equal(config.llmBaseUrl, 'http://127.0.0.1:20128/v1');
  assert.equal(config.stuckAfterHours, 4);
  assert.equal(config.contextRetentionDays, 30);
  assert.equal(config.officialChannelIds.size, 0);
  assert.equal(config.backfillLimit, 100);
  assert.equal(config.dashboardHost, '127.0.0.1');
  assert.equal(config.dashboardPort, 8787);
  assert.equal(config.dashboardUser, '');
  assert.equal(config.dashboardPassword, '');
  assert.equal(config.demoDatabasePath, '');
});

test('parses official channels and retention days', () => {
  const config = loadConfig({ DISCORD_OFFICIAL_CHANNEL_IDS: 'A, B', CONTEXT_RETENTION_DAYS: '14', DISCORD_BACKFILL_LIMIT: '25' }, { replay: true });
  assert.deepEqual([...config.officialChannelIds], ['A', 'B']);
  assert.equal(config.contextRetentionDays, 14);
  assert.equal(config.backfillLimit, 25);
});

test('allows disabling backfill and caps Discord fetches at 100', () => {
  assert.equal(loadConfig({ DISCORD_BACKFILL_LIMIT: '0' }, { replay: true }).backfillLimit, 0);
  assert.equal(loadConfig({ DISCORD_BACKFILL_LIMIT: '999' }, { replay: true }).backfillLimit, 100);
});

test('parses dashboard binding and allows disabling it', () => {
  const config = loadConfig({ DASHBOARD_HOST: '0.0.0.0', DASHBOARD_PORT: '0', DASHBOARD_USER: 'ta', DASHBOARD_PASSWORD: 'secret', DEMO_DATABASE_PATH: './data/demo.db' }, { replay: true });
  assert.equal(config.dashboardHost, '0.0.0.0');
  assert.equal(config.dashboardPort, 0);
  assert.equal(config.dashboardUser, 'ta');
  assert.equal(config.dashboardPassword, 'secret');
  assert.match(config.demoDatabasePath, /data[\\/]demo\.db$/);
  assert.throws(() => loadConfig({ DASHBOARD_PORT: '70000' }, { replay: true }), /DASHBOARD_PORT/);
});
