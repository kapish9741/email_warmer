import { Worker } from "bullmq"
import { QUEUE_NAMES } from "../../config/constants"
import { performReply } from "../../modules/warmup/delivery.service"
import { getRedisConnection } from "../connection"
import type { ReplyJobData } from "../queues"

export function createReplyWorker() {
  return new Worker<ReplyJobData>(
    QUEUE_NAMES.reply,
    async (job) => {
      const maxAttempts = job.opts.attempts ?? 1
      await performReply(job.data.messageId, { canRetry: job.attemptsMade + 1 < maxAttempts })
    },
    { connection: getRedisConnection(), concurrency: 1 },
  )
}
