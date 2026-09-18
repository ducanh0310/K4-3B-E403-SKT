import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { openDatabase } from '../src/database.js';
import { rebuildDatabase } from '../src/rebuild.js';

const NOW = '2026-09-18T08:00:00+07:00';

function message(id, content, createdAt) {
  return { id, guildId: 'G', channelId: 'C', authorId: id, authorRoles: [], isBot: false, content, createdAt };
}

function rebuildLlm(calls) {
  return {
    async completeJson({ purpose, input }) {
      calls.push(purpose);
      if (purpose === 'classify_issue_batch') {
        return { issues: input.issues.map(issue => ({
          id: issue.id,
          support_relevant: issue.id !== 'I3',
          canonical_title: 'CVAT OPA error',
          canonical_summary: 'CVAT không tải policy bundle',
          topics: ['technical'],
        })) };
      }
      if (purpose === 'cluster_issue_batch') {
        return { issues: input.issues.map(issue => ({
          id: issue.id,
          group_key: 'technical:cvat-opa-error',
          group_title: 'CVAT OPA error',
        })) };
      }
      throw new Error(`Unexpected rebuild purpose: ${purpose}`);
    },
  };
}

test('rebuilds clustered issues while preserving trusted knowledge', async t => {
  const directory = mkdtempSync(path.join(tmpdir(), 'discord-ta-rebuild-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const sourcePath = path.join(directory, 'source.db');
  const targetPath = path.join(directory, 'target.db');
  const source = openDatabase(sourcePath);
  source.insertMessage(message('M1', 'CVAT báo lỗi OPA', NOW));
  source.insertMessage(message('M2', 'Policy bundle không tải', '2026-09-18T08:05:00+07:00'));
  source.insertMessage(message('M3', 'Thông báo workshop tối nay', '2026-09-18T08:10:00+07:00'));
  for (const [id, messageId, text, topic] of [
    ['Q1', 'M1', 'CVAT báo lỗi OPA', 'technical'],
    ['Q2', 'M2', 'Policy bundle không tải', 'technical'],
    ['Q3', 'M3', 'Thông báo workshop tối nay', 'other'],
  ]) source.insertQuestion({ id, messageId, authorId: messageId, text, topics: [topic], confidence: 0.8, createdAt: NOW });
  source.createIssue({ id: 'I1', title: 'CVAT OPA lỗi', summary: 'OPA lỗi', topics: ['technical'], status: 'OPEN', confidence: 0.8, firstSeen: NOW, lastSeen: NOW });
  source.createIssue({ id: 'I2', title: 'Policy bundle', summary: 'Bundle không tải', topics: ['technical'], status: 'OPEN', confidence: 0.8, firstSeen: NOW, lastSeen: NOW });
  source.createIssue({ id: 'I3', title: 'Thông báo workshop', summary: 'Workshop tối nay', topics: ['other'], status: 'OPEN', confidence: 0.8, firstSeen: NOW, lastSeen: NOW });
  source.linkQuestion('I1', 'Q1');
  source.linkQuestion('I2', 'Q2');
  source.linkQuestion('I3', 'Q3');
  for (let index = 4; index <= 27; index += 1) {
    const messageId = `M${index}`;
    const questionId = `Q${index}`;
    const issueId = `I${index}`;
    source.insertMessage(message(messageId, `CVAT policy lỗi ${index}`, `2026-09-18T08:${String(index).padStart(2, '0')}:00+07:00`));
    source.insertQuestion({ id: questionId, messageId, authorId: messageId, text: `CVAT policy lỗi ${index}`, topics: ['technical'], confidence: 0.8, createdAt: NOW });
    source.createIssue({ id: issueId, title: `CVAT policy lỗi ${index}`, summary: `Policy lỗi ${index}`, topics: ['technical'], status: 'OPEN', confidence: 0.8, firstSeen: NOW, lastSeen: NOW });
    source.linkQuestion(issueId, questionId);
  }
  source.addOfficialSource({ id: 'SRC', title: 'Lab deadline', content: 'Deadline là 23:59', createdAt: NOW });
  source.createIssue({ id: 'OLD', title: 'Docker startup', summary: 'Docker chưa chạy', topics: ['technical'], status: 'RESOLVED', confidence: 0.95, firstSeen: NOW, lastSeen: NOW });
  source.addIssueAnswer({ id: 'ANSWER:OLD', issueId: 'OLD', title: 'Docker startup', content: 'Hãy restart Docker', createdAt: NOW });
  source.close();

  const calls = [];
  const result = await rebuildDatabase({
    sourcePath,
    targetPath,
    llm: rebuildLlm(calls),
    config: { officialChannelIds: new Set() },
  });

  const rebuilt = openDatabase(targetPath);
  assert.equal(result.messages, 27);
  assert.equal(rebuilt.countMessages(), 27);
  assert.deepEqual(rebuilt.searchOfficialSources('deadline', 5).map(item => item.id), ['SRC']);
  assert.deepEqual(rebuilt.searchKnowledge('restart Docker', 5).map(item => item.id), ['ANSWER:OLD']);
  assert.equal(rebuilt.listIssueStats().filter(issue => issue.status !== 'RESOLVED').length, 1);
  assert.deepEqual(calls, ['classify_issue_batch', 'classify_issue_batch', 'cluster_issue_batch']);
  rebuilt.close();
});
