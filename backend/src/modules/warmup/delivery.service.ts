import { simpleParser } from "mailparser"
import { prisma } from "../../db/prisma"
import { RECEIVE_CHECK_DELAYS_MS, REPLY_DELAY_RANGE_MS } from "../../config/constants"
import { enqueueReceiveCheck, enqueueReply } from "../../queues/queues"
import { scrubSecrets } from "../../security/redaction"
import { generateMessageId } from "../../utils/ids"
import { normalizeMailError, type NormalizedMailError } from "../../utils/errors"
import { logger } from "../../utils/logger"
import { dayWindow, randomBetween } from "../../utils/time"
import { eventService } from "../events/event.service"
import { ImapService } from "../imap/imap.service"
import { SmtpService } from "../smtp/smtp.service"
import { getImapConfig, getSmtpConfig } from "../mailboxes/mailbox.credentials"
import { buildMessageBody, buildReply } from "./message-content"
import { computeDailyLimit, schedulerService, SENT_STATUSES } from "./scheduler.service"

export type SendOutcome =
  | { status: "SENT"; messageId: string }
  | { status: "FAILED"; error: NormalizedMailError | { code: string; message: string } }
  | { status: "RETRY"; error: NormalizedMailError }
  | { status: "SKIPPED"; reason: string }

function loadMessage(id: string) {
  return prisma.warmupMessage.findUnique({
    where: { id },
    include: { warmupConfig: { include: { warmupMailbox: true, targetMailbox: true } } },
  })
}

async function markMailboxAuthFailure(mailboxId: string, protocol: "SMTP" | "IMAP", message: string) {
  await prisma.mailbox.update({
    where: { id: mailboxId },
    data:
      protocol === "SMTP"
        ? { smtpTestStatus: "FAILED", lastSmtpError: message, status: "ERROR" }
        : { imapTestStatus: "FAILED", lastImapError: message, status: "ERROR" },
  })
}

/**
 * Sends one warmup/test message from Mailbox A to Mailbox B over A's real SMTP server.
 * Guarded by an atomic SCHEDULED → SENDING transition so a message is never sent twice.
 */
