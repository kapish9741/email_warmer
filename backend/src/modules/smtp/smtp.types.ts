export type MailSecurity = "SSL" | "STARTTLS" | "NONE"

export interface SmtpConfig {
  host: string
  port: number
  security: MailSecurity
  username: string
  password: string
}

export interface SendMessageOptions {
  from: string
  to: string
  subject: string
  text: string
  testId: string
  messageId: string
  inReplyTo?: string
  references?: string
}

export interface SendResult {
  messageId: string
  accepted: string[]
  rejected: string[]
  response: string
}
