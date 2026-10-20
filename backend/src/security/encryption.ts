import crypto from "crypto"
import { env } from "../config/env"

const ALGORITHM = "aes-256-gcm"
const VERSION = "v1"

// Derive a fixed 32-byte key from the configured secret so any sufficiently long secret works.
const KEY = crypto.createHash("sha256").update(env.APP_ENCRYPTION_KEY, "utf8").digest()

export interface EncryptedPayload {
  ciphertext: string
  iv: string
  authTag: string
}

export function encryptSecret(text: string): EncryptedPayload {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv)
  const ciphertext = Buffer.concat([cipher.update(text, "utf8"), cipher.final()])
  return {
    ciphertext: ciphertext.toString("base64"),
    iv: iv.toString("base64"),
    authTag: cipher.getAuthTag().toString("base64"),
  }
}

export function decryptSecret(payload: EncryptedPayload): string {
  const decipher = crypto.createDecipheriv(ALGORITHM, KEY, Buffer.from(payload.iv, "base64"))
  decipher.setAuthTag(Buffer.from(payload.authTag, "base64"))
  return Buffer.concat([decipher.update(Buffer.from(payload.ciphertext, "base64")), decipher.final()]).toString("utf8")
}

/** Serializes an encrypted secret for storage in a single text column. */
export function encryptToString(text: string): string {
  const { iv, authTag, ciphertext } = encryptSecret(text)
  return [VERSION, iv, authTag, ciphertext].join(":")
}

export function decryptFromString(stored: string): string {
  const [version, iv, authTag, ciphertext] = stored.split(":")
  if (version !== VERSION || !iv || !authTag || !ciphertext) {
    throw new Error("Unsupported encrypted secret format")
  }
  return decryptSecret({ iv, authTag, ciphertext })
}
