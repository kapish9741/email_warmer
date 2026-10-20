import type { FastifyInstance } from "fastify"
import rateLimit from "@fastify/rate-limit"

export async function registerRateLimit(app: FastifyInstance) {
  await app.register(rateLimit, { global: true, max: 300, timeWindow: "1 minute" })
}

// Stricter limits for credential-sensitive routes (login, provider connection tests).
export const authRateLimit = { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } }
export const providerRateLimit = { config: { rateLimit: { max: 20, timeWindow: "1 minute" } } }