export async function performSend(messageId: string, opts: { canRetry: boolean }): Promise<SendOutcome> {
  const claimed = await prisma.warmupMessage.updateMany({
    where: { id: messageId, status: "SCHEDULED" },
    data: { status: "SENDING" },
  })
  if (claimed.count === 0) return { status: "SKIPPED", reason: "Message is not in SCHEDULED state" }

  const message = await loadMessage(messageId)
  if (!message) return { status: "SKIPPED", reason: "Message not found" }
  const config = message.warmupConfig
  const userId = config.userId
  const sender = config.warmupMailbox
  const target = config.targetMailbox

  const fail = async (error: { code: string; message: string }, metadata: Record<string, unknown> = {}) => {
    await prisma.warmupMessage.update({
      where: { id: messageId },
      data: { status: "FAILED", errorCode: error.code, errorMessage: error.message },
    })
    await eventService.record(userId, "FAILED", {
      warmupMessageId: messageId,
      metadata: { stage: "SEND", code: error.code, message: error.message, ...metadata },
    })
    return { status: "FAILED" as const, error }
  }

  if (!sender || !target) return fail({ code: "MAILBOX_MISSING", message: "Warmup or target mailbox was removed" })

  if (message.type === "WARMUP") {
    if (!config.enabled) {
      // Paused after this job was queued: it was never sent, so drop it rather than record a send.
      await prisma.warmupMessage.delete({ where: { id: messageId } })
      return { status: "SKIPPED", reason: "Warmup is paused" }
    }
    const { limit } = computeDailyLimit(config)
    const win = dayWindow(new Date(), config.timezone, config.activeStartHour, config.activeEndHour)
    const sentToday = await prisma.warmupMessage.count({
      // Manual test sends don't consume the warmup quota (the planner excludes them too).
      where: { warmupConfigId: config.id, type: "WARMUP", status: { in: SENT_STATUSES }, sentAt: { gte: win.dayStart, lt: win.dayEnd } },
    })
    if (sentToday >= limit) {
      await prisma.warmupMessage.delete({ where: { id: messageId } })
      return { status: "SKIPPED", reason: "Daily limit reached" }
    }
  }

  // The recipient is always the configured target mailbox, regardless of what is stored on the message.
  const to = target.email
  let smtp
  try {
    smtp = getSmtpConfig(sender)
  } catch (err) {
    return fail({ code: "SMTP_NOT_CONFIGURED", message: (err as Error).message })
  }

  const rfcMessageId = message.messageId ?? generateMessageId(message.testId, sender.email)
  await prisma.warmupMessage.update({ where: { id: messageId }, data: { messageId: rfcMessageId, from: sender.email, to } })
  await eventService.record(userId, "SMTP_SEND_STARTED", {
    warmupMessageId: messageId,
    metadata: { host: smtp.host, port: smtp.port, from: sender.email, to },
  })

  try {
    const result = await SmtpService.sendMessage(smtp, {
      from: sender.email,
      to,
      subject: message.subject,
      text: buildMessageBody({ ...message, from: sender.email, to }, config),
      testId: message.testId,
      messageId: rfcMessageId,
    })
    const sentAt = new Date()
    await prisma.warmupMessage.update({
      where: { id: messageId },
      data: { status: "SENT", sentAt, errorCode: null, errorMessage: null },
    })
    await eventService.record(userId, "SMTP_SENT", {
      warmupMessageId: messageId,
      metadata: { accepted: result.accepted, response: scrubSecrets(result.response ?? "", [smtp.password]) },
    })
    await enqueueReceiveCheck(messageId, 0, RECEIVE_CHECK_DELAYS_MS[0])
    return { status: "SENT", messageId: rfcMessageId }
  } catch (err) {
    const normalized = normalizeMailError(err, "SMTP")
    logger.warn({ messageId, code: normalized.code, providerCode: normalized.providerCode }, "SMTP send failed")

    if (normalized.retryable && opts.canRetry) {
      await prisma.warmupMessage.update({
        where: { id: messageId },
        data: { status: "SCHEDULED", errorCode: normalized.code, errorMessage: normalized.message },
      })
      await eventService.record(userId, "FAILED", {
        warmupMessageId: messageId,
        metadata: { stage: "SEND", code: normalized.code, message: normalized.message, willRetry: true },
      })
      return { status: "RETRY", error: normalized }
    }

    let warmupPaused = false
    if (normalized.category === "AUTHENTICATION") {
      await markMailboxAuthFailure(sender.id, "SMTP", normalized.message)
      // Credentials won't fix themselves: stop the schedule instead of failing every remaining message.
      if (config.enabled) {
        await prisma.warmupConfig.update({ where: { id: config.id }, data: { enabled: false } })
        await schedulerService.cancelScheduled(config.id)
        warmupPaused = true
      }
    }
    return fail(normalized, { providerCode: normalized.providerCode, warmupPaused })
  }
}

/** Looks for a sent message in the target mailbox (INBOX, then Junk). Only an actual IMAP match yields RECEIVED. */
export async function checkReceipt(messageId: string, check: number) {
  const message = await loadMessage(messageId)
  if (!message || message.status !== "SENT" || !message.messageId) return
  const config = message.warmupConfig
  const target = config.targetMailbox
  const userId = config.userId

  const scheduleNext = async () => {
    const next = check + 1
    if (next < RECEIVE_CHECK_DELAYS_MS.length) {
      await enqueueReceiveCheck(messageId, next, RECEIVE_CHECK_DELAYS_MS[next])
      return
    }
    const { count } = await prisma.warmupMessage.updateMany({
      where: { id: messageId, status: "SENT" },
      data: { status: "TIMEOUT", errorCode: "RECEIVE_TIMEOUT", errorMessage: "Message was not found in the target mailbox" },
    })
    if (count) {
      await eventService.record(userId, "FAILED", {
        warmupMessageId: messageId,
        metadata: { stage: "RECEIVE", code: "RECEIVE_TIMEOUT", checks: next },
      })
    }
  }

  if (!target) return scheduleNext()

  let found
  try {
    found = await ImapService.findMessage(getImapConfig(target), {
      messageId: message.messageId,
      testId: message.testId,
      from: message.from,
      since: message.sentAt ?? message.scheduledAt,
    })
  } catch (err) {
    const normalized = normalizeMailError(err, "IMAP")
    logger.warn({ messageId, code: normalized.code }, "IMAP receipt check failed")
    if (normalized.category === "AUTHENTICATION") await markMailboxAuthFailure(target.id, "IMAP", normalized.message)
    await eventService.record(userId, "FAILED", {
      warmupMessageId: messageId,
      metadata: { stage: "RECEIVE_CHECK", code: normalized.code, message: normalized.message, willRetry: true },
    })
    return scheduleNext()
  }

  if (!found) return scheduleNext()

  const receivedAt = new Date()
  const { count } = await prisma.warmupMessage.updateMany({
    where: { id: messageId, status: "SENT" },
    data: { status: "RECEIVED", receivedAt, placement: found.placement, folder: found.folder, imapUid: found.uid },
  })
  if (!count) return

  await eventService.record(userId, "MESSAGE_RECEIVED", {
    warmupMessageId: messageId,
    metadata: {
      folder: found.folder,
      placement: found.placement,
      matchedBy: found.matchedBy,
      latencySeconds: message.sentAt ? Math.round((receivedAt.getTime() - message.sentAt.getTime()) / 1000) : undefined,
    },
  })

  if (config.repliesEnabled && target.smtpEnabled) {
    await enqueueReply(messageId, Math.round(randomBetween(REPLY_DELAY_RANGE_MS[0], REPLY_DELAY_RANGE_MS[1])))
  }
}

