# Issue Split, Move, and AI Reclassification Design

**Date:** 2026-09-19

## Goal

Allow TA/Mod users to correct over-broad issue clusters from both Discord and the dashboard while keeping AI changes review-first. Extract the dashboard UI into editable static files so it can be upgraded without rewriting the Node.js server renderer.

## Scope

This feature adds:

- AI-generated split proposals for existing issues.
- TA-approved issue splitting.
- Moving one or more atomic questions between issues.
- Dashboard actions protected by existing Basic Auth and CSRF validation.
- Discord commands and buttons for analysis, confirmation, and manual moves.
- Static dashboard files under `public/`.
- Stricter issue-matching rules based on intent, entity, requested action, and error identity.

This feature does not add Discord OAuth, React, Vite, automatic unreviewed splitting, write access to the demo dataset, or automatic evidence copying.

## User Roles

### Student

- Continues using `/ask` and normal support messages.
- Does not receive issue-management permissions.

### TA/Mod

- Requires Discord `Manage Messages` or `Administrator` for management commands.
- Uses the authenticated dashboard for detailed review and bulk actions.
- Makes the final decision before an AI split changes the database.

## Classification Model

The pipeline keeps the controlled multi-label topics:

- `assignment`
- `deadline`
- `submission`
- `technical`
- `learning_content`
- `attendance`
- `account_access`
- `schedule`
- `other`

Topic overlap alone is insufficient for merging. Classification and clustering must consider:

1. Student intent.
2. Affected entity, such as Lab 2, CVAT, Docker, attendance, or a course phase.
3. Requested action, such as lookup, appeal, submit, activate, or troubleshoot.
4. Exact error identity or observable symptom.
5. Course, cohort, phase, assignment, or policy scope.

Examples:

- “Where can I see attendance?” and “My attendance is incorrect” share the `attendance` topic but remain separate issues.
- “OPA policy bundle error” and “CVAT cannot load the policy bundle” may be the same issue despite different wording.
- “Lab 2 deadline” and “Lab 3 deadline” remain separate because the affected assignment differs.

AI split groups below `0.75` confidence remain in the original issue for manual review.

## AI Split Proposal Workflow

1. TA opens an issue and requests analysis.
2. The server sends the issue title, summary, topics, and atomic questions to the LLM.
3. The LLM returns proposed groups containing:
   - Stable proposal group key.
   - Suggested title and summary.
   - Controlled topics.
   - Question IDs.
   - Confidence.
   - Short rationale.
4. The server validates that every returned question belongs to the source issue and appears at most once.
5. Missing, duplicated, unknown, or low-confidence question IDs remain in the original issue.
6. The validated proposal is cached with a generated proposal ID.
7. No issue or question is changed until a TA confirms the proposal.

The proposal cache uses the existing `llm_cache` storage and retention rather than adding a new table.

## Applying a Split

The split request contains:

- Source issue ID.
- Proposal ID.
- Group selected to retain the original issue ID.
- Accepted groups with editable title, summary, topics, and question IDs.

The database applies the split in one SQLite transaction:

1. Validate the source issue and all question memberships again.
2. Keep one accepted group on the original issue ID.
3. Create one new issue for each additional accepted group.
4. Move `issue_questions` links to their selected issue.
5. Leave unselected and low-confidence questions in the original issue.
6. Rebuild issue search indexes.
7. Set new issues to `NEEDS_REVIEW`.
8. Preserve message IDs, question IDs, authors, timestamps, and Discord jump links.

Official evidence remains attached only to the original issue. New issues do not inherit evidence automatically because a source may not support every split group.

The operation is reversible by moving questions back or merging the generated issue into the original issue.

## Moving Questions

A TA may move one or more questions without running AI analysis.

Supported destinations:

- An existing issue.
- A newly created issue with a TA-provided title and topics.

Validation rules:

- Every question must exist.
- Every question must currently belong to the declared source issue.
- The destination must exist unless a new issue is requested.
- Demo/reference database questions cannot be changed.
- Empty source issues are deleted after their search entries and links are cleaned up.
- All changes occur in one transaction.

## Discord Interface

### Analyze an issue

```text
/issue analyze id:<issue-id>
```

The bot responds ephemerally with group counts, confidence, and sample titles.

