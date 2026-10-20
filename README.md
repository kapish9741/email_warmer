# Email Warmer

A controlled two-mailbox email warming and deliverability testing platform. Mailbox A (Warmup) sends real messages over its own SMTP server to Mailbox B (Target); the target's IMAP inbox is checked to confirm actual delivery and determine whether the message landed in the **Inbox** or **Spam/Junk**. Optionally, Mailbox B sends an authentic threaded reply back to Mailbox A.

See [`PROJECT.md`](PROJECT.md) (product/UI specifications) and [`BACKEND.md`](BACKEND.md) (backend architecture contract).

---

## Architecture Overview

```text
Frontend (Next.js 16)
   │
   │ /api proxy (port 3000 -> 4000)
   ▼
API Server (Fastify + Prisma)
   │
   ├── PostgreSQL (Mailboxes, Configs, Logs)
   └── Redis / BullMQ
          │
          ▼
       Workers
       ├── Send Worker    ───> SMTP ───> Mailbox A (Warmup)
       ├── Receive Worker <─── IMAP <─── Mailbox B (Target)
       └── Reply Worker   ───> SMTP ───> Mailbox B (Reply back to A)
```

- **Mailbox A (Warmup Mailbox)**: Sends warming emails using its configured SMTP server.
- **Mailbox B (Target Mailbox)**: Receives test emails and verifies receipt and folder placement via IMAP.
- **Worker Process**: Manages BullMQ job queues for scheduling, randomized delays, IMAP inbox verification polling, and reply generation.

---

## Prerequisites

Before starting, ensure you have:

- **Node.js**: `v20.0.0` or higher
- **Package Manager**: `npm`
- **PostgreSQL**: `v15+` (local service or Docker container)
- **Redis**: `v7+` (local service or Docker container)
- *(Optional)* **Docker & Docker Compose** for running PostgreSQL & Redis with one command.

---

## Getting Started

### 1. Clone the Repository

```bash
git clone https://github.com/kapish9741/email_warmer.git
cd email_warmer
```

---

### 2. Configure Environment Variables

#### Backend Configuration

Navigate to the `backend/` directory and copy the environment template:

```bash
cd backend
cp .env.example .env
```

Edit `backend/.env` with your settings:

```env
NODE_ENV=development
PORT=4000
HOST=0.0.0.0

# Database & Queue
DATABASE_URL=postgresql://postgres:postgrespassword@localhost:5432/email_warmer?schema=public
REDIS_URL=redis://localhost:6379

# Security (At least 32 characters for encryption key, 16 for JWT)
APP_ENCRYPTION_KEY=0123456789abcdef0123456789abcdef
JWT_SECRET=your_super_secret_jwt_key_here

LOG_LEVEL=info
CORS_ORIGINS=
```

> [!IMPORTANT]
> `APP_ENCRYPTION_KEY` is used to encrypt SMTP and IMAP credentials at rest using AES-256-GCM. It **must** be at least 32 characters long.

#### Frontend Configuration (Optional)

In the repository root, create `.env.local` if your backend runs on a non-default host/port:

```env
BACKEND_URL=http://localhost:4000
```

---

### 3. Database Setup & Migrations

In the `backend/` folder:

```bash
cd backend
npm install
npx prisma migrate dev
```

This installs backend dependencies, initializes Prisma Client, and executes database migrations.

---

### 4. Running the Application

You need three processes running locally: the **API server**, the **Background Worker**, and the **Next.js Frontend**.

#### Terminal 1 — Backend API
```bash
cd backend
npm run dev
# Starts Fastify API on http://localhost:4000
```

#### Terminal 2 — Background Worker
```bash
cd backend
npm run dev:worker
# Starts BullMQ scheduler, SMTP sender, IMAP receiver, and reply worker
```

#### Terminal 3 — Next.js Frontend
```bash
# In the root repository directory
npm install
npm run dev
# Starts Next.js app on http://localhost:3000
```

