"use client"

import { useState } from "react"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import type { WarmupMessage } from "@/lib/types"

// Monochrome theme: series are separated by lightness, and failures by an outlined (unfilled) segment.
const chartConfig = {
  inbox: { label: "Inbox", color: "var(--foreground)" },
  spam: { label: "Spam", color: "var(--muted-foreground)" },
  failed: { label: "Failed / not found", color: "var(--background)" },
} satisfies ChartConfig

function dayKey(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(date)
}

export function DailyPlacementChart({ messages, timezone, days = 14 }: { messages: WarmupMessage[]; timezone: string; days?: number }) {
  const [now] = useState(() => Date.now())
  const buckets = new Map<string, { label: string; inbox: number; spam: number; failed: number }>()
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now - i * 86_400_000)
    buckets.set(dayKey(d, timezone), {
      label: d.toLocaleDateString([], { month: "short", day: "numeric", timeZone: timezone }),
      inbox: 0,
      spam: 0,
      failed: 0,
    })
  }
  for (const m of messages) {
    const b = buckets.get(dayKey(new Date(m.sentAt ?? m.scheduledAt), timezone))
    if (!b) continue
    if (m.placement === "SPAM") b.spam++
    else if (m.status === "RECEIVED" || m.status === "REPLY_SENT") b.inbox++
    else if (m.status === "FAILED" || m.status === "BOUNCED" || m.status === "TIMEOUT") b.failed++
  }
  const data = [...buckets.values()]
  const hasData = data.some((d) => d.inbox + d.spam + d.failed > 0)

  return (
    <Card className="rounded-xl border border-border bg-card shadow-xs">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-semibold">Delivery Results</CardTitle>
        <CardDescription className="text-xs">Where messages were actually found in the target mailbox, last {days} days</CardDescription>
      </CardHeader>
      <CardContent>
        {!hasData ? (
          <div className="py-10 text-center text-sm text-muted-foreground">Not enough data yet.</div>
        ) : (
          <ChartContainer config={chartConfig} className="h-56 w-full">
            <BarChart data={data} margin={{ left: -20, right: 4, top: 8 }} accessibilityLayer>
              <CartesianGrid vertical={false} strokeOpacity={0.5} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} minTickGap={16} fontSize={11} />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={36} fontSize={11} />
              <ChartTooltip cursor={{ fillOpacity: 0.06 }} content={<ChartTooltipContent />} />
              <Bar dataKey="inbox" stackId="a" fill="var(--color-inbox)" stroke="var(--card)" strokeWidth={2} maxBarSize={28} />
              <Bar dataKey="spam" stackId="a" fill="var(--color-spam)" stroke="var(--card)" strokeWidth={2} maxBarSize={28} />
              <Bar dataKey="failed" stackId="a" fill="var(--card)" stroke="var(--foreground)" strokeWidth={1.5} radius={[4, 4, 0, 0]} maxBarSize={28} />
            </BarChart>
          </ChartContainer>
        )}
        {hasData && (
          <div className="mt-2 flex items-center justify-center gap-4 text-xs text-muted-foreground" aria-label="Legend">
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-[2px] bg-foreground" />Inbox</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-[2px] bg-muted-foreground" />Spam</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-[2px] border border-foreground" />Failed / not found</span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
