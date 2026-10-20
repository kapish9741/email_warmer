"use client"

import { useParams } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Mail, Server } from "lucide-react"
import { api } from "@/lib/api"
import { formatDateTime, MAILBOX_STATUS_LABELS, mailboxStatusVariant } from "@/lib/format"
import { useApi } from "@/hooks/use-api"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"

function Detail({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex justify-between gap-4 py-2 border-b border-border/50 last:border-0 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono font-medium text-right truncate">{value || "Not configured"}</span>
    </div>
  )
}

export default function MailboxDetailsPage() {
  const params = useParams<{ id: string }>()
  const { data: mailbox, loading, error } = useApi(() => api.getMailbox(params.id), { deps: [params.id] })

  if (loading && !mailbox) return <Skeleton className="h-64 w-full rounded-xl" />

  if (!mailbox) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <p className="text-sm font-semibold">Mailbox not found</p>
        <p className="text-xs text-muted-foreground">{error?.message ?? "It may have been removed."}</p>
        <Button variant="outline" size="sm" nativeButton={false} render={<Link href="/mailboxes" />}>Back to Mailboxes</Button>
      </div>
    )
  }

  const smtpConfigured = mailbox.type === "WARMUP" || mailbox.smtpEnabled

  return (
    <div className="flex flex-col gap-6 w-full pb-8">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" className="rounded-full" nativeButton={false} render={<Link href="/mailboxes" aria-label="Back to mailboxes" />}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex flex-col min-w-0">
          <h1 className="text-2xl font-semibold leading-none truncate">{mailbox.email}</h1>
          <p className="text-xs text-muted-foreground mt-1">{mailbox.type === "WARMUP" ? "Mailbox A — Warmup" : "Mailbox B — Target"}</p>
        </div>
        <div className="ml-auto">
          <Badge variant={mailboxStatusVariant(mailbox.status)}>{MAILBOX_STATUS_LABELS[mailbox.status]}</Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="rounded-xl border border-border bg-card shadow-xs">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg font-semibold">
              <Mail className="h-4 w-4" /> Outgoing SMTP {mailbox.type === "TARGET" && "(Replies)"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {smtpConfigured ? (
              <>
                <Detail label="Host" value={mailbox.smtpHost} />
                <Detail label="Port / Security" value={mailbox.smtpPort ? `${mailbox.smtpPort} (${mailbox.smtpSecurity})` : null} />
                <Detail label="Username" value={mailbox.smtpUsername} />
                <Detail label="Password" value={mailbox.hasSmtpPassword ? "••••••••" : null} />
                <Detail label="Last test" value={mailbox.lastSmtpTestAt ? `${formatDateTime(mailbox.lastSmtpTestAt)} · ${mailbox.smtpTestStatus}` : "Never"} />
                {mailbox.lastSmtpError && <p className="mt-2 text-xs text-destructive">{mailbox.lastSmtpError}</p>}
              </>
            ) : (
              <p className="text-xs text-muted-foreground">Replies are disabled, so no SMTP server is configured.</p>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-xl border border-border bg-card shadow-xs">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg font-semibold">
              <Server className="h-4 w-4" /> Incoming IMAP
            </CardTitle>
          </CardHeader>
          <CardContent>
            {mailbox.type === "TARGET" ? (
              <>
                <Detail label="Host" value={mailbox.imapHost} />
                <Detail label="Port / Security" value={mailbox.imapPort ? `${mailbox.imapPort} (${mailbox.imapSecurity})` : null} />
                <Detail label="Username" value={mailbox.imapUsername} />
                <Detail label="Password" value={mailbox.hasImapPassword ? "••••••••" : null} />
                <Detail label="Last test" value={mailbox.lastImapTestAt ? `${formatDateTime(mailbox.lastImapTestAt)} · ${mailbox.imapTestStatus}` : "Never"} />
                {mailbox.lastImapError && <p className="mt-2 text-xs text-destructive">{mailbox.lastImapError}</p>}
              </>
            ) : (
              <p className="text-xs text-muted-foreground">The warmup mailbox only sends; IMAP is used on the target mailbox.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
