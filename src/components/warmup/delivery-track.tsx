"use client"

import { useEffect, useState } from "react"
import { AlertCircle, Check, CheckCircle2, Clock, CornerUpLeft, Inbox, Loader2, Send, ShieldAlert, X } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { formatHour, formatRelative, formatTime, MESSAGE_STATUS_LABELS, messageStatusVariant } from "@/lib/format"
import type { WarmupMessage, WarmupOverview } from "@/lib/types"
import { cn } from "@/lib/utils"

function useNow(intervalMs = 30_000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return now
}

const isFailed = (m: WarmupMessage) => m.status === "FAILED" || m.status === "BOUNCED" || m.status === "TIMEOUT"
const isDelivered = (m: WarmupMessage) => m.status === "RECEIVED" || m.status === "REPLY_SENT"

/**
 * The theme is monochrome, so state is encoded by shape + icon rather than color:
 * dashed ring = scheduled, ring = sent, filled check = inbox, gray shield = spam, crossed = failed.
 */
function MarkerGlyph({ message }: { message: WarmupMessage }) {
  const base = cn("flex h-4 w-4 items-center justify-center border-2", message.type === "TEST" ? "rounded-[4px]" : "rounded-full")
  if (isFailed(message)) return <span className={cn(base, "border-foreground bg-background text-foreground")}><X className="h-2.5 w-2.5" strokeWidth={3} /></span>
  if (message.placement === "SPAM") return <span className={cn(base, "border-muted-foreground bg-muted-foreground text-background")}><ShieldAlert className="h-2.5 w-2.5" strokeWidth={3} /></span>
  if (isDelivered(message)) return <span className={cn(base, "border-foreground bg-foreground text-background")}><Check className="h-2.5 w-2.5" strokeWidth={3} /></span>
  if (message.status === "SENT") return <span className={cn(base, "border-foreground bg-background")} />
  if (message.status === "SENDING") return <span className={cn(base, "animate-pulse border-muted-foreground bg-muted-foreground")} />
  return <span className={cn(base, "border-dashed border-muted-foreground bg-background")} />
}

/** Marker on the day timeline. */
function TrackMarker({ message, left, tz }: { message: WarmupMessage; left: number; tz: string }) {
  const spam = message.placement === "SPAM"
  return (
    <Tooltip>
      <TooltipTrigger
        aria-label={`${message.testId}: ${MESSAGE_STATUS_LABELS[message.status]}`}
        className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        style={{ left: `${left}%` }}
      >
        <MarkerGlyph message={message} />
      </TooltipTrigger>
      <TooltipContent className="text-xs">
        <p className="font-medium">
          {message.type === "TEST" ? "Test send" : "Warmup message"} · {MESSAGE_STATUS_LABELS[message.status]}
          {spam ? " (Spam folder)" : message.placement === "INBOX" ? " (Inbox)" : ""}
        </p>
        <p className="font-mono opacity-80">{message.testId}</p>
        <p className="opacity-80">
          {message.sentAt ? `Sent ${formatTime(message.sentAt, tz)}` : `Scheduled ${formatTime(message.scheduledAt, tz)}`}
          {message.receivedAt ? ` · Received ${formatTime(message.receivedAt, tz)}` : ""}
        </p>
      </TooltipContent>
    </Tooltip>
  )
}

type StepState = "done" | "current" | "pending" | "failed"

function Step({ icon: Icon, label, time, state, tz }: { icon: typeof Send; label: string; time?: string | null; state: StepState; tz: string }) {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-2">
      <div
        className={cn(
          "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border",
          state === "done" && "border-foreground bg-foreground text-background",
          state === "current" && "border-foreground text-foreground",
          state === "pending" && "border-dashed border-border text-muted-foreground",
          state === "failed" && "border-foreground bg-muted text-foreground",
        )}
      >
        {state === "current" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Icon className="h-3.5 w-3.5" />}
      </div>
      <div className="min-w-0">
        <p className={cn("truncate text-xs font-medium", state === "pending" && "text-muted-foreground", state === "failed" && "font-semibold")}>{label}</p>
        <p className="text-[11px] text-muted-foreground">{time ? formatTime(time, tz) : "—"}</p>
      </div>
    </div>
  )
}

