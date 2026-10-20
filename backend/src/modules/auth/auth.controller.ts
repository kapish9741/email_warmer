import type { FastifyInstance, FastifyReply } from "fastify"
import bcrypt from "bcryptjs"
import { z } from "zod"
import { prisma } from "../../db/prisma"
import { AUTH_COOKIE, AUTH_TOKEN_TTL_SECONDS } from "../../config/constants"
import { isProduction } from "../../config/env"
import { requireAuth, signToken } from "../../middleware/auth"
import { authRateLimit } from "../../middleware/rate-limit"
import { AppError, conflict, unauthorized } from "../../utils/errors"

const credentialsSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters").max(200),
})

function setSession(reply: FastifyReply, userId: string) {
  reply.setCookie(AUTH_COOKIE, signToken(userId), {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: isProduction,
    maxAge: AUTH_TOKEN_TTL_SECONDS,
  })
}

export async function authRoutes(app: FastifyInstance) {
  app.post("/api/auth/register", authRateLimit, async (request, reply) => {
    const { email, password } = credentialsSchema.parse(request.body)
    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) throw conflict("EMAIL_TAKEN", "An account with this email already exists")
    const user = await prisma.user.create({ data: { email, passwordHash: await bcrypt.hash(password, 12) } })
    setSession(reply, user.id)
    return reply.status(201).send({ success: true, data: { id: user.id, email: user.email } })
  })

  app.post("/api/auth/login", authRateLimit, async (request, reply) => {
    const { email, password } = credentialsSchema.parse(request.body)
    const user = await prisma.user.findUnique({ where: { email } })
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new AppError(401, "INVALID_CREDENTIALS", "Invalid email or password")
    }
    setSession(reply, user.id)
    return { success: true, data: { id: user.id, email: user.email } }
  })

  app.post("/api/auth/logout", async (_request, reply) => {
    reply.clearCookie(AUTH_COOKIE, { path: "/" })
    return { success: true, data: {} }
  })

  app.get("/api/auth/me", { preHandler: requireAuth }, async (request) => {
    const user = await prisma.user.findUnique({
      where: { id: request.userId },
      select: { id: true, email: true, createdAt: true },
    })
    if (!user) throw unauthorized()
    return { success: true, data: user }
  })
}
