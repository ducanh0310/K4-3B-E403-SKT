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

function rebuildLlm() {
  return {
    async completeJson({ purpose, input }) {
      if (purpose === 'extract_questions') {
        if (input.content.startsWith('Thông báo')) return { support_relevant: false, questions: [] };
        return { support_relevant: true, questions: [{
          text: input.content,
          title: 'CVAT OPA error',
          summary: 'CVAT không tải policy bundle',
          topics: ['technical'],
          confidence: 0.95,
          urgency: 'normal',
          requires_official_source: false,
        }] };
      }
      if (purpose === 'match_issue') {
        return { same_issue: true, issue_id: input.candidates[0].id, confidence: 0.95 };
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
  source.addOfficialSource({ id: 'SRC', title: 'Lab deadline', content: 'Deadline là 23:59', createdAt: NOW });
  source.createIssue({ id: 'OLD', title: 'Docker startup', summary: 'Docker chưa chạy', topics: ['technical'], status: 'RESOLVED', confidence: 0.95, firstSeen: NOW, lastSeen: NOW });
  source.addIssueAnswer({ id: 'ANSWER:OLD', issueId: 'OLD', title: 'Docker startup', content: 'Hãy restart Docker', createdAt: NOW });
  source.close();

  const result = await rebuildDatabase({
    sourcePath,
    targetPath,
    llm: rebuildLlm(),
    config: { officialChannelIds: new Set() },
  });

  const rebuilt = openDatabase(targetPath);
  assert.equal(result.messages, 3);
  assert.equal(rebuilt.countMessages(), 3);
  assert.deepEqual(rebuilt.searchOfficialSources('deadline', 5).map(item => item.id), ['SRC']);
  assert.deepEqual(rebuilt.searchKnowledge('restart Docker', 5).map(item => item.id), ['ANSWER:OLD']);
  assert.equal(rebuilt.listIssueStats().filter(issue => issue.status !== 'RESOLVED').length, 1);
  rebuilt.close();
});
