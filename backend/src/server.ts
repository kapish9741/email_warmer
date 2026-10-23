import { env } from "./config/env"
import { buildApp } from "./app"
import { prisma } from "./db/prisma"
import { closeRedisConnection } from "./queues/connection"
import { closeQueues } from "./queues/queues"

let appInstance: any = null

export async function getApp() {
  if (!appInstance) {
    appInstance = await buildApp()
    await appInstance.ready()
  }
  return appInstance
}

export default async function handler(req: any, res: any) {
  const app = await getApp()
  app.server.emit("request", req, res)
}

// In standalone / Docker / local development mode (not Vercel Serverless Function):
if (!process.env.VERCEL) {
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
}
