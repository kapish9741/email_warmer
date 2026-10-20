import type { FastifyReply, FastifyRequest } from "fastify"
import jwt from "jsonwebtoken"
import { env } from "../config/env"
import { AUTH_COOKIE, AUTH_TOKEN_TTL_SECONDS } from "../config/constants"
import { unauthorized } from "../utils/errors"

declare module "fastify" {
  interface FastifyRequest {
    userId: string
  }
}

interface TokenPayload {
  sub: string
}

export function signToken(userId: string): string {
  return jwt.sign({ sub: userId } satisfies TokenPayload, env.JWT_SECRET, { expiresIn: AUTH_TOKEN_TTL_SECONDS })
}

function readToken(request: FastifyRequest): string | undefined {
  const header = request.headers.authorization
  if (header?.startsWith("Bearer ")) return header.slice(7)
  return request.cookies?.[AUTH_COOKIE]
}

export async function requireAuth(request: FastifyRequest, _reply: FastifyReply) {
  const token = readToken(request)
  if (!token) throw unauthorized()
  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as TokenPayload
    request.userId = payload.sub
  } catch {
    throw unauthorized("Session expired. Please sign in again")
  }
}
