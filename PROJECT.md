# PROJECT.md — Email Warmer

> **SOURCE OF TRUTH**
>
> This file is the product, architecture, UX, and UI source of truth for this project.
> `BACKEND.md` is the backend implementation contract.
> If generated code conflicts with either file, these files take precedence.
>
> Do not invent product behavior, UI patterns, APIs, colors, fonts, or architecture that are not specified here.
> If a requirement is genuinely ambiguous and would change architecture or user-visible behavior, ask before making the change.

---

# 1. PRODUCT

## 1.1 Goal

Build a focused email-warming / controlled deliverability-testing application.

V1 connects exactly **two mailboxes**:

### Mailbox A — Warmup Mailbox

The user's mailbox whose outgoing email behavior is being tested.

Required connection information:

- Email address
- SMTP host
- SMTP port
- SMTP security
- SMTP username
- SMTP password

Optional IMAP configuration may be collected if needed later.

### Mailbox B — Target Mailbox

A mailbox controlled or explicitly authorized by the user where the warmup/test emails are delivered.

Required connection information:

- Email address
- IMAP host
- IMAP port
- IMAP security
- IMAP username
- IMAP password

Optional SMTP configuration is required only when the user enables real replies.

---

# 2. V1 PRODUCT BOUNDARY

## V1 DOES

- Connect to the real SMTP server of Mailbox A.
- Connect to the real IMAP server of Mailbox B.
- Test SMTP authentication.
- Test IMAP authentication.
- Send controlled emails from A to B.
- Verify actual receipt through B's IMAP inbox.
- Optionally send a real reply from B if B SMTP is configured.
- Schedule controlled messages.
- Track actual send/receive/reply events.
- Track provider errors.
- Show connection status.
- Show warmup activity and basic analytics.
- Allow pause/resume.
- Enforce daily limits.

## V1 DOES NOT

- Send to arbitrary third-party recipients.
- Provide bulk email campaigns.
- Provide lead generation.
- Rotate through unrelated accounts.
- Spoof sender identities.
- Forge Message-ID, Received, DKIM, SPF, or DMARC headers.
- Fabricate opens, clicks, replies, delivery, or inbox placement.
- Automatically manipulate spam/important/star signals.
- Bypass provider anti-spam systems or sending limits.
- Scrape or purchase mailboxes.
- Generate unsolicited bulk email.
- Claim inbox placement without actually observing the message in the configured target mailbox.

The recipient for V1 warmup messages is always the configured Target Mailbox.

---

# 3. CORE FLOW

```text
User
  ↓
Connect Warmup Mailbox
  ↓
Connect Target Mailbox
  ↓
Test SMTP + IMAP
  ↓
Configure Warmup
  ↓
Start
  ↓
Scheduler
  ↓
SMTP sends from A → B
  ↓
IMAP checks B
  ↓
Message actually found?
  ├── Yes → RECEIVED
  └── No  → remain pending / eventually TIMEOUT
  ↓
Optional real reply
  ↓
Dashboard + Activity
```

Never display a successful event unless the backend has actually performed the corresponding mail-server operation.

---

# 4. TECH STACK

## Frontend

- Next.js App Router
- TypeScript
- Tailwind CSS
- shadcn/ui
- Lucide React
- TanStack Table
- React Hook Form
- Zod
- Sonner
- Framer Motion only where useful

## Backend

- Node.js
- TypeScript
- Fastify or Express
- PostgreSQL
- Prisma
- Redis
- BullMQ
- Nodemailer
- ImapFlow
- mailparser
- Zod
- Pino

## Infrastructure

- Docker
- PostgreSQL
- Redis
- API container
- Worker container

Do not introduce microservices in V1.

---

# 5. PROJECT STRUCTURE

```text
/
├── frontend/
│   ├── app/
│   ├── components/
│   ├── lib/
│   ├── hooks/
│   ├── types/
│   └── ...
│
├── backend/
│   ├── src/
│   ├── prisma/
│   ├── tests/
│   └── ...
│
├── PROJECT.md
└── BACKEND.md
```