Actions:

- `Open Dashboard Review`: opens the detailed proposal editor.
- `Confirm All`: applies only validated groups at or above the confidence threshold.
- `Cancel`: discards the proposal without database changes.

### Move a question

```text
/issue move question:<question-id> target:<issue-id>
```

The command moves one question to an existing issue. Bulk moves and creation of a new destination issue are handled in the dashboard to avoid oversized slash-command forms.

### Existing commands

The existing `resolve`, `reopen`, and `merge` subcommands remain unchanged.

## Dashboard Interface

The current server-rendered dashboard is replaced with editable static assets:

```text
public/dashboard.html
public/dashboard.css
public/dashboard.js
```

The Node.js server remains responsible for authentication, API responses, CSRF validation, database access, and serving static assets.

### Layout

- Left navigation: live/demo selector, topic filters, status filters, and search.
- Main list: issue cards sorted by operational priority.
- Detail panel: issue metadata, official sources, atomic questions, and representative Discord links.
- Review panel: AI proposal groups and unassigned questions.

### Optimized actions

- One-click `Analyze with AI` from an issue detail panel.
- Checkboxes for bulk question selection.
- Destination dropdown for moving selected questions.
- Inline title and topic editing for proposed groups.
- `Confirm Split` button with a final confirmation summary.
- Existing `Resolve`, `Merge`, and `Open Discord` actions in the same detail panel.
- Loading, success, and error states that do not require a page reload.

Drag-and-drop is deliberately excluded. Checkboxes and dropdowns are more accessible, easier to validate, and simpler to maintain.

The `/demo` view remains strictly read-only and does not render mutation controls.

## HTTP API

Read endpoints:

```text
GET /api/issues
GET /api/issues/:id
GET /api/split-proposals/:id
```

Mutation endpoints:

```text
POST /api/issues/:id/analyze
POST /api/issues/:id/split
POST /api/questions/move
POST /api/issues/merge
POST /api/issues/:id/resolve
POST /api/issues/:id/reopen
```

All mutation endpoints require:

- Valid dashboard Basic Auth credentials.
- A server-generated CSRF token sent in a custom request header.
- A matching same-origin request.
- JSON content type.
- Schema and membership validation.

The server returns JSON errors with a stable `error` code and a user-readable `message`.

## Security and Data Integrity

- Dashboard credentials are never embedded in static JavaScript.
- The CSRF token is generated by the server and injected into the authenticated dashboard response.
- Mutation APIs reject requests from the demo route and reference database.
- User content is rendered with `textContent`, not `innerHTML`.
- Discord URLs are accepted only from the expected HTTPS Discord hosts.
- Split and move operations use SQLite transactions.
- LLM output is untrusted and validated against database-owned question IDs.
- Discord interaction responses remain ephemeral for management previews.

## Status and Evidence Rules

- Newly created split issues start as `NEEDS_REVIEW`.
- The original issue keeps its existing status unless the TA changes it.
- Moving a question does not automatically resolve either issue.
- New split issues do not inherit official sources.
- Merging issues retains the existing merge behavior for questions, topics, status, and evidence.

## Testing

Database tests cover:

- Moving questions between existing issues.
- Moving questions into a new issue.
- Rejecting questions outside the source issue.
- Deleting an empty source issue.
- Applying a split atomically.
- Leaving low-confidence or unselected questions in the original issue.
- Not copying evidence to generated issues.

AI tests cover:

- Validation of duplicate, missing, and unknown question IDs.
- Separation by intent and affected entity despite shared topics.
- Preservation of uncertain questions for TA review.

Dashboard tests cover:

- Authenticated static UI delivery.
- CSRF rejection and acceptance.
- Read-only demo behavior.
- Analyze, split, move, merge, resolve, and reopen API responses.
- HTML escaping and safe Discord links.

Discord tests cover:

- Command registration.
- Permission checks.
- Ephemeral proposal previews.
- Confirm and cancel button handling.
- Manual move responses.

## Operational Result

TA users can correct a broad cluster such as “attendance questions” into separate lookup, appeal, and policy issues without editing SQLite directly. AI reduces the sorting work, but the TA remains the final authority. The standalone UI files give the project owner a clear surface for future visual upgrades without introducing a frontend build system.
