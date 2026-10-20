"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Controller, useForm, type UseFormReturn } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { AlertCircle, Flame, Loader2, PauseCircle, PlayCircle, Send, TrendingUp } from "lucide-react"
import { api } from "@/lib/api"
import { formatHour, WARMUP_STATUS_LABELS } from "@/lib/format"
import type { WarmupOverview } from "@/lib/types"
import { useWarmupToday } from "@/hooks/use-warmup"
import { DeliveryTrack } from "@/components/warmup/delivery-track"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Skeleton } from "@/components/ui/skeleton"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Field, FieldContent, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field"

const num = (label: string, min: number, max: number) =>
  z.number({ message: `${label} is required` }).int(`${label} must be a whole number`).min(min, `${label} must be at least ${min}`).max(max, `${label} must be at most ${max}`)

const schema = z
  .object({
    dailyLimit: num("Daily messages", 1, 50),
    minDelayMinutes: num("Minimum delay", 5, 720),
    maxDelayMinutes: num("Maximum delay", 5, 720),
    activeStartHour: num("Start time", 0, 23),
    activeEndHour: num("End time", 1, 24),
    timezone: z.string().min(1, "Timezone is required"),
    repliesEnabled: z.boolean(),
    rampUpEnabled: z.boolean(),
    rampStartVolume: num("Starting volume", 1, 50),
    rampIncrement: num("Daily increase", 1, 5),
  })
  .refine((v) => v.minDelayMinutes <= v.maxDelayMinutes, { path: ["maxDelayMinutes"], message: "Maximum delay must be at least the minimum delay" })
  .refine((v) => v.activeStartHour < v.activeEndHour, { path: ["activeEndHour"], message: "End time must be after the start time" })

type FormValues = z.infer<typeof schema>

function toFormValues(o: WarmupOverview): FormValues {
  const c = o.config
  return {
    dailyLimit: c.dailyLimit,
    minDelayMinutes: c.minDelayMinutes,
    maxDelayMinutes: c.maxDelayMinutes,
    activeStartHour: c.activeStartHour,
    activeEndHour: c.activeEndHour,
    timezone: c.timezone,
    repliesEnabled: c.repliesEnabled,
    rampUpEnabled: c.rampUpEnabled,
    rampStartVolume: c.rampStartVolume,
    rampIncrement: c.rampIncrement,
  }
}

const START_HOURS = Array.from({ length: 24 }, (_, h) => ({ value: String(h), label: formatHour(h) }))
const END_HOURS = Array.from({ length: 24 }, (_, i) => ({ value: String(i + 1), label: i + 1 === 24 ? "24:00" : formatHour(i + 1) }))

function NumberField({ form, name, label, description }: { form: UseFormReturn<FormValues>; name: keyof FormValues; label: string; description?: string }) {
  return (
    <Controller
      name={name}
      control={form.control}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid}>
          <FieldLabel htmlFor={name}>{label}</FieldLabel>
          <Input
            id={name}
            type="number"
            inputMode="numeric"
            value={Number.isNaN(field.value) ? "" : String(field.value)}
            onChange={(e) => field.onChange(e.target.value === "" ? NaN : Number(e.target.value))}
            onBlur={field.onBlur}
            aria-invalid={fieldState.invalid}
          />
          {fieldState.invalid ? <FieldError errors={[fieldState.error]} /> : description && <FieldDescription className="text-xs">{description}</FieldDescription>}
        </Field>
      )}
    />
  )
}

