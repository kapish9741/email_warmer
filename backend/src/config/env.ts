import dotenv from "dotenv"
import { z } from "zod"

dotenv.config()

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  HOST: z.string().default("0.0.0.0"),
  DATABASE_URL: z.string().default(""),
  DIRECT_URL: z.string().optional(),
  REDIS_URL: z.string().default("redis://localhost:6379"),
  APP_ENCRYPTION_KEY: z.string().min(32).default("0123456789abcdef0123456789abcdef"),
  JWT_SECRET: z.string().min(16).default("kapishjwtmailwarmer"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  // Comma-separated list of browser origins allowed to call the API directly (optional when proxied through Next.js).
  CORS_ORIGINS: z.string().default(""),
})

const parsed = envSchema.safeParse(process.env)

if (!parsed.success) {
  const issues = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n")
  console.error(`Invalid environment configuration:\n${issues}`)
}

export const env = parsed.success ? parsed.data : envSchema.parse({})
export const isProduction = env.NODE_ENV === "production"
export const isDbConfigured = Boolean(env.DATABASE_URL)
