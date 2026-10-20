"use client"

import { useState } from "react"
import Link from "next/link"
import { toast } from "sonner"
import { CheckCircle2, ChevronRight, Inbox, Loader2, Mail, MoreHorizontal, Pencil, Plus, RefreshCw, Trash2, XCircle } from "lucide-react"
import { api } from "@/lib/api"
import { formatDateTime, MAILBOX_STATUS_LABELS, mailboxStatusVariant } from "@/lib/format"
import type { ConnectionTestStatus, Mailbox, MailboxType } from "@/lib/types"
import { useApi } from "@/hooks/use-api"
import { MailboxFormDialog } from "@/components/mailboxes/mailbox-form-dialog"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

type Protocol = "SMTP" | "IMAP"

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-1.5 border-b border-border/50 last:border-0 text-xs">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className="font-medium text-right truncate">{children}</span>
    </div>
  )
}

function TestStatus({ status, error }: { status: ConnectionTestStatus; error: string | null }) {
  if (status === "SUCCESS") return <span className="inline-flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5" /> Connection successful</span>
  if (status === "FAILED") return <span className="inline-flex items-center gap-1 text-destructive"><XCircle className="h-3.5 w-3.5" /> {error ?? "Failed"}</span>
  return <span className="text-muted-foreground">Not tested</span>
}

function MailboxCard({
  type,
  mailbox,
  testing,
  onTest,
  onAdd,
  onEdit,
  onRemove,
}: {
  type: MailboxType
  mailbox: Mailbox | undefined
  testing: Protocol | null
  onTest: (protocol: Protocol) => void
  onAdd: () => void
  onEdit: () => void
  onRemove: () => void
}) {
  const isTarget = type === "TARGET"
  const Icon = isTarget ? Inbox : Mail

  if (!mailbox) {
    return (
      <Card className="rounded-xl border border-dashed border-border bg-card shadow-xs">
        <CardContent className="flex h-full flex-col items-center justify-center gap-3 py-12 text-center">
          <div className="rounded-full bg-muted p-3"><Icon className="h-5 w-5" /></div>
          <div>
            <p className="text-sm font-semibold">{isTarget ? "No target mailbox connected" : "No warmup mailbox connected"}</p>
            <p className="mt-1 max-w-xs text-xs text-muted-foreground">
              {isTarget
                ? "Connect the mailbox that receives warmup messages. Delivery is verified through its IMAP inbox."
                : "Connect the mailbox you want to warm up. Messages are sent through its SMTP server."}
            </p>
          </div>
          <Button size="sm" onClick={onAdd}><Plus className="mr-1 h-4 w-4" /> Connect {isTarget ? "Target" : "Warmup"} Mailbox</Button>
        </CardContent>
      </Card>
    )
  }

  const testingAny = testing !== null
  return (
    <Card className="rounded-xl border border-border bg-card shadow-xs">
      <CardHeader>
        <div className="flex items-center justify-between">
          <Badge variant="outline" className="text-xs font-mono">{isTarget ? "Mailbox B — Target" : "Mailbox A — Warmup"}</Badge>
          <div className="flex items-center gap-1">
            <Badge variant={mailboxStatusVariant(mailbox.status)}>{MAILBOX_STATUS_LABELS[mailbox.status]}</Badge>
            <DropdownMenu>
              <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Mailbox actions"><MoreHorizontal className="h-4 w-4" /></Button>} />
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={onEdit}><Pencil /> Edit</DropdownMenuItem>
                <DropdownMenuItem render={<Link href={`/mailboxes/${mailbox.id}`} />}><ChevronRight /> View details</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onClick={onRemove}><Trash2 /> Remove</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        <CardTitle className="text-lg font-semibold mt-2 truncate">{mailbox.email}</CardTitle>
        <CardDescription className="text-xs">
          {isTarget ? "Receives test messages and verifies actual delivery via IMAP." : "Sends controlled deliverability emails via SMTP."}
        </CardDescription>
      </CardHeader>
      <CardContent className="text-sm">
        {isTarget ? (
          <>
            <Row label="IMAP Server">{mailbox.imapHost}:{mailbox.imapPort} ({mailbox.imapSecurity})</Row>
            <Row label="IMAP Password">{mailbox.hasImapPassword ? "Password saved" : "Not set"}</Row>
            <Row label="IMAP Status"><TestStatus status={mailbox.imapTestStatus} error={mailbox.lastImapError} /></Row>
            <Row label="Replies">{mailbox.smtpEnabled ? `Enabled · ${mailbox.smtpHost}:${mailbox.smtpPort}` : "Disabled"}</Row>
            {mailbox.smtpEnabled && <Row label="Reply SMTP Status"><TestStatus status={mailbox.smtpTestStatus} error={mailbox.lastSmtpError} /></Row>}
            <Row label="Last Tested">{formatDateTime(mailbox.lastImapTestAt)}</Row>
          </>
        ) : (
          <>
            <Row label="SMTP Server">{mailbox.smtpHost}:{mailbox.smtpPort} ({mailbox.smtpSecurity})</Row>
            <Row label="SMTP Username">{mailbox.smtpUsername}</Row>
            <Row label="SMTP Password">{mailbox.hasSmtpPassword ? "Password saved" : "Not set"}</Row>
            <Row label="SMTP Status"><TestStatus status={mailbox.smtpTestStatus} error={mailbox.lastSmtpError} /></Row>
            <Row label="Last Tested">{formatDateTime(mailbox.lastSmtpTestAt)}</Row>
          </>
        )}
      </CardContent>
      <CardFooter className="flex gap-2">
        <Button variant="outline" size="sm" className="flex-1 text-xs" disabled={testingAny} onClick={() => onTest(isTarget ? "IMAP" : "SMTP")}>
          {testing === (isTarget ? "IMAP" : "SMTP") ? <><Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> Testing connection...</> : <><RefreshCw className="mr-2 h-3.5 w-3.5" /> Test {isTarget ? "IMAP" : "Connection"}</>}
        </Button>
        {isTarget && mailbox.smtpEnabled && (
          <Button variant="outline" size="sm" className="flex-1 text-xs" disabled={testingAny} onClick={() => onTest("SMTP")}>
            {testing === "SMTP" ? <><Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> Testing connection...</> : <><RefreshCw className="mr-2 h-3.5 w-3.5" /> Test Reply SMTP</>}
          </Button>
        )}
      </CardFooter>
    </Card>
  )
}

