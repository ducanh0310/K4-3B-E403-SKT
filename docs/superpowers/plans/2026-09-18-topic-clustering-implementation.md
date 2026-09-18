# Topic Clustering And Issue Rebuild Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert noisy retained Discord messages into controlled topic labels, canonical merged issues, and a topic-grouped dashboard without losing trusted RAG knowledge.

**Architecture:** Keep SQLite FTS5 and the existing LLM client. Tighten the extraction contract, normalize labels at the trust boundary, widen candidate retrieval with same-topic issues, render grouped dashboard sections, and rebuild a fresh SQLite database from retained messages before an atomic production swap.

**Tech Stack:** Node.js 22, `node:sqlite`, Discord.js, 9Router OpenAI-compatible API, Node test runner, systemd.

---

## File Map

- Modify `src/pipeline.js`: enforce support relevance, controlled topics, canonical titles, and topic-aware matching.
- Modify `src/database.js`: provide topic-aware candidates and safe rebuild export/import helpers.
- Modify `src/dashboard.js`: group active issues by primary topic and collapse low-priority items.
- Create `src/rebuild.js`: rebuild a new database from retained messages and preserved trusted knowledge.
- Modify `package.json`: add the `rebuild` command.
- Modify `test/pipeline.test.js`: cover noise rejection, label normalization, and semantic merging.
- Modify `test/database.test.js`: cover topic-aware candidate retrieval and rebuild data export.
- Modify `test/dashboard.test.js`: cover grouped sections and low-priority collapse.
- Create `test/rebuild.test.js`: cover preservation and replacement behavior using temporary databases.
- Modify `docs/BOT_TECHNICAL.md`: document taxonomy and safe rebuild command.

### Task 1: Controlled Taxonomy And Support Relevance

**Files:**
- Modify: `src/pipeline.js`
- Test: `test/pipeline.test.js`

- [ ] **Step 1: Write failing normalization and noise tests**

Add tests proving that an announcement returns no issues, unknown labels normalize to `other`, duplicate labels are removed, and `other` is removed when a specific label exists.

```js
test('rejects non-support content and normalizes topics', async () => {
  const db = openDatabase(':memory:');
  const pipeline = createPipeline({ db, llm: fakeLlm([
    { support_relevant: false, questions: [] },
    { support_relevant: true, questions: [{
      text: 'Lab 2 nộp ở đâu?', title: 'Lab 2 submission', summary: 'Nơi nộp Lab 2',
      topics: ['submission', 'UNKNOWN', 'submission', 'other'], confidence: 0.95,
      urgency: 'normal', requires_official_source: true,
    }] },
  ]) });
  assert.equal((await pipeline.processMessage(message({ id: 'ANN', content: 'Thông báo workshop tối nay' }))).issues.length, 0);
  const result = await pipeline.processMessage(message({ id: 'Q', content: 'Lab 2 nộp ở đâu?' }));
  assert.deepEqual(result.issues[0].topics, ['submission']);
  db.close();
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node --test test/pipeline.test.js`

Expected: FAIL because the current extraction contract ignores `support_relevant` and accepts arbitrary topics.

- [ ] **Step 3: Add the minimal controlled taxonomy implementation**

In `src/pipeline.js`, export a fixed taxonomy and normalize at the LLM boundary:

```js
export const TOPICS = new Set([
  'assignment', 'deadline', 'submission', 'technical', 'learning_content',
  'attendance', 'account_access', 'schedule', 'other',
]);

export function normalizeTopics(values) {
  const topics = [...new Set((Array.isArray(values) ? values : []).map(String).filter(topic => TOPICS.has(topic)))];
  const specific = topics.filter(topic => topic !== 'other');
  return specific.length ? specific : ['other'];
}
```

Update `normalizeQuestion()` to call `normalizeTopics()`. Update the extraction system prompt to require `support_relevant`, canonical issue titles, and only controlled labels. Return `{ kind: 'ignored', reason: 'not_support_request', issues: [] }` when support relevance is false or no questions are extracted.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run: `node --test test/pipeline.test.js`