---

# 6. MANDATORY UI RULES

## 6.1 Component Library

**ONLY use shadcn/ui components.**

Never create a custom implementation of a component that already exists in shadcn/ui.

Before creating any UI component:

1. Check whether shadcn/ui already provides it.
2. If it exists, use it.
3. If it is not installed, install it using the shadcn CLI.
4. Only create a custom component when shadcn/ui genuinely does not provide the required behavior.

Allowed:

- shadcn/ui
- Lucide React
- Tailwind CSS
- Geist
- Framer Motion
- TanStack Table
- React Hook Form
- Zod
- Sonner

Forbidden:

- Material UI
- Chakra UI
- Mantine
- Ant Design
- DaisyUI
- Bootstrap
- Semantic UI
- other component libraries
- other icon libraries

---

# 7. DESIGN LANGUAGE

The visual language should feel like:

- Linear
- Vercel Dashboard
- Stripe Dashboard
- Raycast

Design characteristics:

- Minimal
- Premium
- Professional
- Modern
- Functional
- High information density without feeling crowded
- Large whitespace
- Strong alignment
- Subtle borders
- Restrained shadows
- No visual noise

Do not copy their branding or layouts directly.

---

# 8. TYPOGRAPHY

Use **Geist ONLY** throughout the application.

Install through `next/font/google`.

```ts
import { Geist } from "next/font/google"

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist",
})
```

Apply Geist globally.

Do not use:

- Poppins
- Montserrat
- Roboto
- Ubuntu
- Open Sans
- Nunito
- Inter

Never mix font families.

## Typography scale

### Dashboard title

```text
text-3xl font-bold tracking-tight
```

### Page title

```text
text-2xl font-semibold
```

### Section heading

```text
text-xl font-semibold
```

### Card title

```text
text-lg font-semibold
```

### Table header

```text
text-sm font-semibold
```

### Body

```text
text-sm font-normal
```

### Secondary

```text
text-xs text-muted-foreground
```

### Buttons

```text
text-sm font-medium
```

### Sidebar

```text
text-sm font-medium
```

### Labels

```text
text-sm font-medium
```

Use only:

- 400
- 500
- 600
- 700

Use `tracking-tight` only for:

- dashboard titles
- large statistics
- hero/statistic numbers

---

# 9. COLOR SYSTEM

The application uses a neutral monochrome design.

Primary visual colors:

- Black
- White
- Grey

Allowed Tailwind families:

- zinc
- neutral
- slate only when necessary

Do not introduce random colors.

Do not introduce gradients.

Do not use colorful cards.

Do not use blue primary buttons.

Use shadcn semantic tokens where appropriate:

- background
- foreground
- muted
- muted-foreground
- border
- input
- ring
- destructive

Status colors may use semantic shadcn styles when necessary for:

- success
- warning
- failure

Do not turn status colors into the application's general accent palette.

---

# 10. COMPONENT RULES

## Cards

Always use shadcn `Card`.

Style:

- rounded-xl
- subtle border
- subtle shadow
- generous spacing

Do not build a custom Card component if shadcn Card provides the required behavior.

## Buttons

Always use shadcn `Button`.

Allowed variants:

- default
- secondary
- outline
- ghost
- destructive

Do not create custom button implementations.

## Inputs

Always use shadcn `Input`.

Every input must have:

- Label
- Clear placeholder
- Validation
- Helpful description where necessary

## Dialogs

Always use shadcn `Dialog`.

Never build a custom modal.

## Dropdowns

Always use shadcn `DropdownMenu`.

## Tables

Use:

- TanStack Table for table logic
- shadcn Table components for rendering

## Forms

Use:

- React Hook Form
- Zod
- shadcn Form

## Notifications

Use Sonner.

Never use:

```js
alert()
```

## Icons

Lucide React ONLY.

Keep icon sizing consistent.

Default icon size should generally be 16px or 18px.

