import { z } from "zod"

const security = z.enum(["SSL", "STARTTLS", "NONE"])
const host = z
  .string()
  .trim()
  .min(1, "Host is required")
  .max(255)
  .regex(/^[a-zA-Z0-9.-]+$/, "Host must be a hostname or IP address")
const port = z.coerce.number().int().min(1, "Port must be between 1 and 65535").max(65535, "Port must be between 1 and 65535")
const username = z.string().trim().min(1, "Username is required").max(320)
const password = z.string().min(1, "Password is required").max(1000)

const fields = {
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  smtpHost: host.optional(),
  smtpPort: port.optional(),
  smtpSecurity: security.optional(),
  smtpUsername: username.optional(),
  smtpPassword: password.optional(),
  imapHost: host.optional(),
  imapPort: port.optional(),
  imapSecurity: security.optional(),
  imapUsername: username.optional(),
  imapPassword: password.optional(),
  // For the TARGET mailbox this means "real replies enabled" (requires SMTP settings).
  smtpEnabled: z.boolean().optional(),
}

export const createMailboxSchema = z.object({ type: z.enum(["WARMUP", "TARGET"]), ...fields }).strict()

export const updateMailboxSchema = z
  .object({
    ...fields,
    email: fields.email.optional(),
    // Empty string means "keep the saved password".
    smtpPassword: z.string().max(1000).optional(),
    imapPassword: z.string().max(1000).optional(),
  })
  .strict()

export type CreateMailboxInput = z.infer<typeof createMailboxSchema>
export type UpdateMailboxInput = z.infer<typeof updateMailboxSchema>

/** The effective (merged) mailbox settings, checked for completeness by role. */
export interface MailboxSettings {
  type: "WARMUP" | "TARGET"
  smtpEnabled: boolean
  smtpHost?: string | null
  smtpPort?: number | null
  smtpSecurity?: string | null
  smtpUsername?: string | null
  hasSmtpPassword: boolean
  imapHost?: string | null
  imapPort?: number | null
  imapSecurity?: string | null
  imapUsername?: string | null
  hasImapPassword: boolean
}

export function validateMailboxSettings(s: MailboxSettings): { path: string; message: string }[] {
  const issues: { path: string; message: string }[] = []
  const needSmtp = s.type === "WARMUP" || s.smtpEnabled
  const needImap = s.type === "TARGET"

  if (needSmtp) {
    if (!s.smtpHost) issues.push({ path: "smtpHost", message: "SMTP host is required" })
    if (!s.smtpPort) issues.push({ path: "smtpPort", message: "SMTP port is required" })
    if (!s.smtpSecurity) issues.push({ path: "smtpSecurity", message: "SMTP security is required" })
    if (!s.smtpUsername) issues.push({ path: "smtpUsername", message: "SMTP username is required" })
    if (!s.hasSmtpPassword) issues.push({ path: "smtpPassword", message: "SMTP password is required" })
  }
  if (needImap) {
    if (!s.imapHost) issues.push({ path: "imapHost", message: "IMAP host is required" })
    if (!s.imapPort) issues.push({ path: "imapPort", message: "IMAP port is required" })
    if (!s.imapSecurity) issues.push({ path: "imapSecurity", message: "IMAP security is required" })
    if (!s.imapUsername) issues.push({ path: "imapUsername", message: "IMAP username is required" })
    if (!s.hasImapPassword) issues.push({ path: "imapPassword", message: "IMAP password is required" })
  }
  return issues
}