Open [http://localhost:3000](http://localhost:3000) in your browser. All API calls to `/api/*` are automatically proxied to `http://localhost:4000`.

---

### Alternative: Running Infrastructure with Docker

If you don't have PostgreSQL and Redis installed locally, use the provided Docker Compose configuration in `backend/`:

```bash
# Start PostgreSQL and Redis containers
cd backend
docker compose up postgres redis -d

# Run Prisma migrations
npx prisma migrate dev

# Start API and worker on your host
npm run dev
npm run dev:worker
```

Or run the entire backend stack (Postgres + Redis + API + Worker) in Docker:

```bash
cd backend
docker compose up -d
```

---

## Mailbox Setup Guide

To begin warming, create an account on the login page and navigate to **Mailboxes**. You will configure two mailboxes:

### 1. Google Mailboxes (Gmail & Google Workspace)

Because Google disables basic passwords for third-party automated tools, you must use a **Google App Password**:

1. **Verify IMAP is Enabled in Gmail**:
   - Go to [Gmail Settings](https://mail.google.com) → click ⚙️ **See all settings** → **Forwarding and POP/IMAP**.
   - Ensure **IMAP access** is enabled (if you see *"When I mark a message in IMAP as deleted..."*, IMAP is already active).
2. **Generate a 16-Character App Password**:
   - Ensure **2-Step Verification** is turned ON in your [Google Account Security](https://myaccount.google.com/security).
   - Visit [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords).
   - Under **App name**, enter `Email Warmer` and click **Create**.
   - Copy the 16-character code (e.g. `abcd efgh ijkl mnop`). Remove spaces when pasting.
3. **Enter Credentials in Email Warmer**:
   - **Mailbox A (Warmup - SMTP)**:
     - **Host**: `smtp.gmail.com`
     - **Port**: `587`
     - **Security**: `STARTTLS` *(or Port `465` with `SSL`)*
     - **Username**: Full Gmail address (`you@gmail.com`)
     - **Password**: 16-character App Password
   - **Mailbox B (Target - IMAP)**:
     - **Host**: `imap.gmail.com`
     - **Port**: `993`
     - **Security**: `SSL`
     - **Username**: Full Gmail address (`target@gmail.com`)
     - **Password**: 16-character App Password

---

### 2. Microsoft 365 / Outlook.com

1. Ensure **Authenticated SMTP** and **IMAP** are enabled in the Microsoft 365 Admin Center under User Mail settings.
2. Generate an **App Password** from your Microsoft Security / Multi-Factor Authentication settings.
3. **Connection Settings**:
   - **SMTP Host**: `smtp.office365.com` | **Port**: `587` | **Security**: `STARTTLS`
   - **IMAP Host**: `outlook.office365.com` | **Port**: `993` | **Security**: `SSL`

---

### 3. Custom Domain (cPanel / Plesk / Private Mail Server)

1. Check your mail client configuration settings in your hosting panel (e.g., cPanel → **Email Accounts** → **Connect Devices**).
2. **Connection Settings**:
   - **SMTP Host**: `mail.yourdomain.com` | **Port**: `465` (`SSL`) or `587` (`STARTTLS`)
   - **IMAP Host**: `mail.yourdomain.com` | **Port**: `993` (`SSL`)
   - **Username / Password**: Your full mailbox address and password.

---

## Starting Warmup & Monitoring

1. **Test Connections**:
   - On the **Mailboxes** page, click **Test Connection** on Mailbox A (verifies SMTP TLS handshake and authentication).
   - Click **Test IMAP** on Mailbox B (verifies IMAP connection and folder access).
2. **Configure Warmup**:
   - Go to the **Warmup** page.
   - Set your **Daily Target Volume**, **Daily Ramp-Up Increase**, and **Active Send Window** (hours & timezone).
   - Enable **Simulate Replies** if you want Mailbox B to automatically reply to warming emails.
3. **Start Warmup**:
   - Toggle warmup status to **Active**.
   - Watch today's scheduled sends on the interactive timeline:
     - `Scheduled` → `Sent` → `Inbox` / `Spam` → `Replied`.

---

## Email Content & Template Engine

Messages are generated dynamically using 72 human-written templates in `backend/src/modules/warmup/templates/library.ts`:

- **36 Opening Emails**: Casual, professional, informational, and technical topics.
- **36 Threaded Replies**: Tailored specifically to match each opener.
- **Dynamic Variables**: Personalization using `{{sender_name}}`, `{{recipient_first_name}}`, `{{weekday}}`, and `{{active_window}}`.
- **Anti-Repetition**: The scheduler avoids reusing templates from recent sends and alternates topic categories.
- **Sample Generation**: Run `npm run templates:sample` in `backend/` to generate a 20-message simulated conversation in `backend/docs/sample-conversation.md`.

---

## Project Scripts Reference

### Backend (`/backend`)

| Command | Description |
|---|---|
| `npm run dev` | Starts the Fastify API with hot reload on port `4000` |
| `npm run dev:worker` | Starts the BullMQ worker and scheduler with hot reload |
| `npm run build` | Compiles TypeScript to `dist/` |
| `npm start` | Runs the compiled API in production |
| `npm run start:worker` | Runs the compiled background worker in production |
| `npm test` | Runs unit tests (scheduler, encryption, error normalization) |
| `npm run typecheck` | Runs TypeScript verification |
| `npm run templates:sample` | Generates a 20-message exchange in `docs/` |

### Frontend (Root)

| Command | Description |
|---|---|
| `npm run dev` | Starts the Next.js development server on port `3000` |
| `npm run build` | Builds the Next.js production bundle |
| `npm start` | Runs the production Next.js server |
| `npm run lint` | Runs ESLint |

---

## Security Model

- **Zero Plaintext Storage**: All SMTP and IMAP credentials are encrypted at rest with AES-256-GCM using unique per-credential initialization vectors (IV).
- **Transient Memory Only**: Decrypted passwords exist only in short-lived memory during SMTP/IMAP operations and are never logged or exposed via API endpoints.
- **Cookie Authentication**: User sessions use signed, `httpOnly`, `SameSite=Lax` cookies.
