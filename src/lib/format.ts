import type { EventType, MailboxStatus, MessageStatus, WarmupEvent, WarmupStatus } from "@/lib/types"

type BadgeVariant = "default" | "secondary" | "outline" | "destructive"

export const MESSAGE_STATUS_LABELS: Record<MessageStatus, string> = {
  SCHEDULED: "Scheduled",
  SENDING: "Sending",
  SENT: "Sent",
  RECEIVED: "Received",
  BOUNCED: "Bounced",
  FAILED: "Failed",
  TIMEOUT: "Timeout",
  REPLY_SENT: "Reply Sent",
}

export function messageStatusVariant(status: MessageStatus): BadgeVariant {
  if (status === "RECEIVED" || status === "REPLY_SENT") return "default"
  if (status === "FAILED" || status === "BOUNCED" || status === "TIMEOUT") return "destructive"
  if (status === "SENT") return "outline"
  return "secondary"
}

export const MAILBOX_STATUS_LABELS: Record<MailboxStatus, string> = {
  PENDING: "Not tested",
  CONNECTED: "Connected",
  ERROR: "Error",
  DISABLED: "Disabled",
}

export function mailboxStatusVariant(status: MailboxStatus | undefined): BadgeVariant {
  if (status === "CONNECTED") return "default"
  if (status === "ERROR") return "destructive"
  return "secondary"
}

export const WARMUP_STATUS_LABELS: Record<WarmupStatus, string> = {
  NOT_CONFIGURED: "Not configured",
  RUNNING: "Running",
  PAUSED: "Paused",
  ERROR: "Error",
}

export function formatTime(value: string | Date, timeZone?: string) {
  return new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", timeZone })
}

export function formatDateTime(value: string | Date | null | undefined) {
  if (!value) return "Never"
  return new Date(value).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })
}

/** "in 12 min", "3 h ago" — relative to now. */
export function formatRelative(value: string | Date, now = Date.now()) {
  const diffMin = Math.round((new Date(value).getTime() - now) / 60_000)
  const abs = Math.abs(diffMin)
  const text = abs < 1 ? "less than a minute" : abs < 60 ? `${abs} min` : `${Math.round(abs / 60)} h`
  if (abs < 1) return diffMin >= 0 ? "in less than a minute" : "just now"
  return diffMin >= 0 ? `in ${text}` : `${text} ago`
}

export function formatHour(hour: number) {
  return `${String(hour % 24).padStart(2, "0")}:00`
}

const EVENT_LABELS: Record<EventType, string> = {
  SCHEDULED: "Warmup message scheduled",
  SMTP_CONNECTED: "SMTP connection verified",
  SMTP_SEND_STARTED: "Sending via SMTP",
  SMTP_SENT: "Email sent from Warmup Mailbox",
  IMAP_CONNECTED: "IMAP connection verified",
  MESSAGE_RECEIVED: "Email received in Target Mailbox",
  REPLY_SENT: "Reply sent from Target Mailbox",
  FAILED: "Operation failed",
}

export function describeEvent(evt: WarmupEvent): { title: string; detail?: string } {
  const meta = (evt.metadata ?? {}) as Record<string, unknown>
  const testId = evt.warmupMessage?.testId
  switch (evt.type) {
    case "SCHEDULED":
      return {
        title: meta.manual ? "Test message queued" : EVENT_LABELS.SCHEDULED,
        detail: meta.scheduledAt ? `Planned for ${formatTime(String(meta.scheduledAt))} · ${testId}` : testId,
      }
    case "MESSAGE_RECEIVED":
      return {
        title: meta.placement === "SPAM" ? "Email received in Spam folder" : "Email received in Inbox",
        detail: [testId, meta.folder ? `Folder: ${meta.folder}` : null, typeof meta.latencySeconds === "number" ? `after ${formatLatency(meta.latencySeconds)}` : null]
          .filter(Boolean)
          .join(" · "),
      }
    case "SMTP_CONNECTED":
    case "IMAP_CONNECTED":
      return { title: EVENT_LABELS[evt.type], detail: meta.mailbox ? String(meta.mailbox) : undefined }
    case "FAILED": {
      const stage = String(meta.stage ?? "")
      const stageLabel =
        stage === "SEND" ? "Send failed" :
        stage === "RECEIVE" ? "Not found in target mailbox" :
        stage === "RECEIVE_CHECK" ? "Inbox check failed" :
        stage === "REPLY" ? "Reply failed" :
        stage.endsWith("_TEST") ? `${stage.replace("_TEST", "")} connection test failed` :
        EVENT_LABELS.FAILED
      const parts = [meta.message ? String(meta.message) : meta.code ? String(meta.code) : null, meta.willRetry ? "will retry" : null, meta.warmupPaused ? "warmup paused" : null, testId]
      return { title: stageLabel, detail: parts.filter(Boolean).join(" · ") }
    }
    default:
      return { title: EVENT_LABELS[evt.type], detail: testId }
  }
}

export function formatLatency(seconds: number) {
  if (seconds < 60) return `${seconds}s`
  if (seconds < 3600) return `${Math.round(seconds / 60)} min`
  return `${(seconds / 3600).toFixed(1)} h`
}
