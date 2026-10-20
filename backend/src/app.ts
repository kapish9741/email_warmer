import Fastify from "fastify"
import cookie from "@fastify/cookie"
import { env } from "./config/env"
import { errorHandler } from "./middleware/error-handler"
import { registerRateLimit } from "./middleware/rate-limit"
import { authRoutes } from "./modules/auth/auth.controller"
import { eventRoutes } from "./modules/events/event.controller"
import { mailboxRoutes } from "./modules/mailboxes/mailbox.controller"
import { messageRoutes } from "./modules/messages/message.controller"
import { warmupRoutes } from "./modules/warmup/warmup.controller"
import { REDACT_PATHS } from "./security/redaction"

export async function buildApp() {
  const app = Fastify({
    logger: { level: env.LOG_LEVEL, redact: { paths: REDACT_PATHS, censor: "[REDACTED]" } },
    trustProxy: true,
  })

  app.setErrorHandler(errorHandler)
  app.setNotFoundHandler((_request, reply) => {
    reply.status(404).send({ success: false, error: { code: "NOT_FOUND", message: "Route not found" } })
  })

  // Action endpoints (start, pause, test-send) take no body; accept an empty JSON body instead of rejecting it.
  app.removeContentTypeParser("application/json")
  app.addContentTypeParser("application/json", { parseAs: "string" }, (_request, body, done) => {
    const text = typeof body === "string" ? body : body.toString("utf8")
    if (!text.trim()) return done(null, {})
    try {
      done(null, JSON.parse(text))
    } catch {
      done(Object.assign(new Error("Invalid JSON body"), { statusCode: 400 }), undefined)
    }
  })

  await app.register(cookie)
  await registerRateLimit(app)

  // Optional direct browser access; in development the Next.js app proxies /api so no CORS is needed.
  const allowedOrigins = env.CORS_ORIGINS.split(",").map((o) => o.trim()).filter(Boolean)
  if (allowedOrigins.length) {
    app.addHook("onRequest", async (request, reply) => {
      const origin = request.headers.origin
      if (origin && allowedOrigins.includes(origin)) {
        reply.header("Access-Control-Allow-Origin", origin)
        reply.header("Access-Control-Allow-Credentials", "true")
        reply.header("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,OPTIONS")
        reply.header("Access-Control-Allow-Headers", "Content-Type,Authorization")
        reply.header("Vary", "Origin")
      }
      if (request.method === "OPTIONS") return reply.status(204).send()
    })
  }

  app.get("/health", async () => ({ status: "ok", timestamp: new Date().toISOString() }))
  app.get("/api/health", async () => ({ status: "ok", timestamp: new Date().toISOString() }))

  await app.register(authRoutes)
  await app.register(mailboxRoutes)
  await app.register(warmupRoutes)
  await app.register(messageRoutes)
  await app.register(eventRoutes)

  return app
}
