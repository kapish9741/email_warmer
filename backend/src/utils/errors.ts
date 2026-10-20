export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message)
  }
}

export const badRequest = (message: string, details?: unknown) => new AppError(400, "VALIDATION_ERROR", message, details)
export const unauthorized = (message = "Authentication required") => new AppError(401, "UNAUTHORIZED", message)
export const notFound = (message = "Resource not found") => new AppError(404, "NOT_FOUND", message)
export const conflict = (code: string, message: string) => new AppError(409, code, message)

export type MailErrorCategory =
  | "AUTHENTICATION"
  | "CONNECTION"
  | "TIMEOUT"
  | "RATE_LIMIT"
  | "TLS"
  | "DNS"
  | "MAILBOX_NOT_FOUND"
  | "RECIPIENT_REJECTED"
  | "UNKNOWN"

export interface NormalizedMailError {
  category: MailErrorCategory
  code: string
  providerCode?: string
  message: string
  retryable: boolean
}

type Protocol = "SMTP" | "IMAP"

interface ProviderError {
  code?: string
  responseCode?: number
  authenticationFailed?: boolean
  serverResponseCode?: string
  responseText?: string
  message?: string
}

const TLS_CODES = new Set([
  "ETLS",
  "CERT_HAS_EXPIRED",
  "DEPTH_ZERO_SELF_SIGNED_CERT",
  "SELF_SIGNED_CERT_IN_CHAIN",
  "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
  "ERR_TLS_CERT_ALTNAME_INVALID",
  "ERR_SSL_WRONG_VERSION_NUMBER",
])

const MESSAGES: Record<MailErrorCategory, (p: Protocol) => string> = {
  AUTHENTICATION: (p) => `${p} authentication failed`,
  CONNECTION: (p) => `Could not connect to the ${p} server`,
  TIMEOUT: (p) => `${p} server connection timed out`,
  RATE_LIMIT: (p) => `${p} provider is rate limiting requests`,
  TLS: (p) => `${p} TLS/SSL negotiation failed. Check the port and security setting`,
  DNS: (p) => `${p} host could not be resolved`,
  MAILBOX_NOT_FOUND: () => "Mailbox folder not found",
  RECIPIENT_REJECTED: () => "Recipient address was rejected by the SMTP server",
  UNKNOWN: (p) => `Unexpected ${p} error`,
}

function categorize(err: ProviderError): { category: MailErrorCategory; retryable: boolean } {
  const code = err.code ?? ""
  const msg = (err.message ?? "").toLowerCase()
  const rc = err.responseCode

  if (code === "EAUTH" || err.authenticationFailed || err.serverResponseCode === "AUTHENTICATIONFAILED") {
    return { category: "AUTHENTICATION", retryable: false }
  }
  if (TLS_CODES.has(code) || msg.includes("wrong version number") || msg.includes("certificate")) {
    return { category: "TLS", retryable: false }
  }
  if (code === "ENOTFOUND" || code === "EDNS") return { category: "DNS", retryable: false }
  if (code === "EAI_AGAIN") return { category: "DNS", retryable: true }
  if (code === "ETIMEDOUT" || code === "ETIMEOUT" || msg.includes("timed out") || msg.includes("timeout")) {
    return { category: "TIMEOUT", retryable: true }
  }
  if (code === "EENVELOPE" || (rc !== undefined && [550, 551, 553].includes(rc))) {
    return { category: "RECIPIENT_REJECTED", retryable: false }
  }
  if (rc === 421 || rc === 450 || rc === 451 || rc === 452 || msg.includes("rate limit") || msg.includes("too many")) {
    return { category: "RATE_LIMIT", retryable: true }
  }
  if (err.serverResponseCode === "NONEXISTENT" || msg.includes("mailbox doesn't exist")) {
    return { category: "MAILBOX_NOT_FOUND", retryable: false }
  }
  if (["ECONNECTION", "ECONNREFUSED", "ECONNRESET", "ESOCKET", "EPIPE", "NoConnection", "EHOSTUNREACH"].includes(code)) {
    return { category: "CONNECTION", retryable: true }
  }
  if (rc !== undefined && rc >= 400 && rc < 500) return { category: "UNKNOWN", retryable: true }
  return { category: "UNKNOWN", retryable: false }
}

/** Converts a raw Nodemailer/ImapFlow/socket error into a safe, user-facing error. Never includes credentials. */
export function normalizeMailError(error: unknown, protocol: Protocol): NormalizedMailError {
  const err = (error ?? {}) as ProviderError
  const { category, retryable } = categorize(err)
  const providerCode = err.code ?? (err.responseCode ? String(err.responseCode) : err.serverResponseCode)
  return {
    category,
    code: `${protocol}_${category === "AUTHENTICATION" ? "AUTH_FAILED" : category}`,
    providerCode,
    message: MESSAGES[category](protocol),
    retryable,
  }
}
