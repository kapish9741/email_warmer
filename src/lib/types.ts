export type MailSecurity = "SSL" | "STARTTLS" | "NONE"
export type MailboxType = "WARMUP" | "TARGET"
export type MailboxStatus = "PENDING" | "CONNECTED" | "ERROR" | "DISABLED"
export type ConnectionTestStatus = "UNTESTED" | "SUCCESS" | "FAILED"

export interface Mailbox {
  id: string
  type: MailboxType
  email: string
  smtpHost: string | null
  smtpPort: number | null
  smtpSecurity: MailSecurity | null
  smtpUsername: string | null
  smtpEnabled: boolean
  imapHost: string | null
  imapPort: number | null
  imapSecurity: MailSecurity | null
  imapUsername: string | null
  imapEnabled: boolean
  status: MailboxStatus
  smtpTestStatus: ConnectionTestStatus
  imapTestStatus: ConnectionTestStatus
  lastSmtpError: string | null
  lastImapError: string | null
  lastSmtpTestAt: string | null
  lastImapTestAt: string | null
  hasSmtpPassword: boolean
  hasImapPassword: boolean
  createdAt: string
  updatedAt: string
}

export interface WarmupConfig {
  id: string
  warmupMailboxId: string | null
  targetMailboxId: string | null
  enabled: boolean
  dailyLimit: number
  minDelayMinutes: number
  maxDelayMinutes: number
  activeStartHour: number
  activeEndHour: number
  timezone: string
  repliesEnabled: boolean
  rampUpEnabled: boolean
  rampStartVolume: number
  rampIncrement: number
  startedAt: string | null
  updatedAt: string
}

export type WarmupStatus = "NOT_CONFIGURED" | "RUNNING" | "PAUSED" | "ERROR"

export interface WarmupOverview {
  config: WarmupConfig
  status: WarmupStatus
  warmupMailbox: Mailbox | null
  targetMailbox: Mailbox | null
  readiness: { warmupConnected: boolean; targetConnected: boolean; repliesReady: boolean; canStart: boolean }
  today: {
    date: string
    rampDay: number
    limit: number
    dayStart: string
    dayEnd: string
    windowStart: string
    windowEnd: string
    scheduled: number
    sent: number
    received: number
    failed: number
    nextScheduledAt: string | null
  }
  totals: { sent: number; received: number; replies: number; failed: number; timeout: number; inbox: number; spam: number }
}

export type MessageStatus = "SCHEDULED" | "SENDING" | "SENT" | "RECEIVED" | "BOUNCED" | "FAILED" | "TIMEOUT" | "REPLY_SENT"
export type MessageType = "WARMUP" | "TEST"
export type Placement = "INBOX" | "SPAM" | "OTHER"

export interface WarmupMessage {
  id: string
  warmupConfigId: string
  type: MessageType
  testId: string
  messageId: string | null
  subject: string
  from: string
  to: string
  status: MessageStatus
  scheduledAt: string
  sentAt: string | null
  receivedAt: string | null
  placement: Placement | null
  folder: string | null
  repliedAt: string | null
  replyError: string | null
  errorCode: string | null
  errorMessage: string | null
  createdAt: string
}

export type EventType =
  | "SCHEDULED"
  | "SMTP_CONNECTED"
  | "SMTP_SEND_STARTED"
  | "SMTP_SENT"
  | "IMAP_CONNECTED"
  | "MESSAGE_RECEIVED"
  | "REPLY_SENT"
  | "FAILED"

export interface WarmupEvent {
  id: string
  warmupMessageId: string | null
  type: EventType
  metadata: Record<string, unknown> | null
  createdAt: string
  warmupMessage: { testId: string; subject: string; type: MessageType } | null
}

export interface User {
  id: string
  email: string
  createdAt?: string
}

export interface MailboxInput {
  type?: MailboxType
  email?: string
  smtpHost?: string
  smtpPort?: number
  smtpSecurity?: MailSecurity
  smtpUsername?: string
  smtpPassword?: string
  imapHost?: string
  imapPort?: number
  imapSecurity?: MailSecurity
  imapUsername?: string
  imapPassword?: string
  smtpEnabled?: boolean
}

export type WarmupConfigInput = Partial<
  Pick<
    WarmupConfig,
    | "dailyLimit"
    | "minDelayMinutes"
    | "maxDelayMinutes"
    | "activeStartHour"
    | "activeEndHour"
    | "timezone"
    | "repliesEnabled"
    | "rampUpEnabled"
    | "rampStartVolume"
    | "rampIncrement"
  >
>