/** One message's journey: Scheduled → Sent → Received (Inbox/Spam) → Reply. */
function MessageJourney({ message, repliesEnabled, tz }: { message: WarmupMessage; repliesEnabled: boolean; tz: string }) {
  const s = message.status
  const sendFailed = s === "FAILED" || s === "BOUNCED"
  const sent = Boolean(message.sentAt)
  const delivered = isDelivered(message)

  const sentState: StepState = sent ? "done" : sendFailed ? "failed" : s === "SENDING" ? "current" : "pending"
  const receivedState: StepState = delivered ? (message.placement === "SPAM" ? "failed" : "done") : s === "TIMEOUT" ? "failed" : s === "SENT" ? "current" : "pending"
  const replyState: StepState = s === "REPLY_SENT" ? "done" : message.replyError ? "failed" : s === "RECEIVED" && repliesEnabled ? "current" : "pending"

  const receivedLabel = delivered ? (message.placement === "SPAM" ? "Landed in Spam" : "In Inbox") : s === "TIMEOUT" ? "Not found" : s === "SENT" ? "Checking inbox" : "Received"

  return (
    <div className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:gap-4">
      <div className="flex w-full shrink-0 items-center gap-2 sm:w-44">
        <Badge variant={messageStatusVariant(s)} className="font-mono">{MESSAGE_STATUS_LABELS[s]}</Badge>
        <span className="truncate font-mono text-[11px] text-muted-foreground">{message.testId}</span>
        {message.type === "TEST" && <Badge variant="outline">Test</Badge>}
      </div>
      <div className="flex flex-1 items-center gap-2">
        <Step icon={Clock} label="Scheduled" time={message.scheduledAt} state="done" tz={tz} />
        <div className="hidden h-px w-4 bg-border sm:block" />
        <Step icon={sendFailed ? AlertCircle : Send} label={sendFailed ? "Send failed" : "Sent"} time={message.sentAt} state={sentState} tz={tz} />
        <div className="hidden h-px w-4 bg-border sm:block" />
        <Step icon={message.placement === "SPAM" ? ShieldAlert : s === "TIMEOUT" ? AlertCircle : Inbox} label={receivedLabel} time={message.receivedAt} state={receivedState} tz={tz} />
        {repliesEnabled && (
          <>
            <div className="hidden h-px w-4 bg-border sm:block" />
            <Step icon={CornerUpLeft} label={message.replyError ? "Reply failed" : "Replied"} time={message.repliedAt} state={replyState} tz={tz} />
          </>
        )}
      </div>
      {message.errorMessage && (sendFailed || s === "TIMEOUT") && (
        <p className="flex items-center gap-1 text-xs font-medium sm:w-48 sm:justify-end"><AlertCircle className="h-3.5 w-3.5 shrink-0" />{message.errorMessage}</p>
      )}
    </div>
  )
}

const sample = (patch: Partial<WarmupMessage>) => ({ type: "WARMUP", status: "SCHEDULED", placement: null, ...patch }) as WarmupMessage
const LEGEND = [
  { label: "Scheduled", sample: sample({}) },
  { label: "Sent, checking inbox", sample: sample({ status: "SENT" }) },
  { label: "In Inbox", sample: sample({ status: "RECEIVED", placement: "INBOX" }) },
  { label: "In Spam", sample: sample({ status: "RECEIVED", placement: "SPAM" }) },
  { label: "Failed / not found", sample: sample({ status: "FAILED" }) },
  { label: "Test send", sample: sample({ type: "TEST", status: "SENT" }) },
]

