import type { FastifyInstance } from "fastify"
import type { Prisma } from "@prisma/client"
import { z } from "zod"
import { prisma } from "../../db/prisma"
import { requireAuth } from "../../middleware/auth"
import { notFound } from "../../utils/errors"

const listQuery = z.object({
  status: z.enum(["SCHEDULED", "SENDING", "SENT", "RECEIVED", "BOUNCED", "FAILED", "TIMEOUT", "REPLY_SENT"]).optional(),
  type: z.enum(["WARMUP", "TEST"]).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  q: z.string().trim().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(1000).default(200),
})

export async function messageRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireAuth)

  app.get("/api/messages", async (request) => {
    const query = listQuery.parse(request.query)
    const where: Prisma.WarmupMessageWhereInput = {
      warmupConfig: { userId: request.userId },
      ...(query.status ? { status: query.status } : {}),
      ...(query.type ? { type: query.type } : {}),
      ...(query.from || query.to ? { scheduledAt: { ...(query.from ? { gte: query.from } : {}), ...(query.to ? { lt: query.to } : {}) } } : {}),
      ...(query.q
        ? {
            OR: [
              { subject: { contains: query.q, mode: "insensitive" } },
              { testId: { contains: query.q, mode: "insensitive" } },
              { messageId: { contains: query.q, mode: "insensitive" } },
              { from: { contains: query.q, mode: "insensitive" } },
              { to: { contains: query.q, mode: "insensitive" } },
            ],
          }
        : {}),
    }
    const messages = await prisma.warmupMessage.findMany({ where, orderBy: { scheduledAt: "desc" }, take: query.limit })
    return { success: true, data: messages }
  })

  app.get("/api/messages/:id", async (request) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params)
    const message = await prisma.warmupMessage.findFirst({
      where: { id, warmupConfig: { userId: request.userId } },
      include: { events: { orderBy: { createdAt: "asc" } } },
    })
    if (!message) throw notFound("Message not found")
    return { success: true, data: message }
  })
}
