# BACKEND.md — Email Warmer Backend Contract

> **BACKEND SOURCE OF TRUTH**
>
> This document defines backend implementation.
> `PROJECT.md` defines the overall product and UI.
>
> Do not invent provider behavior.
> Do not fake email operations.
> Do not expose credentials.
> Ask before making a major architectural change.

---

# 1. BACKEND OBJECTIVE

Build a secure backend for a controlled two-mailbox email-warming / deliverability-testing application.

Mailbox A:

```text
Warmup Mailbox
```

Mailbox B:

```text
Target Mailbox
```

The backend sends real messages from A to B and verifies actual receipt through B's IMAP server.

---

# 2. ARCHITECTURE

```text
Frontend
   │
   │ HTTPS
   ▼
API Server
   │
   ├─────────────── PostgreSQL
   │
   └─────────────── Redis
                       │
                       ▼
                    BullMQ
                       │
                       ▼
                     Worker
                    /      \
                 SMTP      IMAP
                  │          │
                  ▼          ▼
               Mailbox A  Mailbox B
```

V1 is a modular monolith.

Do not create microservices.

---

# 3. STACK

Required:

```text
Node.js
TypeScript
Fastify or Express
PostgreSQL
Prisma
Redis
BullMQ
Nodemailer
ImapFlow
mailparser
Zod
Pino
```

---

# 4. DIRECTORY STRUCTURE

```text
backend/
├── src/
│   ├── app.ts
│   ├── server.ts
│   │
│   ├── config/
│   │   ├── env.ts
│   │   └── constants.ts
│   │
│   ├── db/
│   │   └── prisma.ts
│   │
│   ├── modules/
│   │   ├── mailboxes/
│   │   │   ├── mailbox.controller.ts
│   │   │   ├── mailbox.service.ts
│   │   │   ├── mailbox.repository.ts
│   │   │   └── mailbox.schema.ts
│   │   │
│   │   ├── smtp/
│   │   │   ├── smtp.service.ts
│   │   │   └── smtp.types.ts
│   │   │
│   │   ├── imap/
│   │   │   ├── imap.service.ts
│   │   │   └── imap.types.ts
│   │   │
│   │   ├── warmup/
│   │   │   ├── warmup.controller.ts
│   │   │   ├── warmup.service.ts
│   │   │   ├── scheduler.service.ts
│   │   │   └── warmup.schema.ts
│   │   │
│   │   └── events/
│   │       ├── event.service.ts
│   │       └── event.repository.ts
│   │
│   ├── queues/
│   │   ├── connection.ts
│   │   ├── queues.ts
│   │   └── workers/
│   │       ├── send.worker.ts
│   │       ├── receive.worker.ts
│   │       └── reply.worker.ts
│   │
│   ├── security/
│   │   ├── encryption.ts
│   │   └── redaction.ts
│   │
│   ├── middleware/
│   │   ├── auth.ts
│   │   ├── error-handler.ts
│   │   └── rate-limit.ts
│   │
│   └── utils/
│       ├── errors.ts
│       ├── logger.ts
│       └── ids.ts
│
├── prisma/
│   └── schema.prisma
│
├── tests/
│   ├── smtp.test.ts
│   ├── imap.test.ts
│   ├── warmup.test.ts
│   └── scheduler.test.ts
│
├── Dockerfile
├── docker-compose.yml
├── package.json
├── tsconfig.json
└── .env.example
```

---

# 5. ENVIRONMENT VARIABLES

```env
NODE_ENV=development
PORT=4000

DATABASE_URL=
REDIS_URL=

APP_ENCRYPTION_KEY=
JWT_SECRET=

LOG_LEVEL=info
```

Never commit real values.

`APP_ENCRYPTION_KEY` must be a strong secret.

---

# 6. DATABASE

Use PostgreSQL + Prisma.

Minimum models:

```text
User
Mailbox
WarmupConfig
WarmupMessage
Event
```

---

# 7. USER

Production API must be authenticated.

Conceptual model:

```ts
User {
  id
  email
  passwordHash
  createdAt
  updatedAt
}
```

Passwords must be hashed using an appropriate password hashing algorithm.

Never store plaintext user passwords.

---

# 8. MAILBOX MODEL

Conceptually:

