import { env } from "./config/env"
import { buildApp } from "./app"
import { prisma } from "./db/prisma"
import { closeRedisConnection } from "./queues/connection"
import { closeQueues } from "./queues/queues"

const start = async () => {
  const app = await buildApp()
  try {
    await app.listen({ port: env.PORT, host: env.HOST })
  } catch (err) {
    app.log.error(err)
    process.exit(1)
  }

  const shutdown = async () => {
    await app.close()
    await closeQueues()
    await closeRedisConnection()
    await prisma.$disconnect()
    process.exit(0)
  }
  process.on("SIGINT", shutdown)
  process.on("SIGTERM", shutdown)
}

start()
