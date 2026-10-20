import type { Mailbox } from "@prisma/client"
import { decryptFromString } from "../../security/encryption"
import type { MailSecurity } from "../smtp/smtp.types"
import type { SmtpConfig } from "../smtp/smtp.service"
import type { ImapConfig } from "../imap/imap.service"
import { AppError } from "../../utils/errors"

// Decrypted credentials live only in memory for the duration of a single provider operation.

export function getSmtpConfig(m: Mailbox): SmtpConfig {
  if (!m.smtpHost || !m.smtpPort || !m.smtpUsername || !m.encryptedSmtpPassword) {
    throw new AppError(400, "SMTP_NOT_CONFIGURED", `SMTP is not configured for ${m.email}`)
  }
  return {
    host: m.smtpHost,
    port: m.smtpPort,
    security: (m.smtpSecurity ?? "STARTTLS") as MailSecurity,
    username: m.smtpUsername,
    password: decryptFromString(m.encryptedSmtpPassword),
  }
}

export function getImapConfig(m: Mailbox): ImapConfig {
  if (!m.imapHost || !m.imapPort || !m.imapUsername || !m.encryptedImapPassword) {
    throw new AppError(400, "IMAP_NOT_CONFIGURED", `IMAP is not configured for ${m.email}`)
  }
  return {
    host: m.imapHost,
    port: m.imapPort,
    security: (m.imapSecurity ?? "SSL") as MailSecurity,
    username: m.imapUsername,
    password: decryptFromString(m.encryptedImapPassword),
  }
}

/** Overall mailbox status, derived only from real connection test outcomes. */
export function deriveMailboxStatus(m: Pick<Mailbox, "type" | "smtpEnabled" | "smtpTestStatus" | "imapTestStatus">) {
  const required = m.type === "WARMUP" ? [m.smtpTestStatus] : [m.imapTestStatus, ...(m.smtpEnabled ? [m.smtpTestStatus] : [])]
  if (required.some((s) => s === "FAILED")) return "ERROR" as const
  if (required.every((s) => s === "SUCCESS")) return "CONNECTED" as const
  return "PENDING" as const
}
