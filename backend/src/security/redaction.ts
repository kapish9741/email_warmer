// Fields that must never reach logs or API responses.
const SECRET_KEYS = [
  "password",
  "smtpPassword",
  "imapPassword",
  "encryptedSmtpPassword",
  "encryptedImapPassword",
  "passwordHash",
  "pass",
  "token",
  "authorization",
  "cookie",
]

export const REDACT_PATHS = [
  ...SECRET_KEYS,
  ...SECRET_KEYS.map((k) => `*.${k}`),
  ...SECRET_KEYS.map((k) => `*.*.${k}`),
  "req.headers.authorization",
  "req.headers.cookie",
  'res.headers["set-cookie"]',
]

const SECRET_KEY_SET = new Set(SECRET_KEYS.map((k) => k.toLowerCase()))

/** Deep-copies a value with secret-looking keys removed. Used for event metadata. */
export function redact<T>(value: T): T {
  if (Array.isArray(value)) return value.map(redact) as T
  if (value && typeof value === "object" && !(value instanceof Date)) {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value)) {
      if (SECRET_KEY_SET.has(k.toLowerCase())) continue
      out[k] = redact(v)
    }
    return out as T
  }
  return value
}

/** Removes any occurrence of the given secrets from a string (e.g. a provider error message). */
export function scrubSecrets(text: string, secrets: (string | undefined | null)[]): string {
  let result = text
  for (const s of secrets) {
    if (s && s.length >= 4) result = result.split(s).join("[REDACTED]")
  }
  return result
}