```ts
Mailbox {
  id: string
  userId: string

  type: "WARMUP" | "TARGET"

  email: string

  smtpHost?: string
  smtpPort?: number
  smtpSecurity?: "SSL" | "STARTTLS" | "NONE"
  smtpUsername?: string
  encryptedSmtpPassword?: string

  imapHost?: string
  imapPort?: number
  imapSecurity?: "SSL" | "STARTTLS" | "NONE"
  imapUsername?: string
  encryptedImapPassword?: string

  smtpEnabled: boolean
  imapEnabled: boolean

  status:
    "PENDING"
    | "CONNECTED"
    | "ERROR"
    | "DISABLED"

  lastSmtpTestAt?: Date
  lastImapTestAt?: Date

  createdAt: Date
  updatedAt: Date
}
```

Never return encrypted passwords from the API.

---

# 9. WARMUP CONFIG

Conceptually:

```ts
WarmupConfig {
  id: string

  userId: string

  warmupMailboxId: string
  targetMailboxId: string

  enabled: boolean

  dailyLimit: number

  minDelayMinutes: number
  maxDelayMinutes: number

  activeStartHour: number
  activeEndHour: number

  timezone: string

  repliesEnabled: boolean

  createdAt: Date
  updatedAt: Date
}
```

The backend must ensure:

```text
warmupMailbox.type === WARMUP
targetMailbox.type === TARGET
```

The target recipient must always equal the configured target mailbox.

---

# 10. WARMUP MESSAGE

Conceptually:

```ts
WarmupMessage {
  id: string

  warmupConfigId: string

  messageId?: string
  testId: string

  subject: string

  status:
    | "SCHEDULED"
    | "SENDING"
    | "SENT"
    | "RECEIVED"
    | "BOUNCED"
    | "FAILED"
    | "TIMEOUT"

  scheduledAt: Date

  sentAt?: Date
  receivedAt?: Date

  errorCode?: string
  errorMessage?: string

  createdAt: Date
  updatedAt: Date
}
```

---

# 11. EVENT

Conceptually:

```ts
Event {
  id: string

  warmupMessageId?: string

  type:
    | "SCHEDULED"
    | "SMTP_CONNECTED"
    | "SMTP_SEND_STARTED"
    | "SMTP_SENT"
    | "IMAP_CONNECTED"
    | "MESSAGE_RECEIVED"
    | "REPLY_SENT"
    | "FAILED"

  metadata: Json

  createdAt: Date
}
```

Metadata must never contain passwords, tokens, or other secrets.

---

# 12. CREDENTIAL ENCRYPTION

Mailbox SMTP/IMAP passwords must be encrypted at rest.

Use authenticated encryption such as AES-256-GCM.

Conceptual API:

```ts
encryptSecret(value)
decryptSecret(payload)
```

Stored record must include enough information to decrypt safely:

```text
ciphertext
iv
authTag
```

Never log:

```text
password
ciphertext
decrypted secret
```

Do not send passwords back to the browser after creation.

---

# 13. SMTP SERVICE

Use Nodemailer.

Responsibilities:

```text
createTransport
verifyConnection
sendMessage
normalizeError
```

Transport configuration must come from the mailbox.

Conceptually:

```ts
{
  host,
  port,
  secure,
  auth: {
    user,
    pass
  }
}
```

Do not hardcode:

```text
smtp.hostinger.com
smtp.gmail.com
smtp.office365.com
```

Provider-specific values belong to the user's mailbox configuration.

---

# 14. SMTP CONNECTION TEST

Endpoint:

```http
POST /api/mailboxes/:id/test-smtp
```

Flow:

```text
Authenticate user
        ↓
Load mailbox
        ↓
Verify ownership
        ↓
Decrypt password
        ↓
Create transporter
        ↓
Verify SMTP
        ↓
Store test result
        ↓
Write event
        ↓
Return normalized result
```

Authentication failure:

```json
{
  "success": false,
  "error": {
    "code": "SMTP_AUTH_FAILED",
    "message": "SMTP authentication failed",
    "retryable": false
  }
}
```

Never return raw provider credentials.

---

# 15. IMAP SERVICE

Use ImapFlow.

Responsibilities:

```text
connect
verifyConnection
searchForMessage
getMessage
close
normalizeError
```

Target flow:

```text
Connect
  ↓
Select INBOX
  ↓
Search actual mailbox
  ↓
Find expected Message-ID / Test ID
  ↓
Return actual result
```

---

