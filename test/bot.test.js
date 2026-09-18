import assert from 'node:assert/strict';
import test from 'node:test';

import { acknowledgeSavedSource, autoReplyWithRag, backfillChannels, buildAskCommand, buildIssueCommand, buildJumpUrl, buildKnowledgeCommand, buildResolveComponents, buildSplitProposalComponents, isDigestAuthorized, normalizeDiscordMessage, pruneContextDatabases, vnDateHour } from '../src/bot.js';

test('builds Discord jump URLs and normalizes messages', () => {
  assert.equal(buildJumpUrl('G', 'C', 'M'), 'https://discord.com/channels/G/C/M');
  const normalized = normalizeDiscordMessage({
    id: 'M', content: 'hello', guildId: 'G', channelId: 'C', createdAt: new Date('2026-09-18T08:00:00Z'),
    author: { id: 'A', bot: false }, member: { roles: { cache: new Map([['R', { name: 'TA' }]]) } }, reference: { messageId: 'P' },
  });
  assert.equal(normalized.authorId, 'A');
  assert.deepEqual(normalized.authorRoles, ['TA']);
  assert.equal(normalized.replyTo, 'P');
  assert.equal(normalized.isModerator, true);
});

test('authorizes digest for moderators or the configured guild', () => {
  assert.equal(isDigestAuthorized({ guildId: 'G', memberPermissions: { has: () => true } }, 'G'), true);
  assert.equal(isDigestAuthorized({ guildId: 'X', memberPermissions: { has: () => false } }, 'G'), false);
});

test('builds TA issue controls', () => {
  const command = buildIssueCommand().toJSON();
  assert.equal(command.name, 'issue');
  assert.deepEqual(command.options.map(option => option.name), ['resolve', 'reopen', 'merge', 'analyze', 'move']);
  const rows = buildResolveComponents([{ id: 'I1' }, { id: 'I2' }]);
  assert.equal(rows.length, 1);
  assert.deepEqual(rows[0].toJSON().components.map(button => button.custom_id), ['issue:resolve:I1', 'issue:resolve:I2']);
});

test('builds split proposal controls', () => {
  const components = buildSplitProposalComponents('P1', 'https://dashboard.test/?proposal=P1')[0].toJSON().components;
  assert.deepEqual(components.map(item => item.custom_id || item.url), ['issue:split-confirm:P1', 'issue:split-cancel:P1', 'https://dashboard.test/?proposal=P1']);
});

test('builds a public ask command with a required question', () => {
  const command = buildAskCommand().toJSON();
  assert.equal(command.name, 'ask');
  assert.equal(command.options[0].name, 'question');
  assert.equal(command.options[0].required, true);
});

test('builds a moderator knowledge command', () => {
  const command = buildKnowledgeCommand().toJSON();
  assert.equal(command.name, 'knowledge');
  assert.equal(command.options[0].name, 'add');
  assert.deepEqual(command.options[0].options.map(option => option.name), ['title', 'content', 'url']);
});

test('formats Vietnam date and hour with Node 22 compatible options', () => {
  assert.deepEqual(vnDateHour(new Date('2026-09-18T13:30:00Z')), { date: '2026-09-18', hour: 20 });
});

test('prunes live and demo context with the same retention cutoff', () => {
  const calls = [];
  const db = { pruneBefore: cutoff => calls.push(['live', cutoff]) };
  const demoDb = { pruneBefore: cutoff => calls.push(['demo', cutoff]) };
  pruneContextDatabases({ db, demoDb, days: 30, now: new Date('2026-09-18T00:00:00.000Z') });
  assert.deepEqual(calls, [
    ['live', '2026-08-19T00:00:00.000Z'],
    ['demo', '2026-08-19T00:00:00.000Z'],
  ]);
});

test('backfills channel messages oldest first and deduplicates channel ids', async () => {
  const message = (id, minute) => ({
    id, guildId: 'G', channelId: 'C', content: id, createdAt: new Date(`2026-09-18T08:0${minute}:00Z`), createdTimestamp: minute,
    author: { id: 'A', bot: false }, member: { roles: { cache: new Map() } }, channel: { isThread: () => false },
  });
  const fetched = new Map([['M2', message('M2', 2)], ['M1', message('M1', 1)]]);
  const client = { channels: { fetch: async () => ({ isTextBased: () => true, messages: { fetch: async options => {
    assert.deepEqual(options, { limit: 25 });
    return fetched;
  } } }) } };
  const seen = [];
  const result = await backfillChannels({ client, pipeline: { processMessage: async value => seen.push(value.id) }, channelIds: ['C', 'C'], limit: 25, logger: { error() {} } });
  assert.deepEqual(seen, ['M1', 'M2']);
  assert.deepEqual(result, { channels: 1, messages: 2, errors: 0 });
});

test('acknowledges a saved official source', async () => {
  const reactions = [];
  await acknowledgeSavedSource({ react: async emoji => reactions.push(emoji) }, { kind: 'official_source_saved' });
  await acknowledgeSavedSource({ react: async emoji => reactions.push(emoji) }, { kind: 'processed' });
  assert.deepEqual(reactions, ['✅']);
});

test('auto replies only to processed questions in enabled channels with grounded answers', async () => {
  const replies = [];
  const message = { channelId: 'AUTO', content: 'Demo Lab Alpha hạn lúc nào?', reply: async payload => replies.push(payload) };
  const answerer = { answer: async () => ({ kind: 'answered', answer: '23:59 ngày 25/09/2026.', sources: [{ title: 'Demo Lab Alpha' }] }) };
  const replied = await autoReplyWithRag({
    message,
    result: { kind: 'processed', issues: [{ id: 'I1' }] },
    answerer,
    channelIds: new Set(['AUTO']),
  });
  assert.equal(replied, true);
  assert.equal(replies.length, 1);
  assert.deepEqual(replies[0].allowedMentions, { parse: [], repliedUser: false });
});

test('does not auto reply without evidence or outside enabled channels', async () => {
  let calls = 0;
  const answerer = { answer: async () => { calls += 1; return { kind: 'needs_ta', sources: [] }; } };
  const message = { channelId: 'AUTO', content: 'Unknown', reply: async () => assert.fail('must not reply') };
  assert.equal(await autoReplyWithRag({ message, result: { kind: 'processed', issues: [{}] }, answerer, channelIds: new Set(['AUTO']) }), false);
  assert.equal(await autoReplyWithRag({ message: { ...message, channelId: 'OTHER' }, result: { kind: 'processed', issues: [{}] }, answerer, channelIds: new Set(['AUTO']) }), false);
  assert.equal(calls, 1);
});
