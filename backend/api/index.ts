import { buildApp } from "../src/app"

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
