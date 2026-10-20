# Email Warmer

Controlled two-mailbox email warming. Mailbox A (warmup) sends real messages over its own SMTP server to
Mailbox B (target); the target's IMAP inbox is checked to confirm actual delivery and whether the message
landed in the Inbox or Spam. Optionally, B sends a real reply back to A.

See `PROJECT.md` (product/UI) and `BACKEND.md` (backend contract).

## How warmup works

- **Schedule**: within the active hours of your timezone, sends are spaced randomly between the minimum
  and maximum delay. The worker plans each day and enforces the daily limit server-side.
- **Gradual ramp-up** (on by default): day 1 sends the starting volume, then adds the daily increase each
  day until it reaches the daily limit.
- **Delivery verification**: after a send, the worker searches the target's INBOX and Junk folder by
  Message-ID (then test ID). Only an actual IMAP match marks a message *Received*; after ~2 hours without a
  match it becomes *Timeout*.
- **Replies**: when enabled, a real reply is sent from the target 2–15 minutes after receipt.
- **Delivery track**: the Warmup page and Dashboard show today's sends on a timeline, with each message's
  progress (Scheduled → Sent → Inbox/Spam → Replied) updating live.
- An SMTP authentication failure during warmup pauses the schedule automatically.

## Email content

Messages are written from templates in `backend/src/modules/warmup/templates/library.ts`: 36 opening messages
(casual, professional, informational, technical) and a reply written for each one, 72 in total.

- **Selection:** when the scheduler plans a message, it picks a template that none of the config's recent
  messages used, and a category different from the previous message's. The choice is stored on the message
  (`templateId`). Manual **Test Send** uses the technical templates only.
- **Placeholders:** `{{sender_name}}`, `{{recipient_first_name}}`, `{{weekday}}`, `{{active_window}}` and others,
  listed in `TEMPLATE_VARIABLES` in `templates/index.ts`. Names come from the mailbox addresses
  (`jordan.lee@…` → "Jordan Lee").
- **Replies:** the target answers with the reply written for the original's template, threaded with
  `In-Reply-To`/`References` and quoting the original.
- **Footer:** every message ends with a short footer naming Email Warmer and the test ID, so the content stays
  truthful and the inbox check can still find a message by its body.
- **Adding a template:** add an entry to `EMAIL_TEMPLATES` plus a matching entry in `REPLY_TEMPLATES`
  (`replyTo` set to the new id). `npm test` checks ids, placeholders and that every opener has a reply.
- **Example:** `npm run templates:sample` writes a 20-message A ↔ B exchange to
  `backend/docs/sample-conversation.md`.

## Running locally

Requirements: Node 20+, PostgreSQL, Redis.

```bash
# 1. Backend
cd backend
cp .env.example .env          # set DATABASE_URL, REDIS_URL, APP_ENCRYPTION_KEY, JWT_SECRET
npm install
npx prisma migrate dev        # create the database schema
npm run dev                   # API on :4000
npm run dev:worker            # in a second terminal: scheduler + send/receive/reply workers

# 2. Frontend (repo root)
npm install
npm run dev                   # http://localhost:3000, /api is proxied to the backend
```

Create an account on the login page, connect both mailboxes, run **Test Connection** on each, then
**Start Warmup**. The worker process must be running for scheduled sends, inbox checks and replies.

Set `BACKEND_URL` for the frontend if the API is not on `http://localhost:4000`.

## Backend scripts

| Script | Purpose |
|---|---|
| `npm run dev` / `npm run dev:worker` | API / worker with reload |
| `npm run build`, `npm start`, `npm run start:worker` | Production build and run |
| `npm test` | Unit tests (scheduler, timezones, error normalization, encryption) |
| `npm run typecheck` | TypeScript check |

`docker compose up` (in `backend/`) runs Postgres, Redis, the API (applies migrations on start) and the worker.
# email_warmer
