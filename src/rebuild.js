import { existsSync, rmSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { loadConfig } from './config.js';
import { openDatabase } from './database.js';
import { createLlmClient } from './llm.js';
import { createPipeline } from './pipeline.js';

export async function rebuildDatabase({ sourcePath, targetPath, llm, config = {} }) {
  const sourceFile = path.resolve(sourcePath);
  const targetFile = path.resolve(targetPath);
  if (sourceFile === targetFile) throw new Error('Source and target database paths must differ');
  if (existsSync(targetFile)) throw new Error(`Target database already exists: ${targetFile}`);

  const source = openDatabase(sourceFile);
  let target;
  try {
    const messages = source.listMessages();
    const officialSources = source.listOfficialSources();
    const answerBundles = source.listResolvedAnswerBundles();
    target = openDatabase(targetFile);
    const pipeline = createPipeline({
      db: target,
      llm,
      officialChannelIds: config.officialChannelIds || new Set(),
    });

    for (const message of messages) await pipeline.processMessage(message);
    for (const officialSource of officialSources) target.addOfficialSource(officialSource);
    for (const bundle of answerBundles) {
      const issueId = target.getIssue(bundle.issue.id) ? `knowledge:${bundle.issue.id}` : bundle.issue.id;
      target.createIssue({ ...bundle.issue, id: issueId, status: 'RESOLVED' });
      target.addIssueAnswer({ ...bundle.answer, issueId });
    }

    return {
      messages: target.countMessages(),
      questions: target.countQuestions(),
      issues: target.listIssueStats().length,
      officialSources: officialSources.length,
      answers: answerBundles.length,
    };
  } catch (error) {
    target?.close();
    target = null;
    rmSync(targetFile, { force: true });
    throw error;
  } finally {
    target?.close();
    source.close();
  }
}

async function main() {
  const sourcePath = process.argv[2];
  const targetPath = process.argv[3];
  if (!sourcePath || !targetPath) throw new Error('Usage: npm run rebuild -- <source-db> <target-db>');
  const config = loadConfig(process.env, { replay: true });
  const llm = createLlmClient({ baseUrl: config.llmBaseUrl, model: config.llmModel });
  const result = await rebuildDatabase({ sourcePath, targetPath, llm, config });
  console.log(JSON.stringify(result));
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) await main();