---

# 11. ANIMATION

Use Framer Motion only when it improves UX.

Animations must be:

- subtle
- fast
- smooth
- professional

Good:

- page fade
- small card entrance
- loading transition
- button feedback
- drawer/dialog transitions

Avoid:

- flashy animations
- bouncing UI
- excessive parallax
- decorative animations that distract from data

---

# 12. RESPONSIVE DESIGN

Desktop-first.

Support:

- desktop
- tablet
- mobile

Desktop should be the primary optimized experience because this is a B2B dashboard.

Maintain:

- consistent spacing
- consistent typography
- usable tables
- usable forms
- accessible controls

Do not create a completely separate mobile design system.

---

# 13. APPLICATION NAVIGATION

Primary sidebar:

```text
Dashboard
Mailboxes
Warmup
Activity
Settings
```

Do not add unrelated navigation items.

Top navigation:

```text
Page title
Optional page actions
Notifications
User menu
```

---

# 14. PAGES

## 14.1 Dashboard

Purpose: immediate understanding of the system state.

Header:

```text
Dashboard
Monitor your configured mailbox warmup activity.
```

Primary statistics:

- Warmup Mailbox
- Target Mailbox
- Messages Today
- Messages Received
- Failed Messages
- Current Status

Example status:

```text
Connected
Running
Paused
Error
```

Activity section:

```text
Warmup Activity
```

Show actual events:

```text
10:14  Email sent
10:49  Email received
12:31  Email sent
```

If there is no data:

```text
No warmup activity yet.
Connect your mailboxes to get started.
```

Do not fabricate activity.

---

# 15. MAILBOXES PAGE

Show exactly the configured mailboxes.

Two primary cards:

### Warmup Mailbox

Display:

- Email
- SMTP status
- Connection status
- Last tested
- Actions

### Target Mailbox

Display:

- Email
- IMAP status
- Connection status
- Last tested
- Actions

Actions:

```text
Test Connection
Edit
Remove
```

Use shadcn Dialog for editing/removal confirmation.

Never expose passwords after they have been saved.

Display:

```text
••••••••
```

or simply:

```text
Password saved
```

---

# 16. CONNECT MAILBOX FLOW

Use shadcn Dialog or a dedicated form page.

## Warmup mailbox form

Fields:

```text
Email Address
SMTP Host
SMTP Port
Security
SMTP Username
SMTP Password
```

Security options:

```text
SSL/TLS
STARTTLS
None
```

Do not assume provider settings.

## Target mailbox form

Fields:

```text
Email Address
IMAP Host
IMAP Port
Security
IMAP Username
IMAP Password
```

Optional:

```text
Enable Replies
```

If replies are enabled:

```text
SMTP Host
SMTP Port
SMTP Security
SMTP Username
SMTP Password
```

---

# 17. CONNECTION TEST UX

When the user clicks Test Connection:

```text
Testing connection...
```

Then show the actual result.

Success:

```text
Connection successful
```

Failure:

```text
Authentication failed
```

or the normalized backend error.

Never show:

```text
Connected
```

unless the provider connection was actually successful.

Never display raw passwords or secrets in errors.

---

# 18. WARMUP PAGE

The Warmup page controls the schedule.

Show:

```text
Warmup

Warmup Mailbox
info@example.com

Target Mailbox
target@example.com

Status
Paused / Running
```

Configuration:

```text
Daily messages
Minimum delay
Maximum delay
Active start time
Active end time
Timezone
Replies enabled
```

Defaults:

```text
Daily messages: 5
Minimum delay: 45 minutes
Maximum delay: 180 minutes
```

Server-side validation is mandatory.

Primary actions:

```text
Start Warmup
Pause Warmup
```

---

# 19. ACTIVITY PAGE

Use shadcn Table + TanStack Table.

Columns:

```text
Time
Type
From
To
Subject
Status
Message ID
```

Statuses:

```text
Scheduled
Sending
Sent
Received
Failed
Timeout
Reply Sent
```

