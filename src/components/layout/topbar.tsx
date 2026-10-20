"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect } from "react"
import { AlertCircle, Bell, Search } from "lucide-react"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { ThemeToggle } from "@/components/theme-toggle"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { useAuth } from "@/components/auth/auth-provider"
import { useApi } from "@/hooks/use-api"
import { api } from "@/lib/api"
import { describeEvent, formatRelative } from "@/lib/format"

export function Topbar() {
  const router = useRouter()
  const { user, logout } = useAuth()
  const { data: failures } = useApi(
    () => api.getEvents({ type: "FAILED", since: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), limit: 10 }),
    { pollMs: 30_000 },
  )

  // ⌘K / Ctrl+K jumps to the searchable activity log.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        router.push("/activity")
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [router])

  const initials = user.email.slice(0, 2).toUpperCase()
  const hasFailures = Boolean(failures && failures.length > 0)

  return (
    <header className="sticky top-0 z-50 flex h-14 shrink-0 items-center gap-2 border-b bg-background/80 px-4 backdrop-blur-md">
      <div className="flex flex-1 items-center gap-2">
        <SidebarTrigger className="-ml-1" />
        <div className="hidden md:flex items-center gap-2 text-sm text-muted-foreground w-full max-w-sm ml-2">
          <Button
            variant="outline"
            nativeButton={false}
            render={<Link href="/activity" />}
            className="w-full justify-start text-muted-foreground bg-muted/50 h-9 relative"
          >
            <Search className="mr-2 h-4 w-4" />
            <span>Search activity...</span>
            <kbd className="pointer-events-none absolute right-1.5 top-2 hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
              <span className="text-xs">⌘</span>K
            </kbd>
          </Button>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 rounded-full relative"
                aria-label={hasFailures ? `Notifications: ${failures!.length} recent failures` : "Notifications"}
              >
                <Bell className="h-4 w-4" />
                {hasFailures && <span className="absolute top-2 right-2.5 h-2 w-2 rounded-full bg-destructive" />}
              </Button>
            }
          />
          <DropdownMenuContent className="w-80" align="end">
            <DropdownMenuGroup>
              <DropdownMenuLabel className="text-xs">Failures in the last 24 hours</DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            {!hasFailures ? (
              <div className="px-2 py-4 text-center text-xs text-muted-foreground">No failures. Everything is running normally.</div>
            ) : (
              failures!.map((evt) => {
                const { title, detail } = describeEvent(evt)
                return (
                  <DropdownMenuItem key={evt.id} className="items-start gap-2" onClick={() => router.push("/activity")}>
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                    <div className="min-w-0">
                      <p className="text-xs font-medium">{title}</p>
                      {detail && <p className="truncate text-xs text-muted-foreground">{detail}</p>}
                      <p className="text-[11px] text-muted-foreground">{formatRelative(evt.createdAt)}</p>
                    </div>
                  </DropdownMenuItem>
                )
              })
            )}
          </DropdownMenuContent>
        </DropdownMenu>
        <ThemeToggle />
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="ghost" className="relative h-9 w-9 rounded-full ml-1" aria-label="User menu">
                <Avatar className="h-9 w-9">
                  <AvatarFallback>{initials}</AvatarFallback>
                </Avatar>
              </Button>
            }
          />
          <DropdownMenuContent className="w-56" align="end">
            <DropdownMenuGroup>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">Signed in as</p>
                  <p className="truncate text-xs leading-none text-muted-foreground">{user.email}</p>
                </div>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => router.push("/settings")}>Settings</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={logout}>
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
