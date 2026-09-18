import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Client,
  GatewayIntentBits,
  PermissionFlagsBits,
  REST,
  Routes,
  SlashCommandBuilder,
} from 'discord.js';

import { loadConfig } from './config.js';
import { createAnswerer, formatAnswer } from './answer.js';
import { openDatabase } from './database.js';
import { startDashboard } from './dashboard.js';
import { buildDigest } from './digest.js';
import { createLlmClient } from './llm.js';
import { createPipeline } from './pipeline.js';
import { createIssueManager } from './issue-manager.js';

export function buildJumpUrl(guildId, channelId, messageId) {
  return `https://discord.com/channels/${guildId}/${channelId}/${messageId}`;
}

export function vnDateHour(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const get = type => parts.find(part => part.type === type)?.value;
  return { date: `${get('year')}-${get('month')}-${get('day')}`, hour: Number(get('hour')) };
}

export function normalizeDiscordMessage(message) {
  const authorRoles = [...(message.member?.roles?.cache?.values?.() || [])].map(role => role.name);
  const roleNames = new Set(authorRoles.map(role => role.toLowerCase()));
  return {
    id: message.id,
    guildId: message.guildId || '',
    channelId: message.channelId,
    threadId: message.channel?.isThread?.() ? message.channelId : '',
    authorId: message.author.id,
    authorRoles,
    isModerator: Boolean(
      message.member?.permissions?.has?.(PermissionFlagsBits.ManageMessages)
      || message.member?.permissions?.has?.(PermissionFlagsBits.Administrator)
      || ['ta', 'mod', 'coach', 'admin'].some(role => roleNames.has(role))
    ),
    isBot: Boolean(message.author.bot),
    content: message.content || '',
    replyTo: message.reference?.messageId || null,
    createdAt: message.createdAt.toISOString(),
    jumpUrl: buildJumpUrl(message.guildId, message.channelId, message.id),
  };
}

export function buildIssueCommand() {
  const issueId = option => option.setName('id').setDescription('Issue ID trong digest').setRequired(true);
  return new SlashCommandBuilder()
    .setName('issue')
    .setDescription('Sửa trạng thái hoặc gom issue')
    .addSubcommand(command => command.setName('resolve').setDescription('Đánh dấu đã giải quyết').addStringOption(issueId))
    .addSubcommand(command => command.setName('reopen').setDescription('Mở lại issue').addStringOption(issueId))
    .addSubcommand(command => command.setName('merge').setDescription('Gom hai issue trùng nhau')
      .addStringOption(option => option.setName('source').setDescription('Issue cần nhập').setRequired(true))
      .addStringOption(option => option.setName('target').setDescription('Issue giữ lại').setRequired(true)))
    .addSubcommand(command => command.setName('analyze').setDescription('Đề xuất tách issue bằng AI').addStringOption(issueId))
    .addSubcommand(command => command.setName('move').setDescription('Chuyển một câu hỏi sang issue khác')
      .addStringOption(option => option.setName('question').setDescription('Question ID').setRequired(true))
      .addStringOption(option => option.setName('target').setDescription('Issue đích').setRequired(true)));
}

export function buildAskCommand() {
  return new SlashCommandBuilder()
    .setName('ask')
    .setDescription('Hỏi bot bằng nguồn chính thức và câu trả lời TA')
    .addStringOption(option => option.setName('question').setDescription('Câu hỏi cần hỗ trợ').setRequired(true));
}

export function buildKnowledgeCommand() {
  return new SlashCommandBuilder()
    .setName('knowledge')
    .setDescription('Quản lý nguồn RAG đã được TA xác minh')
    .addSubcommand(command => command.setName('add').setDescription('Thêm một nguồn chính thức')
      .addStringOption(option => option.setName('title').setDescription('Tiêu đề nguồn').setRequired(true).setMaxLength(120))
      .addStringOption(option => option.setName('content').setDescription('Nội dung đã xác minh').setRequired(true).setMaxLength(4_000))
      .addStringOption(option => option.setName('url').setDescription('Link nguồn HTTPS').setRequired(false).setMaxLength(500)));
}

