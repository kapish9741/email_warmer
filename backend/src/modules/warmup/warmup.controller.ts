import type { FastifyInstance } from "fastify"
import { requireAuth } from "../../middleware/auth"
import { providerRateLimit } from "../../middleware/rate-limit"
import { updateWarmupConfigSchema, warmupConfigFields } from "./warmup.schema"
import { warmupService } from "./warmup.service"

export async function warmupRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireAuth)

  app.get("/api/warmup/config", async (request) => {
    return { success: true, data: await warmupService.getOverview(request.userId) }
  })

  // POST replaces the whole configuration; PATCH updates individual fields.
  app.post("/api/warmup/config", async (request) => {
    const input = warmupConfigFields.parse(request.body)
    return { success: true, data: await warmupService.updateConfig(request.userId, input) }
  })

  app.patch("/api/warmup/config", async (request) => {
    const input = updateWarmupConfigSchema.parse(request.body)
    return { success: true, data: await warmupService.updateConfig(request.userId, input) }
  })

  app.post("/api/warmup/start", async (request) => {
    return { success: true, data: await warmupService.start(request.userId) }
  })

  app.post("/api/warmup/pause", async (request) => {
    return { success: true, data: await warmupService.pause(request.userId) }
  })

  app.post("/api/warmup/test-send", providerRateLimit, async (request) => {
    return { success: true, data: await warmupService.testSend(request.userId) }
  })
}