# 16. IMAP CONNECTION TEST

Endpoint:

```http
POST /api/mailboxes/:id/test-imap
```

Do not mark the mailbox connected until the IMAP server confirms successful authentication.

---

# 17. TEST SEND

Endpoint:

```http
POST /api/warmup/test-send
```

The endpoint must not accept an arbitrary recipient.

Flow:

```text
Authenticate user
        ↓
Load WarmupConfig
        ↓
Load Mailbox A
        ↓
Load Mailbox B
        ↓
Validate ownership
        ↓
Validate A = WARMUP
        ↓
Validate B = TARGET
        ↓
Recipient = B.email
        ↓
Generate testId
        ↓
Generate unique Message-ID
        ↓
Create SCHEDULED/SENDING record
        ↓
SMTP send
        ↓
Mark SENT
        ↓
Queue IMAP verification
```

---

# 18. EMAIL FORMAT

Use a truthful controlled test email.

Example:

```text
Subject: Deliverability Test {{testId}}

Hello,

This is a controlled email deliverability test generated by the
email warming application.

Test ID: {{testId}}

Regards
```

Headers should contain normal valid email metadata.

Do not forge:

```text
Received
DKIM
SPF
DMARC
```

The actual SMTP server handles provider-level signing/configuration.

---

# 19. DELIVERY VERIFICATION

A successful SMTP send does not equal confirmed delivery.

State progression:

```text
SCHEDULED
    ↓
SENDING
    ↓
SENT
    ↓
RECEIVED
```

Failure:

```text
SCHEDULED → FAILED
SENDING → FAILED
SENT → TIMEOUT
```

Only IMAP observation in the Target Mailbox can produce:

```text
RECEIVED
```

---

# 20. RECEIPT SEARCH

Search using multiple identifiers where possible:

1. Message-ID
2. Test ID
3. Subject
4. Sender
5. Recent date range

Do not rely on subject alone.

Once found:

```text
receivedAt = current time
status = RECEIVED
```

Create:

```text
MESSAGE_RECEIVED
```

event.

---

# 21. OPTIONAL REPLY

Disabled by default.

When enabled:

Target mailbox must have SMTP configuration.

Flow:

```text
Actual message received
        ↓
Load actual received message
        ↓
Generate reply based on actual message
        ↓
Send using Target SMTP
        ↓
Provider confirms send
        ↓
Store REPLY_SENT
```

Never record a reply without a real SMTP send.

Do not fabricate reply metrics.

---

# 22. QUEUES

Use BullMQ + Redis.

Queues:

```text
warmup-send
warmup-receive-check
warmup-reply
```

---

# 23. SCHEDULER

Default:

```text
dailyLimit = 5
minDelayMinutes = 45
maxDelayMinutes = 180
```

Schedule within:

```text
activeStartHour
activeEndHour
timezone
```

All limits are validated server-side.

Do not implement aggressive volume escalation.

Do not schedule unlimited jobs.

---

# 24. IDEMPOTENCY

Every message has a unique internal ID.

Before sending:

```ts
if (message.status !== "SCHEDULED") {
  return;
}
```

Transition:

```text
SCHEDULED → SENDING
```

must be protected against concurrent workers.

Use database transactions/locking as appropriate.

A worker restart must not cause the same email to be sent twice.

---

# 25. RETRIES

Retry only transient failures.

Retryable:

```text
connection timeout
temporary network failure
temporary DNS issue
temporary provider 4xx response
```

Not retryable:

```text
authentication failure
invalid credentials
invalid mailbox
permanent recipient rejection
TLS configuration error
```

Maximum retries:

```text
3
```

Use exponential backoff.

---

# 26. ERROR NORMALIZATION

Provider-specific errors become application errors.

Categories:

```text
AUTHENTICATION
CONNECTION
TIMEOUT
RATE_LIMIT
TLS
DNS
MAILBOX_NOT_FOUND
RECIPIENT_REJECTED
UNKNOWN
```

Example:

```ts
{
  category: "AUTHENTICATION",
  providerCode: "EAUTH",
  message: "SMTP authentication failed",
  retryable: false
}
```

Do not expose raw stack traces through the API.

---

# 27. API

## Authentication

```http
POST /api/auth/register
POST /api/auth/login
POST /api/auth/logout
GET /api/auth/me
```

## Mailboxes

