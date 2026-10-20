"use client"

import { createContext, useCallback, useContext, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { api } from "@/lib/api"
import type { User } from "@/lib/types"
import { Skeleton } from "@/components/ui/skeleton"

interface AuthContextValue {
  user: User
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

/** Gates the dashboard behind a valid backend session. */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)

  useEffect(() => {
    api.me().then((res) => {
      if (res.success) setUser(res.data)
      else router.replace("/login")
    })
  }, [router])

  const logout = useCallback(async () => {
    await api.logout()
    router.replace("/login")
  }, [router])

  if (!user) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center" aria-busy="true" aria-label="Loading">
        <Skeleton className="h-8 w-48" />
      </div>
    )
  }

  return <AuthContext.Provider value={{ user, logout }}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider")
  return ctx
}
