# Topic Clustering And Issue Rebuild Design

Date: 2026-09-18

## Goal

Reduce dashboard noise by filtering non-support content, assigning a controlled topic taxonomy, and merging semantically equivalent questions into canonical issues.

## Scope

- Reprocess retained raw Discord messages into clean questions and issues.
- Preserve official sources, resolved TA answers, messages, and LLM cache.
- Replace existing derived `questions`, `issue_questions`, `issue_sources`, and `issues` after a verified backup.
- Group the dashboard by topic and rank actionable issues within each topic.

## Controlled Taxonomy

Every extracted question must use one or more labels from:

- `assignment`
- `deadline`
- `submission`
- `technical`
- `learning_content`
- `attendance`
- `account_access`
- `schedule`
- `other`

Unknown labels are normalized to `other`. `other` is only valid when no specific label applies.

## Processing Workflow

1. Store the raw message idempotently.
2. Apply deterministic noise filters for bots, empty content, acknowledgements, and symbol-only messages.
3. Ask the LLM to return `support_relevant` plus atomic questions using only the controlled taxonomy.
4. Ignore announcements, casual chat, quoted policy text without a question, and ordinary replies that do not report an unresolved incident.
5. Search candidates by normalized topic plus title, summary, and question text.
6. Ask the LLM whether the new question represents the same underlying problem as a candidate.
7. Merge confidence `>= 0.85`; create `NEEDS_REVIEW` for `0.60-0.84`; otherwise create a new canonical issue.
8. Attach official evidence where required.

## Canonical Issue Rules

- Titles describe the underlying problem, not the original sentence.
- Equivalent wording merges even when keywords differ.
- Topic overlap alone is insufficient to merge.
- A multi-question message may link to multiple canonical issues.
- New questions merged into an issue update counts and `last_seen`, but do not replace its stable title.

## Dashboard

- Render sections by primary topic instead of one flat table.
- Show only unresolved actionable issues.
- Within each topic sort by `STUCK`, `NEEDS_REVIEW`, unique askers, question count, then recency.
- Show topic totals and issue totals separately.
- Collapse low-priority single-asker issues under an expandable “Khác / ít phổ biến” section.
- Keep jump links and evidence state on each issue.

## Rebuild Safety

1. Stop the bot to prevent concurrent writes.
2. Create a timestamped SQLite backup outside the application tree.
3. Build a new database copy from retained messages using the updated pipeline.
4. Preserve official sources and TA answers.
5. Run integrity checks and compare message/source counts.
6. Atomically replace the production database only after tests and rebuild checks pass.
7. Restart the bot and verify dashboard and Discord login.

## Acceptance Criteria

- Announcements and casual chat do not appear as issues.
- Extracted topics contain no values outside the controlled taxonomy.
- Known variants such as CVAT OPA/policy bundle wording merge into one issue.
- Logistics questions group under the correct topic and retain evidence requirements.
- Dashboard renders grouped topic sections instead of a 200+ row flat list.
- Existing trusted RAG sources and resolved TA answers remain available after rebuild.
- Unsupported questions remain tracked without an automatic speculative answer.

## Deliberate Simplifications

- Keep SQLite FTS5; add no vector database at the current corpus size.
- Do not create Discord threads automatically.
- Do not fine-tune the model; corrections continue through canonical issue merges and trusted knowledge.