export default function WarmupPage() {
  const { data, loading, error, refresh, setData } = useWarmupToday()
  const overview = data?.overview
  const [acting, setActing] = useState<"start" | "pause" | "test" | null>(null)

  const timezones = useMemo(() => {
    const list = typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : ["UTC"]
    return (list.includes("UTC") ? list : ["UTC", ...list]).map((tz) => ({ value: tz, label: tz }))
  }, [])

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { dailyLimit: 5, minDelayMinutes: 45, maxDelayMinutes: 180, activeStartHour: 9, activeEndHour: 17, timezone: "UTC", repliesEnabled: false, rampUpEnabled: true, rampStartVolume: 2, rampIncrement: 1 },
  })

  // Load saved values once, then keep the user's unsaved edits while polling refreshes the rest of the page.
  const loadedConfigId = overview?.config.id
  useEffect(() => {
    if (overview && !form.formState.isDirty) form.reset(toFormValues(overview))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadedConfigId, overview?.config.updatedAt])

  const applyOverview = (next: WarmupOverview) => {
    setData((prev) => (prev ? { ...prev, overview: next } : prev))
    refresh()
  }

  const onSave = async (values: FormValues) => {
    const res = await api.updateWarmupConfig(values)
    if (!res.success) {
      toast.error(res.error.message)
      return
    }
    form.reset(toFormValues(res.data))
    applyOverview(res.data)
    toast.success(res.data.config.enabled ? "Schedule saved. Today's remaining sends were re-planned" : "Schedule saved")
  }

  const toggleRunning = async () => {
    if (!overview) return
    const starting = !overview.config.enabled
    setActing(starting ? "start" : "pause")
    const res = starting ? await api.startWarmup() : await api.pauseWarmup()
    setActing(null)
    if (!res.success) {
      toast.error(res.error.message)
      return
    }
    applyOverview(res.data)
    if (starting) {
      const t = res.data.today
      toast.success(t.nextScheduledAt ? `Warmup started. ${t.scheduled} message${t.scheduled === 1 ? "" : "s"} scheduled today` : "Warmup started. Sends will be planned in the next active window")
    } else {
      toast.success("Warmup paused. Unsent messages were cancelled")
    }
  }

  const testSend = async () => {
    setActing("test")
    const res = await api.testSend()
    setActing(null)
    if (!res.success) {
      toast.error(res.error.message)
    } else {
      toast.success(`Test email ${res.data.testId} accepted by the SMTP server. Checking the target inbox…`)
    }
    refresh()
  }

  if (loading && !data) {
    return (
      <div className="flex flex-col gap-6 w-full pb-8">
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    )
  }

  if (!overview) {
    return (
      <Card className="rounded-xl p-6 text-sm text-muted-foreground">
        <span className="flex items-center gap-2"><AlertCircle className="h-4 w-4" /> {error?.message ?? "Could not load warmup configuration."}</span>
      </Card>
    )
  }

  const { readiness, status, warmupMailbox, targetMailbox } = overview
  const running = overview.config.enabled
  const targetHasSmtp = Boolean(targetMailbox?.smtpEnabled)
  const rampUpEnabled = form.watch("rampUpEnabled")
  const notReadyReason = !warmupMailbox || !targetMailbox
    ? "Connect both mailboxes first."
    : !readiness.warmupConnected
      ? "Test the warmup mailbox connection successfully first."
      : !readiness.targetConnected
        ? "Test the target mailbox connection successfully first."
        : null

  return (
    <div className="flex flex-col gap-6 w-full pb-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-bold tracking-tight">Warmup</h1>
          <p className="text-sm text-muted-foreground">Configure schedule limits and controlled email warming parameters.</p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant={running ? "outline" : "default"} onClick={toggleRunning} disabled={acting !== null || (!running && !readiness.canStart)} className="shrink-0">
            {acting === "start" || acting === "pause" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : running ? <PauseCircle className="mr-2 h-4 w-4" /> : <PlayCircle className="mr-2 h-4 w-4" />}
            {running ? "Pause Warmup" : "Start Warmup"}
          </Button>
          <Button variant="secondary" onClick={testSend} disabled={acting !== null || !warmupMailbox || !targetMailbox}>
            {acting === "test" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
            {acting === "test" ? "Sending…" : "Test Send (A → B)"}
          </Button>
        </div>
      </div>

      {notReadyReason && !running && (
        <Card className="flex flex-row items-center justify-between gap-3 rounded-xl border border-border bg-muted/40 p-4 text-xs">
          <span className="flex items-center gap-2"><AlertCircle className="h-4 w-4 shrink-0" /> {notReadyReason}</span>
          <Button variant="outline" size="sm" nativeButton={false} render={<Link href="/mailboxes" />}>Go to Mailboxes</Button>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="rounded-xl border border-border bg-card p-4">
          <div className="text-xs text-muted-foreground font-medium">Warmup Mailbox (Sender A)</div>
          <div className="mt-1 text-sm font-semibold truncate">{warmupMailbox?.email ?? "Not configured"}</div>
        </Card>
        <Card className="rounded-xl border border-border bg-card p-4">
          <div className="text-xs text-muted-foreground font-medium">Target Mailbox (Recipient B)</div>
          <div className="mt-1 text-sm font-semibold truncate">{targetMailbox?.email ?? "Not configured"}</div>
        </Card>
        <Card className="rounded-xl border border-border bg-card p-4">
          <div className="text-xs text-muted-foreground font-medium">Status</div>
          <div className="mt-1 flex items-center gap-2">
            <Badge variant={status === "RUNNING" ? "default" : status === "ERROR" ? "destructive" : "secondary"}>{WARMUP_STATUS_LABELS[status]}</Badge>
            {running && overview.config.rampUpEnabled && (
              <span className="text-xs text-muted-foreground">Day {overview.today.rampDay} · {overview.today.limit}/day</span>
            )}
          </div>
        </Card>
      </div>

      <DeliveryTrack overview={overview} messages={data.messages} />

      <form onSubmit={form.handleSubmit(onSave)} noValidate>
        <Card className="rounded-xl border border-border bg-card shadow-xs">
          <CardHeader>
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <Flame className="h-5 w-5" /> Schedule Configuration
            </CardTitle>
            <CardDescription className="text-xs">Limits are enforced by the server. Each send is spaced randomly between the minimum and maximum delay.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <NumberField form={form} name="dailyLimit" label="Daily messages" description="Maximum per day. Default: 5" />
              <NumberField form={form} name="minDelayMinutes" label="Minimum delay (minutes)" description="Default: 45 min" />
              <NumberField form={form} name="maxDelayMinutes" label="Maximum delay (minutes)" description="Default: 180 min" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-border/50">
              <Controller
                name="activeStartHour"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="activeStartHour">Active start time</FieldLabel>
                    <Select items={START_HOURS} value={String(field.value)} onValueChange={(v) => v !== null && field.onChange(Number(v))}>
                      <SelectTrigger id="activeStartHour" className="w-full" aria-invalid={fieldState.invalid}><SelectValue /></SelectTrigger>
                      <SelectContent>{START_HOURS.map((h) => <SelectItem key={h.value} value={h.value}>{h.label}</SelectItem>)}</SelectContent>
                    </Select>
                    {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                  </Field>
                )}
              />
              <Controller
                name="activeEndHour"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="activeEndHour">Active end time</FieldLabel>
                    <Select items={END_HOURS} value={String(field.value)} onValueChange={(v) => v !== null && field.onChange(Number(v))}>
                      <SelectTrigger id="activeEndHour" className="w-full" aria-invalid={fieldState.invalid}><SelectValue /></SelectTrigger>
                      <SelectContent>{END_HOURS.map((h) => <SelectItem key={h.value} value={h.value}>{h.label}</SelectItem>)}</SelectContent>
                    </Select>
                    {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                  </Field>
                )}
              />
              <Controller
                name="timezone"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="timezone">Timezone</FieldLabel>
                    <Select items={timezones} value={field.value} onValueChange={(v) => v && field.onChange(v)}>
                      <SelectTrigger id="timezone" className="w-full" aria-invalid={fieldState.invalid}><SelectValue /></SelectTrigger>
                      <SelectContent className="max-h-72">
                        {timezones.map((tz) => <SelectItem key={tz.value} value={tz.value}>{tz.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    {fieldState.invalid ? <FieldError errors={[fieldState.error]} /> : (
                      <FieldDescription className="text-xs">
                        <button type="button" className="underline underline-offset-2" onClick={() => form.setValue("timezone", Intl.DateTimeFormat().resolvedOptions().timeZone, { shouldDirty: true })}>
                          Use my timezone
                        </button>
                      </FieldDescription>
                    )}
                  </Field>
                )}
              />
            </div>

            <div className="space-y-4 pt-4 border-t border-border/50">
              <Controller
                name="rampUpEnabled"
                control={form.control}
                render={({ field }) => (
                  <Field orientation="horizontal" className="justify-between">
                    <FieldContent>
                      <FieldLabel htmlFor="rampUpEnabled" className="flex items-center gap-2"><TrendingUp className="h-4 w-4" /> Gradual ramp-up</FieldLabel>
                      <FieldDescription className="text-xs">Start with a low volume and increase it each day until the daily limit is reached.</FieldDescription>
                    </FieldContent>
                    <Switch id="rampUpEnabled" checked={field.value} onCheckedChange={field.onChange} />
                  </Field>
                )}
              />
              {rampUpEnabled && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <NumberField form={form} name="rampStartVolume" label="Starting volume (day 1)" description="Messages on the first day" />
                  <NumberField form={form} name="rampIncrement" label="Daily increase" description="Added each day, up to the daily limit" />
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-border/50">
              <Controller
                name="repliesEnabled"
                control={form.control}
                render={({ field }) => (
                  <Field orientation="horizontal" className="justify-between" data-disabled={!targetHasSmtp}>
                    <FieldContent>
                      <FieldLabel htmlFor="repliesEnabled">Replies enabled</FieldLabel>
                      <FieldDescription className="text-xs">
                        {targetHasSmtp
                          ? "After a message is found in the target mailbox, the target sends a real reply back to the warmup mailbox."
                          : "Requires SMTP settings on the target mailbox (Mailboxes → Edit → Enable Replies)."}
                      </FieldDescription>
                    </FieldContent>
                    <Switch id="repliesEnabled" checked={field.value} onCheckedChange={field.onChange} disabled={!targetHasSmtp && !field.value} />
                  </Field>
                )}
              />
            </div>
          </CardContent>
          <CardFooter className="border-t border-border/50 flex justify-end gap-2">
            {form.formState.isDirty && (
              <Button type="button" variant="ghost" onClick={() => form.reset(toFormValues(overview))}>Discard changes</Button>
            )}
            <Button type="submit" disabled={form.formState.isSubmitting || !form.formState.isDirty}>
              {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Configuration
            </Button>
          </CardFooter>
        </Card>
      </form>
    </div>
  )
}