```http
POST /api/mailboxes
GET /api/mailboxes
GET /api/mailboxes/:id
PATCH /api/mailboxes/:id
DELETE /api/mailboxes/:id
POST /api/mailboxes/:id/test-smtp
POST /api/mailboxes/:id/test-imap
```

## Warmup

```http
GET /api/warmup/config
POST /api/warmup/config
PATCH /api/warmup/config
POST /api/warmup/start
POST /api/warmup/pause
POST /api/warmup/test-send
```

## Messages

```http
GET /api/messages
GET /api/messages/:id
```

## Events

```http
GET /api/events
```

---

# 28. API RESPONSE FORMAT

Success:

```json
{
  "success": true,
  "data": {}
}
```

Failure:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable message"
  }
}
```

Never return:

- passwords
- encrypted secrets
- authentication tokens
- provider stack traces

---

# 29. AUTHORIZATION

Every resource must belong to the authenticated user.

Before accessing:

```text
Mailbox
WarmupConfig
WarmupMessage
Event
```

verify ownership.

Never trust IDs supplied by the browser.

---

# 30. RATE LIMITING

Protect:

```text
POST /api/mailboxes/:id/test-smtp
POST /api/mailboxes/:id/test-imap
POST /api/warmup/test-send
```

Connection tests must not become an unlimited credential-guessing mechanism.

---

# 31. LOGGING

Use Pino.

Good:

```ts
logger.info({
  mailboxId,
  messageId,
  event: "SMTP_SEND_SUCCESS"
});
```

Never:

```ts
logger.info({
  password,
  smtpPassword,
  imapPassword
});
```

Redact:

```text
password
pass
authorization
cookie
token
secret
```

---

# 32. HEALTH

Endpoints:

```http
GET /health
GET /health/ready
```

Example:

```json
{
  "status": "ok",
  "database": "ok",
  "redis": "ok"
}
```

Readiness should fail if required infrastructure is unavailable.

---

# 33. DOCKER

Services:

```text
api
worker
postgres
redis
```

API and worker can use the same backend codebase but different startup commands.

---

# 34. TESTING

Unit/integration coverage must include:

```text
SMTP success
SMTP authentication failure
SMTP timeout
IMAP success
IMAP authentication failure
IMAP message found
IMAP message not found
duplicate worker execution
daily limit enforcement
paused warmup
invalid mailbox configuration
credential encryption/decryption
retry behavior
authorization/ownership
```

Use test mailboxes or a local mail testing server.

Never use real production/customer mailboxes in automated tests.

---

# 35. SECURITY CHECKLIST

Before production:

- HTTPS
- authenticated API
- authorization checks
- encrypted mailbox credentials
- secure password hashing
- rate limiting
- input validation
- output validation
- structured logging
- secret redaction
- secure cookies/tokens
- CORS restricted to the frontend origin
- Helmet/security headers
- database constraints
- queue idempotency
- bounded retries

Never use:

```ts
cors({ origin: "*" })
```

for the production authenticated application.

---

# 36. AI CODING RULES

The coding agent must:

1. Read `PROJECT.md` first.
2. Read this file before backend changes.
3. Inspect existing code before adding files.
4. Reuse existing services.
5. Never duplicate SMTP/IMAP implementations.
6. Never invent provider settings.
7. Never expose credentials to frontend code.
8. Never log credentials.
9. Never fake delivery.
10. Never fake replies.
11. Never mark RECEIVED without IMAP evidence.
12. Never mark REPLY_SENT without SMTP evidence.
13. Never allow arbitrary recipients in V1.
14. Never implement bulk campaign functionality.
15. Never implement provider-limit bypasses.
16. Never implement sender spoofing.
17. Never silently swallow provider errors.
18. Never retry permanent authentication failures.
19. Keep the two-mailbox architecture.
20. Ask before changing core architecture.

---

# 37. DEFINITION OF DONE

Backend V1 is complete when:

```text
User can authenticate
        ↓
Add Warmup Mailbox
        ↓
Add Target Mailbox
        ↓
Test SMTP
        ↓
Test IMAP
        ↓
Configure Warmup
        ↓
Start
        ↓
Worker sends real message A → B
        ↓
Worker observes B via IMAP
        ↓
Database records RECEIVED
        ↓
UI can read the event
        ↓
User can pause/resume
        ↓
Optional real reply works
```

Every state shown to the frontend must originate from actual backend state.
