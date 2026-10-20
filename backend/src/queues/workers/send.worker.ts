import { Worker } from "bullmq"
import { QUEUE_NAMES } from "../../config/constants"
import { performSend } from "../../modules/warmup/delivery.service"
import { logger } from "../../utils/logger"
import { getRedisConnection } from "../connection"
import type { SendJobData } from "../queues"

export function createSendWorker() {
  return new Worker<SendJobData>(
    QUEUE_NAMES.send,
    async (job) => {
      const maxAttempts = job.opts.attempts ?? 1
      const outcome = await performSend(job.data.messageId, { canRetry: job.attemptsMade + 1 < maxAttempts })
      if (outcome.status === "RETRY") {
        // Throwing hands the job back to BullMQ for exponential-backoff retry.
        throw new Error(`Transient SMTP failure: ${outcome.error.code}`)
      }
      if (outcome.status === "SKIPPED") logger.info({ messageId: job.data.messageId, reason: outcome.reason }, "Send skipped")
      return outcome.status
    },
    { connection: getRedisConnection(), concurrency: 2 },
  )
}
