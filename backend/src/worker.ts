import { Worker } from "bullmq"
import { QUEUE_NAMES, SCHEDULER_TICK_MS } from "./config/constants"
import { prisma } from "./db/prisma"
import { schedulerService } from "./modules/warmup/scheduler.service"
import { closeRedisConnection, getRedisConnection } from "./queues/connection"
import { closeQueues, getQueues } from "./queues/queues"
import { createReceiveWorker } from "./queues/workers/receive.worker"
import { createReplyWorker } from "./queues/workers/reply.worker"
import { createSendWorker } from "./queues/workers/send.worker"
import { logger } from "./utils/logger"

async function main() {
  const workers = [createSendWorker(), createReceiveWorker(), createReplyWorker()]

  // The scheduler tick plans each running warmup's day and repairs lost jobs.
  const schedulerWorker = new Worker(QUEUE_NAMES.scheduler, () => schedulerService.tick(), {
    connection: getRedisConnection(),
    concurrency: 1,
  })
  workers.push(schedulerWorker)
  await getQueues().scheduler.upsertJobScheduler("tick", { every: SCHEDULER_TICK_MS }, { name: "tick" })

  for (const w of workers) {
    w.on("failed", (job, err) => logger.warn({ queue: w.name, jobId: job?.id, err: err.message }, "Job failed"))
    w.on("error", (err) => logger.error({ queue: w.name, err: err.message }, "Worker error"))
  }
  logger.info("Warmup worker started")

  const shutdown = async () => {
    logger.info("Shutting down worker")
    await Promise.all(workers.map((w) => w.close()))
    await closeQueues()
    await closeRedisConnection()
    await prisma.$disconnect()
    process.exit(0)
  }
  process.on("SIGINT", shutdown)
  process.on("SIGTERM", shutdown)
}

main().catch((err) => {
  logger.fatal({ err }, "Worker failed to start")
  process.exit(1)
})