export default function MailboxesPage() {
  const { data: mailboxes, loading, refresh, setData } = useApi(() => api.getMailboxes())
  const [testing, setTesting] = useState<{ id: string; protocol: Protocol } | null>(null)
  const [dialog, setDialog] = useState<{ type: MailboxType; mailbox: Mailbox | null } | null>(null)
  const [removing, setRemoving] = useState<Mailbox | null>(null)
  const [removeBusy, setRemoveBusy] = useState(false)

  const warmupMailbox = mailboxes?.find((m) => m.type === "WARMUP")
  const targetMailbox = mailboxes?.find((m) => m.type === "TARGET")
  const upsert = (m: Mailbox) => setData((prev) => [...(prev ?? []).filter((x) => x.id !== m.id), m])

  const runTest = async (mailbox: Mailbox, protocol: Protocol) => {
    setTesting({ id: mailbox.id, protocol })
    const res = protocol === "SMTP" ? await api.testSmtp(mailbox.id) : await api.testImap(mailbox.id)
    setTesting(null)
    if (res.success) {
      upsert(res.data.mailbox)
      toast.success(`${protocol}: Connection successful`)
    } else {
      toast.error(`${protocol}: ${res.error.message}`)
      refresh()
    }
  }

  const confirmRemove = async () => {
    if (!removing) return
    setRemoveBusy(true)
    const res = await api.deleteMailbox(removing.id)
    setRemoveBusy(false)
    if (!res.success) {
      toast.error(res.error.message)
      return
    }
    toast.success("Mailbox removed")
    setData((prev) => (prev ?? []).filter((m) => m.id !== removing.id))
    setRemoving(null)
  }

  const nextType: MailboxType | null = !warmupMailbox ? "WARMUP" : !targetMailbox ? "TARGET" : null

  return (
    <div className="flex flex-col gap-6 w-full pb-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-bold tracking-tight">Mailboxes</h1>
          <p className="text-sm text-muted-foreground">Configure Mailbox A (Warmup SMTP) and Mailbox B (Target IMAP).</p>
        </div>
        {nextType && (
          <Button className="shrink-0" onClick={() => setDialog({ type: nextType, mailbox: null })}>
            <Plus className="mr-2 h-4 w-4" /> Connect {nextType === "WARMUP" ? "Warmup" : "Target"} Mailbox
          </Button>
        )}
      </div>

      {loading && !mailboxes ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Skeleton className="h-72 rounded-xl" />
          <Skeleton className="h-72 rounded-xl" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 items-start gap-6">
          {(["WARMUP", "TARGET"] as const).map((type) => {
            const mailbox = type === "WARMUP" ? warmupMailbox : targetMailbox
            return (
              <MailboxCard
                key={type}
                type={type}
                mailbox={mailbox}
                testing={mailbox && testing?.id === mailbox.id ? testing.protocol : null}
                onTest={(p) => mailbox && runTest(mailbox, p)}
                onAdd={() => setDialog({ type, mailbox: null })}
                onEdit={() => mailbox && setDialog({ type, mailbox })}
                onRemove={() => mailbox && setRemoving(mailbox)}
              />
            )
          })}
        </div>
      )}

      <MailboxFormDialog
        open={dialog !== null}
        onOpenChange={(open) => !open && setDialog(null)}
        type={dialog?.type ?? "WARMUP"}
        mailbox={dialog?.mailbox ?? null}
        onSaved={upsert}
      />

      <AlertDialog open={removing !== null} onOpenChange={(open) => !open && setRemoving(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {removing?.email}?</AlertDialogTitle>
            <AlertDialogDescription>
              Its saved credentials are deleted and warmup is paused. Unsent scheduled messages are cancelled; past activity stays in the log.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removeBusy}>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={confirmRemove} disabled={removeBusy}>
              {removeBusy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Remove Mailbox
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
