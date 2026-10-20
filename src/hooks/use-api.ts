"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type { ApiError, ApiResponse } from "@/lib/api"

/**
 * Loads backend data and optionally re-polls it so the UI follows the worker's real progress.
 * Polling pauses while the tab is hidden.
 */
export function useApi<T>(fetcher: () => Promise<ApiResponse<T>>, opts: { pollMs?: number; deps?: unknown[] } = {}) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<ApiError | null>(null)
  const [loading, setLoading] = useState(true)
  const fetcherRef = useRef(fetcher)
  useEffect(() => {
    fetcherRef.current = fetcher
  })

  const refresh = useCallback(async () => {
    const res = await fetcherRef.current()
    if (res.success) {
      setData(res.data)
      setError(null)
    } else {
      setError(res.error)
    }
    setLoading(false)
    return res
  }, [])

  const deps = opts.deps ?? []
  useEffect(() => {
    refresh()
    if (!opts.pollMs) return
    const id = setInterval(() => {
      if (document.visibilityState === "visible") refresh()
    }, opts.pollMs)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refresh, opts.pollMs, ...deps])

  return { data, error, loading, refresh, setData }
}