Expected: all pipeline tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/pipeline.js test/pipeline.test.js
git commit -m "feat: enforce support taxonomy"
```

### Task 2: Topic-Aware Candidate Retrieval And Canonical Merge

**Files:**
- Modify: `src/database.js`
- Modify: `src/pipeline.js`
- Test: `test/database.test.js`
- Test: `test/pipeline.test.js`

- [ ] **Step 1: Write failing candidate and merge tests**

Add a database test where `CVAT OPA error` is returned for a `technical` question even when the wording is `policy bundle không tải`. Add a pipeline test proving both wordings link to the same issue after an LLM match.

```js
test('finds candidates by controlled topic when wording differs', () => {
  const db = openDatabase(':memory:');
  db.createIssue({ id: 'cvat', title: 'CVAT OPA error', summary: 'OPA không tải policy bundle', topics: ['technical'], status: 'OPEN', confidence: 0.9, firstSeen: NOW, lastSeen: NOW });
  const candidates = db.findIssueCandidates({ title: 'Policy service failure', text: 'Bundle không tải', topics: ['technical'] }, 12);
  assert.deepEqual(candidates.map(item => item.id), ['cvat']);
  db.close();
});
```

- [ ] **Step 2: Run focused tests and verify RED**

Run: `node --test test/database.test.js test/pipeline.test.js`

Expected: FAIL because `findIssueCandidates()` does not exist.

- [ ] **Step 3: Implement combined FTS and same-topic retrieval**

Add `findIssueCandidates(question, limit = 12)` to `src/database.js`. Combine `searchIssues()` results with unresolved issues whose JSON topic string contains any controlled topic, deduplicate by id, and cap the final array. Use prepared statements and bound parameters only.

Update `src/pipeline.js` to call:

```js
const candidates = db.findIssueCandidates(question, 12);
```

Strengthen the match prompt to compare underlying user intent, affected object, requested action, and error identity. Explicitly forbid merging merely because the primary topic matches.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run: `node --test test/database.test.js test/pipeline.test.js`

Expected: all focused tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/database.js src/pipeline.js test/database.test.js test/pipeline.test.js
git commit -m "feat: retrieve issue candidates by topic"
```

### Task 3: Group Dashboard By Primary Topic

**Files:**
- Modify: `src/dashboard.js`
- Test: `test/dashboard.test.js`

- [ ] **Step 1: Write failing grouped-dashboard tests**

Create issues in `technical`, `deadline`, and `other`. Assert that HTML contains topic section headings, puts CVAT under Technical, and places a one-asker `other` issue inside a `<details>` block labelled `Khác / ít phổ biến`.

```js
assert.match(html, /<h2[^>]*>Technical<\/h2>/);
assert.match(html, /<h2[^>]*>Deadline<\/h2>/);
assert.match(html, /<summary>Khác \/ ít phổ biến \(1\)<\/summary>/);
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node --test test/dashboard.test.js`

Expected: FAIL because the dashboard currently renders one flat table.

- [ ] **Step 3: Implement grouped rendering**

Add a fixed Vietnamese label map and use the first controlled label as the primary topic. Split active issues into prominent items and low-priority items where `uniqueAskers === 1`, `urgency` is not high/critical, and status is neither `NEEDS_REVIEW` nor newly open under four hours. Render one accessible section per populated topic and a native `<details>` block for low-priority items.

Sort each section by status weight (`STUCK`, `NEEDS_REVIEW`, `DISCUSSING`, `OPEN`), unique askers, question count, and `lastSeen`.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run: `node --test test/dashboard.test.js`

