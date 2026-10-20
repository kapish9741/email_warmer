import type { EventType, Prisma } from "@prisma/client"
import { redact } from "../../security/redaction"
import { eventRepository } from "./event.repository"

export const eventService = {
  /** Records an event for an operation that actually happened. Metadata is stripped of secret-looking keys. */
  record(userId: string, type: EventType, opts: { warmupMessageId?: string; metadata?: Record<string, unknown> } = {}) {
    return eventRepository.create({
      userId,
      type,
      warmupMessageId: opts.warmupMessageId,
      metadata: opts.metadata ? (redact(opts.metadata) as Prisma.InputJsonValue) : undefined,
    })
  },

  list: eventRepository.list,
}
