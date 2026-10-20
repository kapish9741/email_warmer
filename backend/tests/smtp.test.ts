import { test } from "node:test"
import assert from "node:assert/strict"
import "./env"
import { normalizeMailError } from "../src/utils/errors"
import { encryptToString, decryptFromString } from "../src/security/encryption"
import { redact, scrubSecrets } from "../src/security/redaction"

test("SMTP auth failures are not retryable", () => {
  const e = normalizeMailError({ code: "EAUTH", responseCode: 535, message: "Invalid login" }, "SMTP")
  assert.equal(e.code, "SMTP_AUTH_FAILED")
  assert.equal(e.message, "SMTP authentication failed")
  assert.equal(e.retryable, false)
})

test("transient network errors are retryable", () => {
  assert.equal(normalizeMailError({ code: "ETIMEDOUT" }, "SMTP").retryable, true)
  assert.equal(normalizeMailError({ code: "ECONNRESET" }, "SMTP").retryable, true)
  assert.equal(normalizeMailError({ responseCode: 421 }, "SMTP").category, "RATE_LIMIT")
})

test("permanent errors are not retryable", () => {
  assert.equal(normalizeMailError({ code: "ENOTFOUND" }, "SMTP").retryable, false)
  assert.equal(normalizeMailError({ code: "EENVELOPE", responseCode: 550 }, "SMTP").category, "RECIPIENT_REJECTED")
  assert.equal(normalizeMailError({ message: "wrong version number" }, "IMAP").category, "TLS")
})

test("IMAP auth failure", () => {
  const e = normalizeMailError({ authenticationFailed: true, serverResponseCode: "AUTHENTICATIONFAILED" }, "IMAP")
  assert.equal(e.code, "IMAP_AUTH_FAILED")
  assert.equal(e.retryable, false)
})

test("normalized errors never echo provider messages", () => {
  const e = normalizeMailError({ code: "EAUTH", message: "535 bad password hunter2" }, "SMTP")
  assert.ok(!e.message.includes("hunter2"))
})

test("encryption round-trips and uses a fresh IV", () => {
  const a = encryptToString("s3cret!")
  const b = encryptToString("s3cret!")
  assert.notEqual(a, b)
  assert.ok(!a.includes("s3cret"))
  assert.equal(decryptFromString(a), "s3cret!")
})

test("tampered ciphertext fails authentication", () => {
  const parts = encryptToString("s3cret!").split(":")
  parts[3] = Buffer.from("tampered").toString("base64")
  assert.throws(() => decryptFromString(parts.join(":")))
})

test("redaction strips secrets", () => {
  assert.deepEqual(redact({ host: "h", password: "x", nested: { smtpPassword: "y", ok: 1 } }), { host: "h", nested: { ok: 1 } })
  assert.equal(scrubSecrets("auth failed for pw123456", ["pw123456"]), "auth failed for [REDACTED]")
})
