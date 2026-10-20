import crypto from "crypto"

const ALPHABET = "abcdefghijkmnpqrstuvwxyz23456789"

export function generateTestId(): string {
  const bytes = crypto.randomBytes(10)
  let id = ""
  for (const b of bytes) id += ALPHABET[b % ALPHABET.length]
  return `tst_${id}`
}

/** Unique RFC 5322 Message-ID on the sender's own domain. */
export function generateMessageId(testId: string, fromEmail: string): string {
  const domain = fromEmail.split("@")[1] || "localhost"
  return `<${testId}.${crypto.randomBytes(8).toString("hex")}@${domain}>`
}
