import IORedis from "ioredis"
import { env } from "../config/env"

let connection: IORedis | undefined

// BullMQ requires maxRetriesPerRequest = null on connections used by workers.
export function getRedisConnection(): IORedis {
  if (!connection) {
    connection = new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null })
  }
  return connection
}

export async function closeRedisConnection() {
  if (connection) {
    await connection.quit().catch(() => connection?.disconnect())
    connection = undefined
  }
}
