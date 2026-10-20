import pino from "pino"
import { env } from "../config/env"
import { REDACT_PATHS } from "../security/redaction"

const loggerOptions: pino.LoggerOptions = {
  level: env.LOG_LEVEL,
  redact: { paths: REDACT_PATHS, censor: "[REDACTED]" },
}

export const logger = pino(loggerOptions)