export function buildResolveComponents(actionItems) {
  const buttons = actionItems.slice(0, 5).map((issue, index) => new ButtonBuilder()
    .setCustomId(`issue:resolve:${issue.id}`)
    .setLabel(`✓ #${index + 1}`)
    .setStyle(ButtonStyle.Success));
  return buttons.length ? [new ActionRowBuilder().addComponents(buttons)] : [];
}

export function buildSplitProposalComponents(proposalId, dashboardUrl = '') {
  const buttons = [
    new ButtonBuilder().setCustomId(`issue:split-confirm:${proposalId}`).setLabel('Confirm All').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`issue:split-cancel:${proposalId}`).setLabel('Cancel').setStyle(ButtonStyle.Secondary),
  ];
  if (dashboardUrl) buttons.push(new ButtonBuilder().setLabel('Open Dashboard Review').setStyle(ButtonStyle.Link).setURL(dashboardUrl));
  return [new ActionRowBuilder().addComponents(buttons)];
}

export async function backfillChannels({ client, pipeline, channelIds, limit, logger = console }) {
  if (!limit) return { channels: 0, messages: 0, errors: 0 };
  let channels = 0;
  let messages = 0;
  let errors = 0;
  for (const channelId of new Set(channelIds)) {
    try {
      const channel = await client.channels.fetch(channelId);
      if (!channel?.isTextBased() || !channel.messages?.fetch) continue;
      const fetched = await channel.messages.fetch({ limit });
      const ordered = [...fetched.values()].sort((left, right) =>
        (left.createdTimestamp ?? left.createdAt.getTime()) - (right.createdTimestamp ?? right.createdAt.getTime()));
      for (const message of ordered) await pipeline.processMessage(normalizeDiscordMessage(message));
      channels += 1;
      messages += ordered.length;
    } catch (error) {
      errors += 1;
      logger.error(`backfill failed for channel ${channelId}`, error);
    }
  }
  return { channels, messages, errors };
}

export async function acknowledgeSavedSource(message, result) {
  if (result.kind === 'official_source_saved') await message.react('✅');
}

export async function autoReplyWithRag({ message, result, answerer, channelIds }) {
  if (!channelIds.has(message.channelId) || result.kind !== 'processed' || !result.issues?.length) return false;
  const answer = await answerer.answer(message.content);
  if (answer.kind !== 'answered') return false;
  await message.reply({
    content: formatAnswer(answer),
    allowedMentions: { parse: [], repliedUser: false },
  });
  return true;
}

function buildDigestPayload(db, config, now = new Date()) {
  const digest = buildDigest(db.listIssueStats(), { now, stuckAfterHours: config.stuckAfterHours });
  return { content: digest.text.slice(0, 1_990), components: buildResolveComponents(digest.actionItems) };
}

export function isDigestAuthorized(interaction, configuredGuildId) {
  return interaction.guildId === configuredGuildId && Boolean(
    interaction.memberPermissions?.has(PermissionFlagsBits.ManageMessages)
    || interaction.memberPermissions?.has(PermissionFlagsBits.Administrator),
  );
}

async function registerCommands(config, applicationId) {
  const digest = new SlashCommandBuilder().setName('digest').setDescription('Xem TA digest hiện tại');
  await new REST({ version: '10' }).setToken(config.discordToken)
    .put(Routes.applicationGuildCommands(applicationId, config.guildId), { body: [buildAskCommand().toJSON(), digest.toJSON(), buildIssueCommand().toJSON(), buildKnowledgeCommand().toJSON()] });
}

function retentionCutoff(days, now = new Date()) {
  return new Date(now.getTime() - days * 86_400_000).toISOString();
}

export function pruneContextDatabases({ db, demoDb = null, days, now = new Date() }) {
  const cutoff = retentionCutoff(days, now);
  const live = db.pruneBefore(cutoff);
  const demo = demoDb ? demoDb.pruneBefore(cutoff) : null;
  return { cutoff, live, demo };
}

