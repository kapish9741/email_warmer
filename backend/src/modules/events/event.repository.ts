import type { EventType, Prisma } from "@prisma/client"
import { prisma } from "../../db/prisma"

export const eventRepository = {
  create(data: { userId: string; type: EventType; warmupMessageId?: string; metadata?: Prisma.InputJsonValue }) {
    return prisma.event.create({ data })
  },

  list(userId: string, opts: { limit: number; since?: Date; type?: EventType }) {
    return prisma.event.findMany({
      where: {
        userId,
        ...(opts.since ? { createdAt: { gte: opts.since } } : {}),
        ...(opts.type ? { type: opts.type } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: opts.limit,
      include: { warmupMessage: { select: { testId: true, subject: true, type: true } } },
    })
  },
}
