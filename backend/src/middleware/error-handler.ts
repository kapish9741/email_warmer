import type { FastifyError, FastifyReply, FastifyRequest } from "fastify"
import { ZodError } from "zod"
import { AppError } from "../utils/errors"

export function errorHandler(error: FastifyError | Error, request: FastifyRequest, reply: FastifyReply) {
  if (error instanceof ZodError) {
    return reply.status(400).send({
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: error.issues[0]?.message ?? "Invalid request",
        fields: error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
      },
    })
  }

  if (error instanceof AppError) {
    return reply.status(error.statusCode).send({
      success: false,
      error: { code: error.code, message: error.message, ...(error.details ? { details: error.details } : {}) },
    })
  }

  const statusCode = (error as FastifyError).statusCode
  if (statusCode === 429) {
    return reply.status(429).send({ success: false, error: { code: "RATE_LIMITED", message: "Too many requests. Try again shortly" } })
  }
  if (statusCode && statusCode >= 400 && statusCode < 500) {
    return reply.status(statusCode).send({ success: false, error: { code: "BAD_REQUEST", message: error.message } })
  }

  request.log.error({ err: error }, "Unhandled error")
  return reply.status(500).send({ success: false, error: { code: "INTERNAL_ERROR", message: "Something went wrong" } })
}
