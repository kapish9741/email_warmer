import type { FastifyInstance } from "fastify"
import { z } from "zod"
import { requireAuth } from "../../middleware/auth"
import { eventService } from "./event.service"

const listQuery = z.object({
  limit: z.coerce.number().int().min(1).max(500).default(50),
  since: z.coerce.date().optional(),
  type: z
    .enum(["SCHEDULED", "SMTP_CONNECTED", "SMTP_SEND_STARTED", "SMTP_SENT", "IMAP_CONNECTED", "MESSAGE_RECEIVED", "REPLY_SENT", "FAILED"])
    .optional(),
})

export async function eventRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireAuth)

  app.get("/api/events", async (request) => {
    const query = listQuery.parse(request.query)
    return { success: true, data: await eventService.list(request.userId, query) }
  })
}
