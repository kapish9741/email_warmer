import type { FastifyInstance } from "fastify"
import { z } from "zod"
import { requireAuth } from "../../middleware/auth"
import { providerRateLimit } from "../../middleware/rate-limit"
import { createMailboxSchema, updateMailboxSchema } from "./mailbox.schema"
import { mailboxService, type ConnectionTestResult } from "./mailbox.service"

const idParams = z.object({ id: z.string().uuid("Invalid mailbox id") })

function sendTestResult(result: ConnectionTestResult) {
  if (result.success) {
    return { success: true, data: { message: result.message, testedAt: result.testedAt, mailbox: result.mailbox } }
  }
  return { success: false, error: result.error }
}

export async function mailboxRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireAuth)

  app.get("/api/mailboxes", async (request) => {
    return { success: true, data: await mailboxService.list(request.userId) }
  })

  app.post("/api/mailboxes", async (request, reply) => {
    const input = createMailboxSchema.parse(request.body)
    return reply.status(201).send({ success: true, data: await mailboxService.create(request.userId, input) })
  })

  app.get("/api/mailboxes/:id", async (request) => {
    const { id } = idParams.parse(request.params)
    return { success: true, data: await mailboxService.get(request.userId, id) }
  })

  app.patch("/api/mailboxes/:id", async (request) => {
    const { id } = idParams.parse(request.params)
    const input = updateMailboxSchema.parse(request.body)
    return { success: true, data: await mailboxService.update(request.userId, id, input) }
  })

  app.delete("/api/mailboxes/:id", async (request) => {
    const { id } = idParams.parse(request.params)
    await mailboxService.remove(request.userId, id)
    return { success: true, data: {} }
  })

  app.post("/api/mailboxes/:id/test-smtp", providerRateLimit, async (request, reply) => {
    const { id } = idParams.parse(request.params)
    const result = await mailboxService.testSmtp(request.userId, id)
    return reply.status(result.success ? 200 : 422).send(sendTestResult(result))
  })

  app.post("/api/mailboxes/:id/test-imap", providerRateLimit, async (request, reply) => {
    const { id } = idParams.parse(request.params)
    const result = await mailboxService.testImap(request.userId, id)
    return reply.status(result.success ? 200 : 422).send(sendTestResult(result))
  })
}
