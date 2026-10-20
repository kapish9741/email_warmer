import type { Placement, WarmupConfig } from "@prisma/client"
import { prisma } from "../../db/prisma"
import { AppError, badRequest } from "../../utils/errors"
import { generateTestId } from "../../utils/ids"
import { dayWindow } from "../../utils/time"
import { eventService } from "../events/event.service"
import { toPublicMailbox } from "../mailboxes/mailbox.repository"
import { performSend } from "./delivery.service"
import { planContent } from "./message-content"
import { computeDailyLimit, schedulerService } from "./scheduler.service"
import { validateWarmupConfig, warmupConfigFields, type WarmupConfigInput } from "./warmup.schema"

const MAX_TEST_SENDS_PER_DAY = 20

const SCHEDULE_FIELDS: (keyof WarmupConfigInput)[] = [
  "dailyLimit",
  "minDelayMinutes",
  "maxDelayMinutes",
  "activeStartHour",
  "activeEndHour",
  "timezone",
  "rampUpEnabled",
  "rampStartVolume",
  "rampIncrement",
]

async function loadMailboxes(userId: string) {
  const mailboxes = await prisma.mailbox.findMany({ where: { userId } })
  return {
    warmup: mailboxes.find((m) => m.type === "WARMUP") ?? null,
    target: mailboxes.find((m) => m.type === "TARGET") ?? null,
  }
}

