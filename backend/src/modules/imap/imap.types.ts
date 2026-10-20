import type { MailSecurity } from "../smtp/smtp.types"

export interface ImapConfig {
  host: string
  port: number
  security: MailSecurity
  username: string
  password: string
}

export interface MessageSearchCriteria {
  messageId: string
  testId: string
  from: string
  since: Date
}

export interface FoundMessage {
  folder: string
  placement: "INBOX" | "SPAM" | "OTHER"
  uid: number
  matchedBy: "message-id" | "test-id" | "subject" | "body"
}