export function DeliveryTrack({
  overview,
  messages,
  showJourneys = true,
}: {
  overview: WarmupOverview
  messages: WarmupMessage[]
  showJourneys?: boolean
}) {
  const now = useNow()
  const { today, config, status } = overview
  // All times on the track are shown in the schedule's timezone, matching the active window.
  const tz = config.timezone
  const hourLabel = (t: number) => new Intl.DateTimeFormat([], { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: tz }).format(t)
  const start = new Date(today.windowStart).getTime()
  const end = new Date(today.windowEnd).getTime()
  const span = Math.max(1, end - start)
  const position = (t: number) => Math.min(100, Math.max(0, ((t - start) / span) * 100))
  const nowPct = position(now)
  const nowInWindow = now >= start && now <= end

  const sorted = [...messages].sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())
  const progress = today.limit ? Math.min(100, Math.round((today.sent / today.limit) * 100)) : 0

  // Hour ticks across the active window (at most ~7 labels).
  const hours = (end - start) / 3_600_000
  const step = Math.max(1, Math.ceil(hours / 6))
  const ticks: number[] = []
  for (let h = 0; h <= hours; h += step) ticks.push(start + h * 3_600_000)

  let nextLabel: string
  if (status !== "RUNNING") nextLabel = status === "NOT_CONFIGURED" ? "Connect both mailboxes to start" : "Warmup is paused"
  else if (today.nextScheduledAt) nextLabel = `Next send ${formatRelative(today.nextScheduledAt, now)} · ${formatTime(today.nextScheduledAt, tz)}`
  else if (today.sent >= today.limit) nextLabel = "Today's volume is complete. Next sends are planned tomorrow"
  else if (now > end) nextLabel = "Active window has ended. Next sends are planned tomorrow"
  else nextLabel = "Planning next send…"

  return (
    <Card className="rounded-xl border border-border bg-card shadow-xs">
      <CardHeader className="flex flex-col gap-3 pb-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardTitle className="text-lg font-semibold">Today&apos;s Delivery Track</CardTitle>
          <CardDescription className="mt-0.5 text-xs">
            {config.rampUpEnabled ? `Ramp-up day ${today.rampDay} · ` : ""}
            Active {formatHour(config.activeStartHour)}–{config.activeEndHour === 24 ? "24:00" : formatHour(config.activeEndHour)} · times shown in {tz}
          </CardDescription>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Clock className="h-3.5 w-3.5" />
          <span>{nextLabel}</span>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-2">
          <div className="flex items-baseline justify-between text-xs">
            <span className="text-muted-foreground">Sent today</span>
            <span className="font-medium tabular-nums">
              {today.sent} / {today.limit}
              <span className="ml-2 text-muted-foreground">
                {today.received} received{today.failed ? ` · ${today.failed} failed` : ""}
              </span>
            </span>
          </div>
          <Progress value={progress} aria-label="Messages sent today" />
        </div>

        <div className="pt-1">
          <div className="relative h-10" role="group" aria-label="Today's messages on the timeline">
            <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-muted" />
            {nowInWindow && (
              <div className="absolute inset-y-0 left-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-foreground/15" style={{ width: `${nowPct}%` }} />
            )}
            {nowInWindow && (
              <div className="absolute inset-y-1 w-px bg-foreground/60" style={{ left: `${nowPct}%` }} aria-hidden>
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-[10px] font-medium text-muted-foreground">Now</span>
              </div>
            )}
            {sorted.map((m) => (
              <TrackMarker key={m.id} message={m} tz={tz} left={position(new Date(m.sentAt ?? m.scheduledAt).getTime())} />
            ))}
          </div>
          <div className="relative mt-1 h-4 text-[10px] text-muted-foreground">
            {ticks.map((t, i) => (
              <span
                key={t}
                className={cn("absolute tabular-nums", i === 0 ? "translate-x-0" : i === ticks.length - 1 && position(t) > 95 ? "-translate-x-full" : "-translate-x-1/2")}
                style={{ left: `${position(t)}%` }}
              >
                {hourLabel(t)}
              </span>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-[11px] text-muted-foreground" aria-label="Legend">
          {LEGEND.map((item) => (
            <span key={item.label} className="flex items-center gap-1.5">
              <MarkerGlyph message={item.sample} />
              {item.label}
            </span>
          ))}
        </div>

        {showJourneys && (
          <div className="border-t border-border/60 pt-1">
            {sorted.length === 0 ? (
              <div className="flex flex-col items-center gap-1 py-6 text-center">
                <CheckCircle2 className="h-5 w-5 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">No messages today yet.</p>
                <p className="text-xs text-muted-foreground">
                  {status === "RUNNING" ? "Sends are planned within the active window." : "Start warmup to schedule today's messages."}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border/60">
                {[...sorted].reverse().map((m) => (
                  <MessageJourney key={m.id} message={m} repliesEnabled={config.repliesEnabled} tz={tz} />
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