export const warmupService = {
  /** Every user has exactly one config, linked to their current WARMUP and TARGET mailboxes. */
  async getOrCreateConfig(userId: string): Promise<WarmupConfig> {
    const { warmup, target } = await loadMailboxes(userId)
    return prisma.warmupConfig.upsert({
      where: { userId },
      create: { userId, warmupMailboxId: warmup?.id, targetMailboxId: target?.id },
      update: { warmupMailboxId: warmup?.id ?? null, targetMailboxId: target?.id ?? null },
    })
  },

  async getOverview(userId: string) {
    const config = await this.getOrCreateConfig(userId)
    const { warmup, target } = await loadMailboxes(userId)
    const now = new Date()
    const { rampDay, limit } = computeDailyLimit(config, now)
    const win = dayWindow(now, config.timezone, config.activeStartHour, config.activeEndHour)

    const [todayByStatus, totalsByStatus, placements, next] = await Promise.all([
      prisma.warmupMessage.groupBy({
        by: ["status"],
        // Daily progress counts scheduled warmup messages only; manual test sends are tracked separately.
        where: { warmupConfigId: config.id, type: "WARMUP", scheduledAt: { gte: win.dayStart, lt: win.dayEnd } },
        _count: true,
      }),
      prisma.warmupMessage.groupBy({ by: ["status"], where: { warmupConfigId: config.id }, _count: true }),
      prisma.warmupMessage.groupBy({
        by: ["placement"],
        where: { warmupConfigId: config.id, placement: { not: null } },
        _count: true,
      }),
      prisma.warmupMessage.findFirst({
        where: { warmupConfigId: config.id, status: "SCHEDULED" },
        orderBy: { scheduledAt: "asc" },
        select: { scheduledAt: true },
      }),
    ])

    const count = (rows: { status: string; _count: number }[], ...statuses: string[]) =>
      rows.filter((r) => statuses.includes(r.status)).reduce((n, r) => n + r._count, 0)
    const placementCount = (p: Placement) => placements.find((r) => r.placement === p)?._count ?? 0

    const warmupConnected = warmup?.status === "CONNECTED"
    const targetConnected = target?.status === "CONNECTED"
    const repliesReady = Boolean(target?.smtpEnabled && target.smtpTestStatus === "SUCCESS")

    let status: "NOT_CONFIGURED" | "RUNNING" | "PAUSED" | "ERROR"
    if (!warmup || !target) status = "NOT_CONFIGURED"
    else if (config.enabled) status = "RUNNING"
    else if (warmup.status === "ERROR" || target.status === "ERROR") status = "ERROR"
    else status = "PAUSED"

    return {
      config,
      status,
      warmupMailbox: warmup ? toPublicMailbox(warmup) : null,
      targetMailbox: target ? toPublicMailbox(target) : null,
      readiness: { warmupConnected, targetConnected, repliesReady, canStart: warmupConnected && targetConnected },
      today: {
        date: win.dayKey,
        rampDay,
        limit,
        dayStart: win.dayStart,
        dayEnd: win.dayEnd,
        windowStart: win.windowStart,
        windowEnd: win.windowEnd,
        scheduled: count(todayByStatus, "SCHEDULED", "SENDING"),
        sent: count(todayByStatus, "SENT", "RECEIVED", "REPLY_SENT", "TIMEOUT", "BOUNCED"),
        received: count(todayByStatus, "RECEIVED", "REPLY_SENT"),
        failed: count(todayByStatus, "FAILED", "BOUNCED", "TIMEOUT"),
        nextScheduledAt: next?.scheduledAt ?? null,
      },
      totals: {
        sent: count(totalsByStatus, "SENT", "RECEIVED", "REPLY_SENT", "TIMEOUT", "BOUNCED"),
        received: count(totalsByStatus, "RECEIVED", "REPLY_SENT"),
        replies: count(totalsByStatus, "REPLY_SENT"),
        failed: count(totalsByStatus, "FAILED", "BOUNCED"),
        timeout: count(totalsByStatus, "TIMEOUT"),
        inbox: placementCount("INBOX"),
        spam: placementCount("SPAM"),
      },
    }
  },

  async updateConfig(userId: string, input: WarmupConfigInput) {
    const current = await this.getOrCreateConfig(userId)
    const merged = warmupConfigFields.parse({
      dailyLimit: current.dailyLimit,
      minDelayMinutes: current.minDelayMinutes,
      maxDelayMinutes: current.maxDelayMinutes,
      activeStartHour: current.activeStartHour,
      activeEndHour: current.activeEndHour,
      timezone: current.timezone,
      repliesEnabled: current.repliesEnabled,
      rampUpEnabled: current.rampUpEnabled,
      rampStartVolume: current.rampStartVolume,
      rampIncrement: current.rampIncrement,
      ...input,
    })
    const problem = validateWarmupConfig(merged)
    if (problem) throw badRequest(problem)

    if (merged.repliesEnabled && !current.repliesEnabled) {
      const { target } = await loadMailboxes(userId)
      if (!target?.smtpEnabled) {
        throw badRequest("Configure SMTP on the target mailbox (Enable Replies) before turning on replies")
      }
    }

    const updated = await prisma.warmupConfig.update({ where: { id: current.id }, data: merged })
    const scheduleChanged = SCHEDULE_FIELDS.some((k) => updated[k] !== current[k])
    if (updated.enabled && scheduleChanged) {
      await schedulerService.cancelScheduled(updated.id)
      await schedulerService.planToday(updated.id)
    }
    return this.getOverview(userId)
  },

  async start(userId: string) {
    const config = await this.getOrCreateConfig(userId)
    const { warmup, target } = await loadMailboxes(userId)
    if (!warmup || !target) throw new AppError(400, "MAILBOXES_REQUIRED", "Connect both the warmup and target mailboxes first")
    if (warmup.status !== "CONNECTED") throw new AppError(400, "WARMUP_NOT_CONNECTED", "Test the warmup mailbox SMTP connection successfully first")
    if (target.status !== "CONNECTED") throw new AppError(400, "TARGET_NOT_CONNECTED", "Test the target mailbox connection successfully first")
    if (config.repliesEnabled && target.smtpTestStatus !== "SUCCESS") {
      throw new AppError(400, "REPLY_SMTP_NOT_CONNECTED", "Replies are enabled: test the target mailbox SMTP connection first")
    }

    if (!config.enabled) {
      await prisma.warmupConfig.update({
        where: { id: config.id },
        data: { enabled: true, startedAt: config.startedAt ?? new Date() },
      })
    }
    await schedulerService.planToday(config.id)
    return this.getOverview(userId)
  },

  async pause(userId: string) {
    const config = await this.getOrCreateConfig(userId)
    await prisma.warmupConfig.update({ where: { id: config.id }, data: { enabled: false } })
    await schedulerService.cancelScheduled(config.id)
    return this.getOverview(userId)
  },

  /** Sends one real test message A → B right now and queues IMAP verification. The recipient is never caller-supplied. */
  async testSend(userId: string) {
    const config = await this.getOrCreateConfig(userId)
    const { warmup, target } = await loadMailboxes(userId)
    if (!warmup || !target) throw new AppError(400, "MAILBOXES_REQUIRED", "Connect both the warmup and target mailboxes first")
    if (warmup.type !== "WARMUP" || target.type !== "TARGET") throw new AppError(400, "INVALID_MAILBOX_ROLES", "Mailbox roles are invalid")

    const win = dayWindow(new Date(), config.timezone, 0, 24)
    const testsToday = await prisma.warmupMessage.count({
      where: { warmupConfigId: config.id, type: "TEST", createdAt: { gte: win.dayStart, lt: win.dayEnd } },
    })
    if (testsToday >= MAX_TEST_SENDS_PER_DAY) {
      throw new AppError(429, "TEST_LIMIT_REACHED", `Test sends are limited to ${MAX_TEST_SENDS_PER_DAY} per day`)
    }

    const testId = generateTestId()
    const scheduledAt = new Date()
    const content = await planContent({ configId: config.id, type: "TEST", config, testId, scheduledAt, from: warmup.email, to: target.email })
    const message = await prisma.warmupMessage.create({
      data: {
        warmupConfigId: config.id,
        type: "TEST",
        testId,
        subject: content.subject,
        templateId: content.templateId,
        from: warmup.email,
        to: target.email,
        status: "SCHEDULED",
        scheduledAt,
      },
    })
    await eventService.record(userId, "SCHEDULED", { warmupMessageId: message.id, metadata: { testId, manual: true } })

    const outcome = await performSend(message.id, { canRetry: false })
    if (outcome.status === "FAILED") {
      throw new AppError(422, outcome.error.code, outcome.error.message, { testId })
    }
    if (outcome.status !== "SENT") throw new AppError(409, "SEND_SKIPPED", "Test message was not sent")
    return prisma.warmupMessage.findUniqueOrThrow({ where: { id: message.id } })
  },
}
