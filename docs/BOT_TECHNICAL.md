# Discord TA Bot MVP

Discord-native assistant for the Track B workflow: ingest public messages, extract atomic questions, group logical issues, derive stuck status, and publish a TA digest with jump links.

## Current vertical slice

- Dataset replay for all 1,092 supplied messages.
- Bot/noise filtering.
- Atomic question extraction through an injected LLM client.
- Controlled topic classification and support-relevance filtering.
- SQLite persistence and FTS5 issue retrieval.
- Confidence-based merge, review, or new issue creation.
- Hot topics based on unique askers, not raw message count.
- Derived `STUCK` status and digest rendering.
- Discord `/digest` command and scheduled digest post.
- TA controls to resolve, reopen, or merge issues.
- Reply-based resolution detection with a high-confidence gate.
- Official-source indexing for logistics evidence.
- Automatic 30-day raw-context and LLM-cache retention.

The built-in fake LLM is only for deterministic replay and wiring tests. Live mode uses 9Router.

## Requirements

- Node.js 22.13 or newer.
- A Discord application and bot token.
- Message Content Intent enabled for the bot.
- 9Router reachable through an OpenAI-compatible `/v1/chat/completions` endpoint.

## Local verification

```powershell
npm install
npm test
npm run replay
```

The replay command reads:

```text
../hackathon-data-20260917/data/discord-pack/k4_messages.csv
```

Pass another CSV path as the first argument when needed.

## Configuration

Copy `.env.example` to a secret environment file and set:

```env
DISCORD_BOT_TOKEN=
DISCORD_GUILD_ID=
DISCORD_DIGEST_CHANNEL_ID=
DISCORD_MONITORED_CHANNEL_IDS=channel_id_1,channel_id_2
DISCORD_OFFICIAL_CHANNEL_IDS=official_channel_id
DISCORD_AUTO_REPLY_CHANNEL_IDS=student_qa_channel_id
DISCORD_BACKFILL_LIMIT=100
LLM_BASE_URL=http://127.0.0.1:20128/v1
LLM_MODEL=ag/gemini-3.8-flash-low
DATABASE_PATH=/home/ubuntu/apps/discord-ta-bot/data/bot.db
STUCK_AFTER_HOURS=4
DIGEST_HOUR_VN=20
CONTEXT_RETENTION_DAYS=30
DASHBOARD_HOST=127.0.0.1
DASHBOARD_PORT=8787
DASHBOARD_USER=
DASHBOARD_PASSWORD=
DEMO_DATABASE_PATH=
```

Run live mode:

```bash
node --env-file=.env src/bot.js
```

The bot needs `View Channels`, `Read Message History`, `Send Messages`, `Embed Links`, and application-command access. TA users need `Manage Messages` or `Administrator` to run `/digest`.

TA workflow:

- `/ask question:<câu hỏi>` retrieves official announcements and resolved TA replies with SQLite FTS, then answers only when the LLM can cite retrieved evidence. Otherwise it routes the student back to TA/MOD.
- When `DEMO_DATABASE_PATH` is configured, `/ask` also lists similar historical issues as untrusted reference context without using them as factual evidence.
- `/knowledge add title:<tiêu đề> content:<nội dung> url:<link>` lets a moderator add a verified RAG source immediately.
- `/digest` shows current action items and resolve buttons.
- `/issue resolve id:<issue-id>` and `/issue reopen id:<issue-id>` correct status.
- `/issue merge source:<issue-id> target:<issue-id>` fixes duplicate clustering.
- Messages from a moderator in `DISCORD_OFFICIAL_CHANNEL_IDS` become searchable official evidence; logistics issues without matched evidence are flagged in the digest.
- On startup, the bot backfills up to `DISCORD_BACKFILL_LIMIT` recent messages from each monitored or official channel; use `0` to disable.
- A read-only aggregate dashboard listens on `DASHBOARD_HOST:DASHBOARD_PORT`; keep the default localhost binding. Set both `DASHBOARD_USER` and `DASHBOARD_PASSWORD` before exposing it through an SSH or Cloudflare tunnel.
- Set `DEMO_DATABASE_PATH` to show an isolated replay database at `/demo` without polluting live Discord issues.
- Resolved moderator replies are indexed as 30-day RAG knowledge. Startup and daily retention pruning remove expired messages, answers, issues, and LLM cache from both the live and demo/reference databases.
- `npm run merge-demo` imports demo messages, questions, issues, and links into the live database with `demo:` IDs. The import is idempotent and only copies rows inside `CONTEXT_RETENTION_DAYS`.

## Topic clustering

The extraction prompt first returns `support_relevant`. Announcements, casual chat, quoted policy text without a question, and ordinary replies do not create issues. Each atomic question is normalized to one or more controlled labels:

```text
assignment, deadline, submission, technical, learning_content,
attendance, account_access, schedule, other
```

Unknown labels become `other`; `other` is removed when a specific label is present. Candidate retrieval combines SQLite FTS5 results with recent unresolved issues sharing a controlled topic. The LLM still decides whether the underlying issue matches, so topic overlap alone never triggers a merge.

The dashboard groups actionable issues by primary topic. High-volume, urgent, new, and review-required issues remain expanded; old single-asker items move into the native `Khác / ít phổ biến` disclosure.

## Safe database rebuild

Rebuild always writes a separate SQLite file and refuses to overwrite the source or an existing target:

```bash
npm run rebuild -- data/bot.db data/bot-rebuilt.db
```

The command preserves retained raw messages, classifies existing issue/question bundles in bounded AI batches, performs one compact global clustering pass, then restores official sources and resolved TA answers. Malformed large JSON batches are split automatically. Stop the bot and create an external backup before atomically replacing the production database.

## EC2 deployment

Install under `/home/ubuntu/apps/discord-ta-bot`, keep `.env` mode `600`, then create `/etc/systemd/system/discord-ta-bot.service`:

```ini
[Unit]
Description=Discord TA Bot
After=network-online.target 9router.service

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/home/ubuntu/apps/discord-ta-bot
ExecStart=/usr/bin/node --env-file=.env src/bot.js
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Enable it:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now discord-ta-bot
sudo journalctl -u discord-ta-bot -f
```

## MVP limits

- No Vector DB; SQLite FTS5 is sufficient for the current corpus.
- No automatic public `@TA` mentions.
- No automatic Discord thread creation.
- No per-user memory profile.
- Automatic student-facing answers are restricted to configured channels and require grounded trusted evidence.
- Backfill is intentionally capped at Discord's 100-message fetch limit per channel.
