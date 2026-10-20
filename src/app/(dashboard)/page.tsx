"use client"

import Link from "next/link"
import { AlertCircle, ArrowUpRight, CheckCircle2, Clock, CornerUpLeft, Inbox, Mail, PauseCircle, PlayCircle, Send, ShieldAlert, Wifi } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { DeliveryTrack } from "@/components/warmup/delivery-track"
import { DailyPlacementChart } from "@/components/warmup/daily-placement-chart"
import { useApi } from "@/hooks/use-api"
import { useWarmupToday } from "@/hooks/use-warmup"
import { api } from "@/lib/api"
import { describeEvent, formatTime, MAILBOX_STATUS_LABELS, WARMUP_STATUS_LABELS } from "@/lib/format"
import type { EventType } from "@/lib/types"

const EVENT_ICONS: Record<EventType, typeof Send> = {
  SCHEDULED: Clock,
  SMTP_CONNECTED: Wifi,
  SMTP_SEND_STARTED: Send,
  SMTP_SENT: Send,
  IMAP_CONNECTED: Wifi,
  MESSAGE_RECEIVED: CheckCircle2,
  REPLY_SENT: CornerUpLeft,
  FAILED: AlertCircle,
}

const MIN_OBSERVATIONS = 3

function StatCard({ label, icon: Icon, children, footer }: { label: string; icon?: typeof Send; children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <Card className="rounded-xl border border-border bg-card p-4 shadow-xs">
      <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
        <span>{label}</span>
        {Icon && <Icon className="h-4 w-4" />}
      </div>
      <div className="mt-2">{children}</div>
      {footer && <div className="mt-1 text-xs text-muted-foreground">{footer}</div>}
    </Card>
  )
}

export default function DashboardPage() {
  const { data: today, loading } = useWarmupToday()
  const { data: history } = useApi(
    () => api.getMessages({ from: new Date(Date.now() - 14 * 86_400_000).toISOString(), limit: 1000 }),
    { pollMs: 60_000 },
  )
  const { data: events } = useApi(() => api.getEvents({ limit: 15 }), { pollMs: 10_000 })

  if (loading && !today) {
    return (
      <div className="flex flex-col gap-6 w-full pb-8">
        <Skeleton className="h-9 w-48" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3"><Skeleton className="h-24 rounded-xl" /><Skeleton className="h-24 rounded-xl" /><Skeleton className="h-24 rounded-xl" /></div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    )
  }

  const overview = today?.overview
  const warmupMailbox = overview?.warmupMailbox
  const targetMailbox = overview?.targetMailbox
  const status = overview?.status ?? "NOT_CONFIGURED"
  const totals = overview?.totals
  const observed = totals ? totals.inbox + totals.spam + totals.timeout : 0
  const inboxRate = totals && observed >= MIN_OBSERVATIONS ? Math.round((totals.inbox / observed) * 100) : null

  return (
    <div className="flex flex-col gap-6 w-full pb-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Monitor your configured mailbox warmup activity.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard label="Warmup Mailbox" icon={Mail} footer={warmupMailbox ? MAILBOX_STATUS_LABELS[warmupMailbox.status] : "Not connected"}>
          <div className="text-base font-semibold truncate">{warmupMailbox?.email ?? "Not configured"}</div>
        </StatCard>
        <StatCard label="Target Mailbox" icon={Inbox} footer={targetMailbox ? MAILBOX_STATUS_LABELS[targetMailbox.status] : "Not connected"}>
          <div className="text-base font-semibold truncate">{targetMailbox?.email ?? "Not configured"}</div>
        </StatCard>
        <StatCard
          label="Current Status"
          icon={status === "RUNNING" ? PlayCircle : PauseCircle}
          footer={overview ? `Today's limit: ${overview.today.limit} messages${overview.config.rampUpEnabled && status === "RUNNING" ? ` (ramp-up day ${overview.today.rampDay})` : ""}` : undefined}
        >
          <div className="flex items-center gap-2">
            <span className="text-xl font-bold tracking-tight">{WARMUP_STATUS_LABELS[status]}</span>
            {status === "ERROR" && <Badge variant="destructive">Check mailboxes</Badge>}
          </div>
        </StatCard>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Messages Today" footer={overview ? `of ${overview.today.limit} planned` : undefined}>
          <div className="text-3xl font-bold tracking-tight tabular-nums">{overview?.today.sent ?? 0}</div>
        </StatCard>
        <StatCard label="Messages Received" footer="All time, verified via IMAP">
          <div className="text-3xl font-bold tracking-tight tabular-nums">{totals?.received ?? 0}</div>
        </StatCard>
        <StatCard label="Failed Messages" footer={totals?.timeout ? `${totals.timeout} not found in target` : "All time"}>
          <div className="text-3xl font-bold tracking-tight tabular-nums">{(totals?.failed ?? 0) + (totals?.timeout ?? 0)}</div>
        </StatCard>
        <StatCard label="Inbox Rate" icon={ShieldAlert} footer={inboxRate === null ? `Needs ${MIN_OBSERVATIONS}+ observed deliveries` : `${totals!.inbox} inbox · ${totals!.spam} spam · ${totals!.timeout} not found`}>
          <div className="text-3xl font-bold tracking-tight tabular-nums">{inboxRate === null ? <span className="text-base font-medium text-muted-foreground">Not enough data yet</span> : `${inboxRate}%`}</div>
        </StatCard>
      </div>

      {overview && <DeliveryTrack overview={overview} messages={today.messages} showJourneys={false} />}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <DailyPlacementChart messages={history ?? []} timezone={overview?.config.timezone ?? "UTC"} />

        <Card className="rounded-xl border border-border bg-card shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="text-lg font-semibold">Warmup Activity</CardTitle>
              <CardDescription className="text-xs text-muted-foreground mt-0.5">Actual mail server operation events</CardDescription>
            </div>
            <Button variant="outline" size="sm" className="text-xs h-8" nativeButton={false} render={<Link href="/activity" />}>
              View Activity <ArrowUpRight className="ml-1 h-3.5 w-3.5" />
            </Button>
          </CardHeader>
          <CardContent>
            {!events || events.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                <p>No warmup activity yet.</p>
                <p className="mt-1 text-xs">Connect your mailboxes to get started.</p>
                {!warmupMailbox || !targetMailbox ? (
                  <Button size="sm" className="mt-4" nativeButton={false} render={<Link href="/mailboxes" />}>Connect Mailbox</Button>
                ) : null}
              </div>
            ) : (
              <ol className="divide-y divide-border/60">
                {events.map((evt) => {
                  const Icon = EVENT_ICONS[evt.type]
                  const { title, detail } = describeEvent(evt)
                  return (
                    <li key={evt.id} className="py-2.5 flex items-center gap-3 text-sm">
                      <span className="w-12 shrink-0 text-xs tabular-nums text-muted-foreground">{formatTime(evt.createdAt)}</span>
                      <div className="rounded-full bg-muted p-1.5 text-foreground"><Icon className="h-3.5 w-3.5" /></div>
                      <div className="min-w-0">
                        <p className={evt.type === "FAILED" ? "text-sm font-semibold" : "text-sm font-medium"}>{title}</p>
                        {detail && <p className="truncate text-xs text-muted-foreground">{detail}</p>}
                      </div>
                    </li>
                  )
                })}
              </ol>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
