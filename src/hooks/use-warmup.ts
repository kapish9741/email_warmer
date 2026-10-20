"use client"

import { useApi } from "@/hooks/use-api"
import { api } from "@/lib/api"
import type { WarmupMessage, WarmupOverview } from "@/lib/types"

/** Warmup overview plus today's messages, refreshed while the page is open so progress shows up live. */
export function useWarmupToday(pollMs = 10_000) {
  return useApi<{ overview: WarmupOverview; messages: WarmupMessage[] }>(
    async () => {
      const overview = await api.getWarmupConfig()
      if (!overview.success) return overview
      const messages = await api.getMessages({ from: overview.data.today.dayStart, to: overview.data.today.dayEnd, limit: 500 })
      if (!messages.success) return messages
      return { success: true, data: { overview: overview.data, messages: messages.data } }
    },
    { pollMs },
  )
}
