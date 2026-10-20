import nodemailer from "nodemailer"
import type { SendMessageOptions, SendResult, SmtpConfig } from "./smtp.types"

export type { SmtpConfig, SendMessageOptions, SendResult } from "./smtp.types"

export class SmtpService {
  /** Transport settings come only from the user's mailbox configuration; no provider defaults are assumed. */
  public static createTransporter(config: SmtpConfig) {
    return nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.security === "SSL",
      requireTLS: config.security === "STARTTLS",
      ignoreTLS: config.security === "NONE",
      auth: { user: config.username, pass: config.password },
      tls: { rejectUnauthorized: true },
      connectionTimeout: 15_000,
      greetingTimeout: 15_000,
      socketTimeout: 30_000,
      logger: false,
      debug: false,
    })
  }

  public static async verifyConnection(config: SmtpConfig): Promise<void> {
    const transporter = this.createTransporter(config)
    try {
      await transporter.verify()
    } finally {
      transporter.close()
    }
  }

  public static async sendMessage(config: SmtpConfig, options: SendMessageOptions): Promise<SendResult> {
    const transporter = this.createTransporter(config)
    try {
      const info = await transporter.sendMail({
        from: options.from,
        to: options.to,
        subject: options.subject,
        text: options.text,
        messageId: options.messageId,
        inReplyTo: options.inReplyTo,
        references: options.references,
        headers: { "X-Warmup-Test-ID": options.testId },
      })
      const rejected = (info.rejected ?? []).map(String)
      if (rejected.length > 0) {
        throw Object.assign(new Error("Recipient rejected"), { code: "EENVELOPE" })
      }
      return {
        messageId: info.messageId,
        accepted: (info.accepted ?? []).map(String),
        rejected,
        response: info.response,
      }
    } finally {
      transporter.close()
    }
  }
}
