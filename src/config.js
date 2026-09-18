import path from 'node:path';

function positiveNumber(value, fallback, name) {
  const parsed = value === undefined || value === '' ? fallback : Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) throw new Error(`${name} must be a positive number`);
  return parsed;
}

function nonNegativeNumber(value, fallback, name) {
  const parsed = value === undefined || value === '' ? fallback : Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) throw new Error(`${name} must be a non-negative number`);
  return parsed;
}

function portNumber(value, fallback, name) {
  const parsed = nonNegativeNumber(value, fallback, name);
  if (parsed > 65_535) throw new Error(`${name} must be between 0 and 65535`);
  return parsed;
}

export function loadConfig(env = process.env, { replay = false } = {}) {
  if (!replay && !env.DISCORD_BOT_TOKEN) throw new Error('DISCORD_BOT_TOKEN is required in live mode');

  return {
    discordToken: env.DISCORD_BOT_TOKEN || '',
    guildId: env.DISCORD_GUILD_ID || '',
    digestChannelId: env.DISCORD_DIGEST_CHANNEL_ID || '',
    monitoredChannelIds: new Set((env.DISCORD_MONITORED_CHANNEL_IDS || '').split(',').map(v => v.trim()).filter(Boolean)),
    officialChannelIds: new Set((env.DISCORD_OFFICIAL_CHANNEL_IDS || '').split(',').map(v => v.trim()).filter(Boolean)),
    autoReplyChannelIds: new Set((env.DISCORD_AUTO_REPLY_CHANNEL_IDS || '').split(',').map(v => v.trim()).filter(Boolean)),
    llmBaseUrl: (env.LLM_BASE_URL || 'http://127.0.0.1:20128/v1').replace(/\/$/, ''),
    llmModel: env.LLM_MODEL || 'ag/gemini-3.8-flash-low',
    databasePath: path.resolve(env.DATABASE_PATH || './data/bot.db'),
    stuckAfterHours: positiveNumber(env.STUCK_AFTER_HOURS, 4, 'STUCK_AFTER_HOURS'),
    digestHourVn: positiveNumber(env.DIGEST_HOUR_VN, 20, 'DIGEST_HOUR_VN'),
    contextRetentionDays: positiveNumber(env.CONTEXT_RETENTION_DAYS, 30, 'CONTEXT_RETENTION_DAYS'),
    backfillLimit: Math.min(100, nonNegativeNumber(env.DISCORD_BACKFILL_LIMIT, 100, 'DISCORD_BACKFILL_LIMIT')),
    dashboardHost: env.DASHBOARD_HOST || '127.0.0.1',
    dashboardPort: portNumber(env.DASHBOARD_PORT, 8787, 'DASHBOARD_PORT'),
    dashboardUser: env.DASHBOARD_USER || '',
    dashboardPassword: env.DASHBOARD_PASSWORD || '',
    demoDatabasePath: env.DEMO_DATABASE_PATH ? path.resolve(env.DEMO_DATABASE_PATH) : '',
  };
}