/** Sends a real reply from Mailbox B to Mailbox A, based on the message actually found in B. */
export async function performReply(messageId: string, opts: { canRetry: boolean }) {
  const claimed = await prisma.warmupMessage.updateMany({
    where: { id: messageId, status: "RECEIVED", replyStartedAt: null },
    data: { replyStartedAt: new Date() },
  })
  if (!claimed.count) return

  const message = await loadMessage(messageId)
  if (!message) return
  const config = message.warmupConfig
  const target = config.targetMailbox
  const sender = config.warmupMailbox
  const userId = config.userId

  const fail = async (code: string, errMessage: string, retry: boolean) => {
    await prisma.warmupMessage.update({
      where: { id: messageId },
      data: { replyError: errMessage, ...(retry ? { replyStartedAt: null } : {}) },
    })
    await eventService.record(userId, "FAILED", {
      warmupMessageId: messageId,
      metadata: { stage: "REPLY", code, message: errMessage, willRetry: retry },
    })
  }

  if (!config.repliesEnabled || !target?.smtpEnabled || !sender) {
    return fail("REPLY_DISABLED", "Replies are disabled or the target mailbox has no SMTP configuration", false)
  }
  if (!message.folder || !message.imapUid) return fail("ORIGINAL_NOT_FOUND", "Received message location unknown", false)

  let protocol: "SMTP" | "IMAP" = "IMAP"
  try {
    const source = await ImapService.getMessageSource(getImapConfig(target), message.folder, message.imapUid)
    if (!source) return fail("ORIGINAL_NOT_FOUND", "The received message is no longer in the target mailbox", false)
    const original = await simpleParser(source)

    protocol = "SMTP"
    const smtp = getSmtpConfig(target)
    const originalId = original.messageId ?? message.messageId ?? undefined
    const replyId = generateMessageId(message.testId, target.email)
    const subject = original.subject?.toLowerCase().startsWith("re:") ? original.subject : `Re: ${original.subject ?? message.subject}`

    await SmtpService.sendMessage(smtp, {
      from: target.email,
      to: sender.email,
      subject,
      text: buildReply(message, config, { text: original.text, subject: original.subject ?? message.subject, date: original.date }),
      testId: message.testId,
      messageId: replyId,
      inReplyTo: originalId,
      references: originalId,
    })

    await prisma.warmupMessage.update({
      where: { id: messageId },
      data: { status: "REPLY_SENT", repliedAt: new Date(), replyMessageId: replyId, replyError: null },
    })
    await eventService.record(userId, "REPLY_SENT", {
      warmupMessageId: messageId,
      metadata: { from: target.email, to: sender.email, inReplyTo: originalId },
    })
  } catch (err) {
    const normalized = normalizeMailError(err, protocol)
    if (normalized.category === "AUTHENTICATION") await markMailboxAuthFailure(target.id, protocol, normalized.message)
    const retry = normalized.retryable && opts.canRetry
    await fail(normalized.code, normalized.message, retry)
    if (retry) throw err
  }
}