Expected: all dashboard tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/dashboard.js test/dashboard.test.js
git commit -m "feat: group dashboard issues by topic"
```

### Task 4: Safe Database Rebuild Command

**Production adjustment:** Runtime measurements showed that serial raw-message replay would take roughly two hours. The implemented rebuild preserves all raw messages, batch-classifies existing issue/question bundles, and performs a compact global clustering pass. This keeps the same acceptance criteria while reducing LLM calls from hundreds to a small bounded set.

**Files:**
- Modify: `src/database.js`
- Create: `src/rebuild.js`
- Modify: `package.json`
- Create: `test/rebuild.test.js`

- [ ] **Step 1: Write the failing rebuild test**

Create a temporary source DB containing retained messages, an official source, and a resolved issue answer. Run `rebuildDatabase()` into a separate target path with a deterministic fake LLM. Assert that the target contains fewer canonical issues, the same official source, the same searchable TA answer, and the same retained message count.

```js
assert.equal(target.countMessages(), source.countMessages());
assert.deepEqual(target.searchOfficialSources('deadline', 5).map(item => item.id), ['SRC']);
assert.deepEqual(target.searchKnowledge('restart Docker', 5).map(item => item.id), ['ANSWER:OLD']);
assert.equal(target.listIssueStats().filter(issue => issue.status !== 'RESOLVED').length, 1);
```

- [ ] **Step 2: Run the rebuild test and verify RED**

Run: `node --test test/rebuild.test.js`

Expected: FAIL because the rebuild module and database export helpers do not exist.

- [ ] **Step 3: Add minimal export/import helpers**

Add these database methods with plain parsed objects:

```js
listMessages()
listOfficialSources()
listResolvedAnswerBundles()
countMessages()
```

`listResolvedAnswerBundles()` returns each answer plus its resolved issue so the target can recreate the hidden resolved issue before inserting the answer and satisfying the foreign key.

- [ ] **Step 4: Implement rebuild into a separate target file**

Export `rebuildDatabase({ sourcePath, targetPath, llm, config })` from `src/rebuild.js`. Refuse identical resolved paths, refuse an existing target path, open both databases, replay retained messages chronologically through `createPipeline()`, copy official sources idempotently, then recreate resolved answer bundles after replay. Close both databases in `finally`.

The CLI accepts:

```text
node --env-file=.env src/rebuild.js <source-db> <target-db>
```

Add to `package.json`:

```json
"rebuild": "node --env-file=.env src/rebuild.js"
```

- [ ] **Step 5: Run rebuild and full tests**

Run: `node --test test/rebuild.test.js`

Expected: rebuild test passes.

Run: `npm test`

Expected: all tests pass with zero failures.

- [ ] **Step 6: Commit**

```bash
git add src/database.js src/rebuild.js package.json test/rebuild.test.js
git commit -m "feat: rebuild clustered issue database"
```

### Task 5: Documentation And Local Replay Verification

**Files:**
- Modify: `docs/BOT_TECHNICAL.md`

- [ ] **Step 1: Document taxonomy and rebuild procedure**

Document the nine controlled labels, `support_relevant` behavior, topic-aware candidate matching, and the rule that rebuild always writes a separate database file.

- [ ] **Step 2: Run a local rebuild against a copied database**

Run:

```powershell
Copy-Item data/bot.db data/bot-rebuild-source.db
npm run rebuild -- data/bot-rebuild-source.db data/bot-rebuilt.db
```

Expected: command exits zero and prints source/target counts without exposing secrets.

- [ ] **Step 3: Inspect rebuilt issue distribution**

Run a read-only Node query that prints counts by primary topic and status. Confirm that labels are controlled and active issue count is materially below the current 221-item dashboard.

- [ ] **Step 4: Run final verification**

Run: `npm test`

Expected: all tests pass.

Run: `git diff --check`

Expected: no output and exit code zero.

- [ ] **Step 5: Commit**

```bash
git add docs/BOT_TECHNICAL.md
git commit -m "docs: explain clustered issue rebuild"
```

### Task 6: Production Backup, Rebuild, Swap, And Deploy

**Files:**
- Deploy modified application files to `/home/ubuntu/apps/discord-ta-bot`
- Preserve production DB at `/home/ubuntu/backups/discord-ta-bot-<timestamp>.db`

- [ ] **Step 1: Upload code without secrets or database files**

Upload only tracked changed source, test, package, and documentation files. Do not upload `.env`, SSH keys, webhook URLs, or local SQLite files.

- [ ] **Step 2: Test deployed code before touching production DB**

Run on EC2:

```bash
cd /home/ubuntu/apps/discord-ta-bot
npm test
```

Expected: all tests pass.

- [ ] **Step 3: Stop writes and create an external backup**

Run:

```bash
sudo systemctl stop discord-ta-bot.service
timestamp=$(date +%Y%m%dT%H%M%S)
cp data/bot.db "/home/ubuntu/backups/discord-ta-bot-$timestamp.db"
```

Expected: backup exists outside the application tree.

- [ ] **Step 4: Build and verify a replacement DB**

Run:

```bash
rm -f data/bot-rebuilt.db
npm run rebuild -- data/bot.db data/bot-rebuilt.db
node --input-type=module -e "import { openDatabase } from './src/database.js'; const db=openDatabase('./data/bot-rebuilt.db'); console.log(db.listIssueStats().length); db.close();"
```

Expected: rebuild exits zero and the new issue count is lower than the old noisy count while trusted source counts match.

- [ ] **Step 5: Atomically swap and restart**

Run:

```bash
mv data/bot.db data/bot-pre-cluster.db
mv data/bot-rebuilt.db data/bot.db
sudo systemctl start discord-ta-bot.service
systemctl is-active discord-ta-bot.service
```

Expected: `active`.

- [ ] **Step 6: Verify runtime and dashboard**

Run:

```bash
journalctl -u discord-ta-bot.service -n 40 --no-pager
curl -fsS http://127.0.0.1:18787/healthz
```

Expected: Discord login succeeds, backfill reports no errors, health endpoint returns `ok`, and the dashboard shows grouped topic sections.

- [ ] **Step 7: Push and verify SHA**

Run:

```bash
git push origin main
git rev-parse HEAD
git ls-remote origin refs/heads/main
```

Expected: local and remote SHA match.
