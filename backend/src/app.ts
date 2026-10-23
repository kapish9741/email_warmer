import Fastify from "fastify"
import cookie from "@fastify/cookie"
import { env, isDbConfigured } from "./config/env"
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

  // Direct browser access support: allow configured origins, or any localhost / vercel origin
  const explicitOrigins = env.CORS_ORIGINS.split(",").map((o) => o.trim()).filter(Boolean)
  app.addHook("onRequest", async (request, reply) => {
    const origin = request.headers.origin
    if (origin) {
      const isAllowed =
        explicitOrigins.length === 0 ||
        explicitOrigins.includes(origin) ||
        explicitOrigins.includes("*") ||
        origin.startsWith("http://localhost:") ||
        origin.endsWith(".vercel.app")

      if (isAllowed) {
        reply.header("Access-Control-Allow-Origin", origin)
        reply.header("Access-Control-Allow-Credentials", "true")
        reply.header("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,OPTIONS")
        reply.header("Access-Control-Allow-Headers", "Content-Type,Authorization,Cookie")
        reply.header("Vary", "Origin")
      }
    }
    if (request.method === "OPTIONS") return reply.status(204).send()
  })

  app.get("/", async () => ({ status: "ok", name: "email-warmer-backend", timestamp: new Date().toISOString() }))
  app.get("/health", async () => ({
    status: isDbConfigured ? "ok" : "degraded",
    database: isDbConfigured ? "connected" : "DATABASE_URL_NOT_SET",
    timestamp: new Date().toISOString(),
  }))
  app.get("/api/health", async () => ({
    status: isDbConfigured ? "ok" : "degraded",
    database: isDbConfigured ? "connected" : "DATABASE_URL_NOT_SET",
    timestamp: new Date().toISOString(),
  }))

  await app.register(authRoutes)
  await app.register(mailboxRoutes)
  await app.register(warmupRoutes)
  await app.register(messageRoutes)
  await app.register(eventRoutes)

  return app
}
