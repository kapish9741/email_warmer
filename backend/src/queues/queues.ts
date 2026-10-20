import { Queue } from "bullmq"
import { QUEUE_NAMES, SEND_MAX_ATTEMPTS } from "../config/constants"
import { getRedisConnection } from "./connection"

export interface SendJobData {
  messageId: string
}
export interface ReceiveCheckJobData {
  messageId: string
  check: number
}
export interface ReplyJobData {
  messageId: string
}

const defaultJobOptions = { removeOnComplete: 1000, removeOnFail: 5000 }

let queues:
  | {
      send: Queue<SendJobData>
      receiveCheck: Queue<ReceiveCheckJobData>
      reply: Queue<ReplyJobData>
      scheduler: Queue
    }
  | undefined

export function getQueues() {
  if (!queues) {
    const connection = getRedisConnection()
    queues = {
      send: new Queue<SendJobData>(QUEUE_NAMES.send, { connection, defaultJobOptions }),
      receiveCheck: new Queue<ReceiveCheckJobData>(QUEUE_NAMES.receiveCheck, { connection, defaultJobOptions }),
      reply: new Queue<ReplyJobData>(QUEUE_NAMES.reply, { connection, defaultJobOptions }),
      scheduler: new Queue(QUEUE_NAMES.scheduler, { connection, defaultJobOptions: { removeOnComplete: 50, removeOnFail: 50 } }),
    }
  }
  return queues
}

const sendJobId = (messageId: string) => `send-${messageId}`

/** Job ids are derived from the message id, so enqueueing the same message twice is a no-op. */
export async function enqueueSend(messageId: string, runAt: Date) {
  await getQueues().send.add(
    "send",
    { messageId },
    {
      jobId: sendJobId(messageId),
      delay: Math.max(0, runAt.getTime() - Date.now()),
      attempts: SEND_MAX_ATTEMPTS,
      backoff: { type: "exponential", delay: 60_000 },
    },
  )
}

export async function removeSendJob(messageId: string) {
  const job = await getQueues().send.getJob(sendJobId(messageId))
  if (job && !(await job.isActive())) await job.remove().catch(() => {})
}

export async function enqueueReceiveCheck(messageId: string, check: number, delayMs: number) {
  await getQueues().receiveCheck.add(
    "check",
    { messageId, check },
    { jobId: `receive-${messageId}-${check}`, delay: delayMs, attempts: 1 },
  )
}

export async function enqueueReply(messageId: string, delayMs: number) {
  await getQueues().reply.add(
    "reply",
    { messageId },
    { jobId: `reply-${messageId}`, delay: delayMs, attempts: 3, backoff: { type: "exponential", delay: 60_000 } },
  )
}

export async function closeQueues() {
  if (queues) {
    await Promise.all(Object.values(queues).map((q) => q.close()))
    queues = undefined
  }
}
