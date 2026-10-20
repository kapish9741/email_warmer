import type { MessageStatus, WarmupConfig } from "@prisma/client"
import { prisma } from "../../db/prisma"
import { enqueueSend, removeSendJob } from "../../queues/queues"
import { generateTestId } from "../../utils/ids"
import { dayWindow, daysBetweenKeys, localDayKey, randomBetween } from "../../utils/time"
import { logger } from "../../utils/logger"
import { eventService } from "../events/event.service"
import { planContent } from "./message-content"

const MINUTE = 60_000

/** Statuses that mean the SMTP server actually accepted the message. Only these count toward the daily limit. */
export const SENT_STATUSES: MessageStatus[] = ["SENT", "RECEIVED", "REPLY_SENT", "TIMEOUT", "BOUNCED"]

type ScheduleConfig = Pick<
  WarmupConfig,
  | "dailyLimit"
  | "rampUpEnabled"
  | "rampStartVolume"
  | "rampIncrement"
  | "startedAt"
  | "timezone"
  | "activeStartHour"
  | "activeEndHour"
  | "minDelayMinutes"
  | "maxDelayMinutes"
>

/** Ramp-up day number (1-based) and the resulting volume limit for the local day containing `now`. */
export function computeDailyLimit(config: ScheduleConfig, now = new Date()) {
  const day = config.startedAt
    ? daysBetweenKeys(localDayKey(config.startedAt, config.timezone), localDayKey(now, config.timezone)) + 1
    : 1
  const rampDay = Math.max(1, day)
  const limit = config.rampUpEnabled
    ? Math.min(config.dailyLimit, config.rampStartVolume + config.rampIncrement * (rampDay - 1))
    : config.dailyLimit
  return { rampDay, limit: Math.max(1, limit) }
}

/**
 * Picks send times for `count` messages: the first shortly after `from`, each next one
 * minDelay..maxDelay after the previous, never past the end of the active window.
 */
export function planSendTimes(
  config: Pick<ScheduleConfig, "minDelayMinutes" | "maxDelayMinutes">,
  opts: { from: Date; windowEnd: Date; count: number; previous?: Date },
): Date[] {
  const times: Date[] = []
  let cursor = opts.previous
    ? Math.max(opts.previous.getTime() + randomBetween(config.minDelayMinutes, config.maxDelayMinutes) * MINUTE, opts.from.getTime())
    : opts.from.getTime() + randomBetween(1, 10) * MINUTE
  while (times.length < opts.count && cursor < opts.windowEnd.getTime()) {
    times.push(new Date(Math.round(cursor)))
    cursor += randomBetween(config.minDelayMinutes, config.maxDelayMinutes) * MINUTE
  }
  return times
}

export const schedulerService = {
  /** Plans the remaining warmup messages for today. Safe to call repeatedly. */
  async planToday(configId: string, now = new Date()) {
    const config = await prisma.warmupConfig.findUnique({
      where: { id: configId },
      include: { warmupMailbox: true, targetMailbox: true },
    })
    if (!config || !config.enabled || !config.warmupMailbox || !config.targetMailbox) return []

    const { limit } = computeDailyLimit(config, now)
    const win = dayWindow(now, config.timezone, config.activeStartHour, config.activeEndHour)
    if (now >= win.windowEnd) return []

    const todays = await prisma.warmupMessage.findMany({
      where: { warmupConfigId: config.id, type: "WARMUP", scheduledAt: { gte: win.dayStart, lt: win.dayEnd } },
      orderBy: { scheduledAt: "desc" },
      select: { scheduledAt: true, status: true },
    })
    // Failed sends don't count; everything else (sent or still pending) does.
    const used = todays.filter((m) => m.status !== "FAILED").length
    const remaining = limit - used
    if (remaining <= 0) return []

    const from = new Date(Math.max(now.getTime(), win.windowStart.getTime()))
    const times = planSendTimes(config, {
      from,
      windowEnd: win.windowEnd,
      count: remaining,
      previous: todays[0]?.scheduledAt,
    })
    if (times.length === 0) return []

    const created = []
    const batchTemplateIds: string[] = []
    for (const scheduledAt of times) {
      const testId = generateTestId()
      const content = await planContent({
        configId: config.id,
        type: "WARMUP",
        config,
        testId,
        scheduledAt,
        from: config.warmupMailbox.email,
        to: config.targetMailbox.email,
        pendingIds: batchTemplateIds,
      })
      batchTemplateIds.unshift(content.templateId)
      const message = await prisma.warmupMessage.create({
        data: {
          warmupConfigId: config.id,
          type: "WARMUP",
          testId,
          subject: content.subject,
          templateId: content.templateId,
          from: config.warmupMailbox.email,
          to: config.targetMailbox.email,
          status: "SCHEDULED",
          scheduledAt,
        },
      })
      await eventService.record(config.userId, "SCHEDULED", {
        warmupMessageId: message.id,
        metadata: { testId, scheduledAt: scheduledAt.toISOString() },
      })
      await enqueueSend(message.id, scheduledAt)
      created.push(message)
    }
    logger.info({ configId, count: created.length, day: win.dayKey }, "Planned warmup messages")
    return created
  },

  /** Removes messages that were scheduled but never sent (used on pause or schedule changes). */
  async cancelScheduled(configId: string) {
    const pending = await prisma.warmupMessage.findMany({
      where: { warmupConfigId: configId, status: "SCHEDULED", type: "WARMUP" },
      select: { id: true },
    })
    for (const m of pending) await removeSendJob(m.id)
    // Only rows still SCHEDULED are deleted; a worker that already claimed one (SENDING) keeps it.
    await prisma.warmupMessage.deleteMany({ where: { id: { in: pending.map((m) => m.id) }, status: "SCHEDULED" } })
    return pending.length
  },

  /** Periodic maintenance: plan each running warmup's day and recover from worker or Redis restarts. */
  async tick(now = new Date()) {
    const configs = await prisma.warmupConfig.findMany({ where: { enabled: true }, select: { id: true } })
    for (const { id } of configs) {
      try {
        await this.planToday(id, now)
      } catch (err) {
        logger.error({ err, configId: id }, "Failed to plan warmup day")
      }
    }

    // Re-enqueue overdue scheduled messages whose job may have been lost (jobId dedup makes this idempotent).
    const overdue = await prisma.warmupMessage.findMany({
      where: { status: "SCHEDULED", scheduledAt: { lt: new Date(now.getTime() - 2 * MINUTE) } },
      select: { id: true, scheduledAt: true },
      take: 100,
    })
    for (const m of overdue) await enqueueSend(m.id, now)

    // A message stuck in SENDING means a worker died mid-send; we can't know if the server accepted it.
    const stuck = await prisma.warmupMessage.findMany({
      where: { status: "SENDING", updatedAt: { lt: new Date(now.getTime() - 15 * MINUTE) } },
      include: { warmupConfig: { select: { userId: true } } },
    })
    for (const m of stuck) {
      const { count } = await prisma.warmupMessage.updateMany({
        where: { id: m.id, status: "SENDING" },
        data: {
          status: "FAILED",
          errorCode: "WORKER_INTERRUPTED",
          errorMessage: "Sending was interrupted; delivery state unknown",
        },
      })
      if (count) {
        await eventService.record(m.warmupConfig.userId, "FAILED", {
          warmupMessageId: m.id,
          metadata: { stage: "SEND", code: "WORKER_INTERRUPTED" },
        })
      }
    }
  },
}