export async function startBot(env = process.env) {
  const config = loadConfig(env);
  const db = openDatabase(config.databasePath);
  const demoDb = config.demoDatabasePath ? openDatabase(config.demoDatabasePath) : null;
  const llm = createLlmClient({ baseUrl: config.llmBaseUrl, model: config.llmModel, cache: db });
  const answerer = createAnswerer({ db, referenceDb: demoDb, llm });
  const pipeline = createPipeline({ db, llm, officialChannelIds: config.officialChannelIds });
  const issueManager = createIssueManager({ db, llm });
  const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });
  let lastDigestDate = '';
  let lastPruneDate = vnDateHour(new Date()).date;
  pruneContextDatabases({ db, demoDb, days: config.contextRetentionDays });
  db.backfillIssueAnswers();
  const dashboard = config.dashboardPort ? startDashboard({
    db,
    demoDb,
    host: config.dashboardHost,
    port: config.dashboardPort,
    stuckAfterHours: config.stuckAfterHours,
    username: config.dashboardUser,
    password: config.dashboardPassword,
    publicOrigin: config.dashboardPublicUrl,
    issueManager,
  }) : null;

  client.on('messageCreate', async message => {
    if (config.monitoredChannelIds.size
      && !config.monitoredChannelIds.has(message.channelId)
      && !config.officialChannelIds.has(message.channelId)) return;
    try {
      const result = await pipeline.processMessage(normalizeDiscordMessage(message));
      await acknowledgeSavedSource(message, result);
      await autoReplyWithRag({ message, result, answerer, channelIds: config.autoReplyChannelIds });
    }
    catch (error) { console.error('message processing failed', message.id, error); }
  });

  client.on('interactionCreate', async interaction => {
    try {
      const isIssueButton = interaction.isButton() && interaction.customId.startsWith('issue:');
      const isIssueCommand = interaction.isChatInputCommand() && interaction.commandName === 'issue';
      const isDigestCommand = interaction.isChatInputCommand() && interaction.commandName === 'digest';
      const isAskCommand = interaction.isChatInputCommand() && interaction.commandName === 'ask';
      const isKnowledgeCommand = interaction.isChatInputCommand() && interaction.commandName === 'knowledge';
      if (!isIssueButton && !isIssueCommand && !isDigestCommand && !isAskCommand && !isKnowledgeCommand) return;
      if (isAskCommand) {
        await interaction.deferReply({ ephemeral: true });
        const result = await answerer.answer(interaction.options.getString('question', true));
        await interaction.editReply({ content: formatAnswer(result), allowedMentions: { parse: [] } });
        return;
      }
      if (!isDigestAuthorized(interaction, config.guildId)) {
        await interaction.reply({ content: 'Bạn không có quyền thao tác TA digest.', ephemeral: true });
        return;
      }

      if (isKnowledgeCommand) {
        const title = interaction.options.getString('title', true).trim();
        const content = interaction.options.getString('content', true).trim();
        const rawUrl = interaction.options.getString('url')?.trim() || '';
        if (!title || !content) throw new Error('Title và content không được để trống.');
        if (rawUrl && new URL(rawUrl).protocol !== 'https:') throw new Error('URL nguồn phải dùng HTTPS.');
        db.addOfficialSource({ id: `manual:${interaction.id}`, title, content, sourceUrl: rawUrl, createdAt: new Date().toISOString() });
        await interaction.reply({ content: `Đã thêm nguồn RAG: **${title}**`, ephemeral: true, allowedMentions: { parse: [] } });
        return;
      }

      if (isDigestCommand) {
        await interaction.reply({ ...buildDigestPayload(db, config), ephemeral: true });
        return;
      }

      if (isIssueButton) {
        if (interaction.customId.startsWith('issue:split-confirm:')) {
          const proposalId = interaction.customId.slice('issue:split-confirm:'.length);
          const issues = issueManager.applyProposal(proposalId);
          await interaction.reply({ content: `Đã tách thành ${issues.length} issue.`, ephemeral: true });
          return;
        }
        if (interaction.customId.startsWith('issue:split-cancel:')) {
          const proposalId = interaction.customId.slice('issue:split-cancel:'.length);
          issueManager.cancelProposal(proposalId);
          await interaction.reply({ content: 'Đã hủy đề xuất tách.', ephemeral: true });
          return;
        }
        const id = interaction.customId.slice('issue:resolve:'.length);
        db.updateIssueStatus(id, 'RESOLVED');
        await interaction.reply({ content: `Đã đánh dấu ${id} là RESOLVED.`, ephemeral: true });
        return;
      }

      const action = interaction.options.getSubcommand();
      if (action === 'analyze') {
        await interaction.deferReply({ ephemeral: true });
        const id = interaction.options.getString('id', true);
        const proposal = await issueManager.analyze(id);
        const lines = proposal.groups.map((group, index) => `${index + 1}. **${group.title}** — ${group.questionIds.length} câu · ${Math.round(group.confidence * 100)}%`);
        const reviewUrl = config.dashboardPublicUrl ? `${config.dashboardPublicUrl}/?proposal=${encodeURIComponent(proposal.id)}` : '';
        await interaction.editReply({ content: `Đề xuất tách **${id}**:\n${lines.join('\n')}\n\n${proposal.unassignedQuestionIds.length} câu giữ lại để review.`, components: buildSplitProposalComponents(proposal.id, reviewUrl), allowedMentions: { parse: [] } });
        return;
      }
      if (action === 'move') {
        const questionId = interaction.options.getString('question', true);
        const targetId = interaction.options.getString('target', true);
        issueManager.moveQuestions({ questionIds: [questionId], targetId });
        await interaction.reply({ content: `Đã chuyển ${questionId} vào ${targetId}.`, ephemeral: true });
        return;
      }
      if (action === 'merge') {
        const source = interaction.options.getString('source', true);
        const target = interaction.options.getString('target', true);
        db.mergeIssues(source, target);
        await interaction.reply({ content: `Đã gom ${source} vào ${target}.`, ephemeral: true });
        return;
      }
      const id = interaction.options.getString('id', true);
      db.updateIssueStatus(id, action === 'resolve' ? 'RESOLVED' : 'OPEN');
      await interaction.reply({ content: `Đã cập nhật ${id}: ${action === 'resolve' ? 'RESOLVED' : 'OPEN'}.`, ephemeral: true });
    } catch (error) {
      console.error('interaction failed', error);
      const content = `Không thể cập nhật: ${error.message}`;
      if (interaction.deferred && !interaction.replied) await interaction.editReply({ content, allowedMentions: { parse: [] } });
      else if (interaction.replied) await interaction.followUp({ content, ephemeral: true, allowedMentions: { parse: [] } });
      else await interaction.reply({ content, ephemeral: true });
    }
  });

  client.once('clientReady', async readyClient => {
    try {
      await registerCommands(config, readyClient.application.id);
      const result = await backfillChannels({
        client: readyClient,
        pipeline,
        channelIds: [...config.monitoredChannelIds, ...config.officialChannelIds],
        limit: config.backfillLimit,
      });
      console.log(`Discord TA bot logged in as ${readyClient.user.tag}; backfilled ${result.messages} messages from ${result.channels} channels (${result.errors} errors)`);
    } catch (error) {
      console.error('client initialization failed', error);
    }
  });

  setInterval(async () => {
    const now = new Date();
    const { date, hour } = vnDateHour(now);
    if (date !== lastPruneDate) {
      pruneContextDatabases({ db, demoDb, days: config.contextRetentionDays, now });
      lastPruneDate = date;
    }
    if (hour !== config.digestHourVn || date === lastDigestDate || !config.digestChannelId) return;
    const channel = await client.channels.fetch(config.digestChannelId);
    if (channel?.isTextBased()) {
      await channel.send(buildDigestPayload(db, config, now));
      lastDigestDate = date;
    }
  }, 60_000).unref();

  await client.login(config.discordToken);
  return { client, db, demoDb, dashboard };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) await startBot();