Filters:

- Status
- Type
- Date

Search:

- Subject
- Message ID
- Email

Do not show fabricated records.

---

# 20. SETTINGS PAGE

Sections:

```text
General
Security
Notifications
```

Security should explain that mailbox credentials are encrypted at rest.

Do not show stored passwords.

---

# 21. EMPTY STATES

Every major page needs a meaningful empty state.

Example:

```text
No mailboxes connected

Connect your warmup and target mailboxes
to start controlled email tests.

[Connect Mailbox]
```

Use shadcn components.

Do not fill empty states with fake demo statistics.

---

# 22. ACCESSIBILITY

Use semantic HTML.

All interactive controls must:

- be keyboard accessible
- have accessible names
- show focus states
- have appropriate ARIA where required

Forms must expose validation errors clearly.

---

# 23. BACKEND CONTRACT

The frontend communicates with the backend only through HTTP APIs.

The browser must NEVER:

- connect directly to SMTP
- connect directly to IMAP
- store SMTP passwords
- store IMAP passwords
- send mail directly
- execute provider authentication

Credentials are submitted over HTTPS to the backend and encrypted at rest.

---

# 24. DATA TRUTH RULE

The UI must reflect backend state.

Never create fake:

- delivery counts
- sent counts
- replies
- health scores
- inbox placement
- success rates
- connection statuses

If there is insufficient data, say:

```text
Not enough data yet
```

or:

```text
No activity yet
```

---

# 25. BACKEND API CONTRACT

Mailbox:

```http
POST /api/mailboxes
GET /api/mailboxes
GET /api/mailboxes/:id
PATCH /api/mailboxes/:id
DELETE /api/mailboxes/:id
POST /api/mailboxes/:id/test-smtp
POST /api/mailboxes/:id/test-imap
```

Warmup:

```http
GET /api/warmup/config
POST /api/warmup/config
PATCH /api/warmup/config
POST /api/warmup/start
POST /api/warmup/pause
POST /api/warmup/test-send
```

Activity:

```http
GET /api/messages
GET /api/messages/:id
GET /api/events
```

The frontend must use these contracts rather than inventing alternate endpoints.

---

# 26. AI CODING RULES

Before modifying the project:

1. Read `PROJECT.md`.
2. Read `BACKEND.md` for backend changes.
3. Inspect the existing project structure.
4. Search for existing components before creating new ones.
5. Reuse existing shadcn components.
6. Do not create duplicate components.
7. Do not introduce a new UI library.
8. Do not introduce a new font.
9. Do not introduce new colors.
10. Do not invent API endpoints.
11. Do not invent backend data.
12. Do not fake provider responses.
13. Do not fake delivery.
14. Do not log credentials.
15. Do not expose credentials to the browser.
16. Do not change architecture without justification.
17. Keep V1 limited to the two configured mailboxes.

If a component exists in shadcn/ui, use it.

If a component already exists in this repository, reuse it.

If a required dependency is missing, install the appropriate dependency rather than implementing a fake replacement.

---

# 27. DEFINITION OF DONE

The V1 application is complete when a user can:

1. Add Warmup Mailbox.
2. Add Target Mailbox.
3. Successfully test SMTP.
4. Successfully test IMAP.
5. Configure a warmup schedule.
6. Start warmup.
7. Send an actual message from A to B.
8. Detect actual receipt in B via IMAP.
9. See the event in Activity.
10. Pause warmup.
11. Resume warmup.
12. See actual errors when something fails.
13. Optionally configure and send a real reply.
14. Never expose stored credentials.
15. Use the entire UI consistently according to this design system.

---

# 28. FINAL DESIGN LOCK

These rules are permanent unless explicitly changed by the project owner.

Do not:

- redesign the application
- switch fonts
- switch component libraries
- add colorful themes
- add gradients
- add unrelated features
- create custom versions of shadcn components
- create fake data
- invent product functionality

Always extend the existing system rather than replacing it.
