-- CreateEnum
CREATE TYPE "MailboxType" AS ENUM ('WARMUP', 'TARGET');

-- CreateEnum
CREATE TYPE "MailboxStatus" AS ENUM ('PENDING', 'CONNECTED', 'ERROR', 'DISABLED');

-- CreateEnum
CREATE TYPE "ConnectionTestStatus" AS ENUM ('UNTESTED', 'SUCCESS', 'FAILED');

-- CreateEnum
CREATE TYPE "MessageType" AS ENUM ('WARMUP', 'TEST');

-- CreateEnum
CREATE TYPE "MessageStatus" AS ENUM ('SCHEDULED', 'SENDING', 'SENT', 'RECEIVED', 'BOUNCED', 'FAILED', 'TIMEOUT', 'REPLY_SENT');

-- CreateEnum
CREATE TYPE "Placement" AS ENUM ('INBOX', 'SPAM', 'OTHER');

-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('SCHEDULED', 'SMTP_CONNECTED', 'SMTP_SEND_STARTED', 'SMTP_SENT', 'IMAP_CONNECTED', 'MESSAGE_RECEIVED', 'REPLY_SENT', 'FAILED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Mailbox" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "MailboxType" NOT NULL,
    "email" TEXT NOT NULL,
    "smtpHost" TEXT,
    "smtpPort" INTEGER,
    "smtpSecurity" TEXT,
    "smtpUsername" TEXT,
    "encryptedSmtpPassword" TEXT,
    "imapHost" TEXT,
    "imapPort" INTEGER,
    "imapSecurity" TEXT,
    "imapUsername" TEXT,
    "encryptedImapPassword" TEXT,
    "smtpEnabled" BOOLEAN NOT NULL DEFAULT true,
    "imapEnabled" BOOLEAN NOT NULL DEFAULT false,
    "status" "MailboxStatus" NOT NULL DEFAULT 'PENDING',
    "smtpTestStatus" "ConnectionTestStatus" NOT NULL DEFAULT 'UNTESTED',
    "imapTestStatus" "ConnectionTestStatus" NOT NULL DEFAULT 'UNTESTED',
    "lastSmtpError" TEXT,
    "lastImapError" TEXT,
    "lastSmtpTestAt" TIMESTAMP(3),
    "lastImapTestAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Mailbox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WarmupConfig" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "warmupMailboxId" TEXT,
    "targetMailboxId" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "dailyLimit" INTEGER NOT NULL DEFAULT 5,
    "minDelayMinutes" INTEGER NOT NULL DEFAULT 45,
    "maxDelayMinutes" INTEGER NOT NULL DEFAULT 180,
    "activeStartHour" INTEGER NOT NULL DEFAULT 9,
    "activeEndHour" INTEGER NOT NULL DEFAULT 17,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "repliesEnabled" BOOLEAN NOT NULL DEFAULT false,
    "rampUpEnabled" BOOLEAN NOT NULL DEFAULT true,
    "rampStartVolume" INTEGER NOT NULL DEFAULT 2,
    "rampIncrement" INTEGER NOT NULL DEFAULT 1,
    "startedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WarmupConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WarmupMessage" (
    "id" TEXT NOT NULL,
    "warmupConfigId" TEXT NOT NULL,
    "type" "MessageType" NOT NULL DEFAULT 'WARMUP',
    "testId" TEXT NOT NULL,
    "messageId" TEXT,
    "subject" TEXT NOT NULL,
    "from" TEXT NOT NULL,
    "to" TEXT NOT NULL,
    "status" "MessageStatus" NOT NULL DEFAULT 'SCHEDULED',
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3),
    "placement" "Placement",
    "folder" TEXT,
    "imapUid" INTEGER,
    "replyStartedAt" TIMESTAMP(3),
    "repliedAt" TIMESTAMP(3),
    "replyMessageId" TEXT,
    "replyError" TEXT,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WarmupMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "warmupMessageId" TEXT,
    "type" "EventType" NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Mailbox_userId_type_key" ON "Mailbox"("userId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "WarmupConfig_userId_key" ON "WarmupConfig"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "WarmupMessage_testId_key" ON "WarmupMessage"("testId");

-- CreateIndex
CREATE INDEX "WarmupMessage_warmupConfigId_scheduledAt_idx" ON "WarmupMessage"("warmupConfigId", "scheduledAt");

-- CreateIndex
CREATE INDEX "WarmupMessage_status_idx" ON "WarmupMessage"("status");

-- CreateIndex
CREATE INDEX "Event_userId_createdAt_idx" ON "Event"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "Mailbox" ADD CONSTRAINT "Mailbox_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarmupConfig" ADD CONSTRAINT "WarmupConfig_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarmupConfig" ADD CONSTRAINT "WarmupConfig_warmupMailboxId_fkey" FOREIGN KEY ("warmupMailboxId") REFERENCES "Mailbox"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarmupConfig" ADD CONSTRAINT "WarmupConfig_targetMailboxId_fkey" FOREIGN KEY ("targetMailboxId") REFERENCES "Mailbox"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarmupMessage" ADD CONSTRAINT "WarmupMessage_warmupConfigId_fkey" FOREIGN KEY ("warmupConfigId") REFERENCES "WarmupConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_warmupMessageId_fkey" FOREIGN KEY ("warmupMessageId") REFERENCES "WarmupMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
