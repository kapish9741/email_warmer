import { Worker } from "bullmq"
import { QUEUE_NAMES } from "../../config/constants"
import { checkReceipt } from "../../modules/warmup/delivery.service"
import { getRedisConnection } from "../connection"
import type { ReceiveCheckJobData } from "../queues"

export function createReceiveWorker() {
  return new Worker<ReceiveCheckJobData>(
    QUEUE_NAMES.receiveCheck,
    async (job) => {
      await checkReceipt(job.data.messageId, job.data.check)
    },
    { connection: getRedisConnection(), concurrency: 2 },
  )
}
