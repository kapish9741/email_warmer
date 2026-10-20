import type { Mailbox, Prisma } from "@prisma/client"
import { prisma } from "../../db/prisma"
import { encryptToString } from "../../security/encryption"
import { AppError, badRequest, conflict, normalizeMailError, notFound } from "../../utils/errors"
import { eventService } from "../events/event.service"
import { ImapService } from "../imap/imap.service"
import { SmtpService } from "../smtp/smtp.service"
import { schedulerService } from "../warmup/scheduler.service"
import { warmupService } from "../warmup/warmup.service"
import { deriveMailboxStatus, getImapConfig, getSmtpConfig } from "./mailbox.credentials"
import { mailboxRepository, toPublicMailbox } from "./mailbox.repository"
import { validateMailboxSettings, type CreateMailboxInput, type UpdateMailboxInput } from "./mailbox.schema"

const SMTP_KEYS = ["smtpHost", "smtpPort", "smtpSecurity", "smtpUsername"] as const
const IMAP_KEYS = ["imapHost", "imapPort", "imapSecurity", "imapUsername"] as const

function assertComplete(settings: Parameters<typeof validateMailboxSettings>[0]) {
  const issues = validateMailboxSettings(settings)
  if (issues.length) throw badRequest(issues[0].message, { fields: issues })
}

async function getOwned(userId: string, id: string) {
  const mailbox = await mailboxRepository.findOwned(userId, id)
  if (!mailbox) throw notFound("Mailbox not found")
  return mailbox
}

export interface ConnectionTestResult {
  success: boolean
  protocol: "SMTP" | "IMAP"
  testedAt: Date
  message: string
  error?: { code: string; message: string; retryable: boolean; category: string }
  mailbox: ReturnType<typeof toPublicMailbox>
}

export const mailboxService = {
  async list(userId: string) {
    return (await mailboxRepository.listByUser(userId)).map(toPublicMailbox)
  },

  async get(userId: string, id: string) {
    return toPublicMailbox(await getOwned(userId, id))
  },

  async create(userId: string, input: CreateMailboxInput) {
    if (await mailboxRepository.findByType(userId, input.type)) {
      throw conflict("MAILBOX_EXISTS", `A ${input.type === "WARMUP" ? "warmup" : "target"} mailbox is already connected. Edit or remove it first`)
    }
    const smtpEnabled = input.type === "WARMUP" ? true : Boolean(input.smtpEnabled)
    const useSmtp = smtpEnabled
    const useImap = input.type === "TARGET"
    assertComplete({
      ...input,
      smtpEnabled,
      hasSmtpPassword: Boolean(input.smtpPassword),
      hasImapPassword: Boolean(input.imapPassword),
    })

    const mailbox = await mailboxRepository.create({
      userId,
      type: input.type,
      email: input.email,
      smtpEnabled,
      imapEnabled: useImap,
      ...(useSmtp
        ? {
            smtpHost: input.smtpHost,
            smtpPort: input.smtpPort,
            smtpSecurity: input.smtpSecurity,
            smtpUsername: input.smtpUsername,
            encryptedSmtpPassword: encryptToString(input.smtpPassword!),
          }
        : {}),
      ...(useImap
        ? {
            imapHost: input.imapHost,
            imapPort: input.imapPort,
            imapSecurity: input.imapSecurity,
            imapUsername: input.imapUsername,
            encryptedImapPassword: encryptToString(input.imapPassword!),
          }
        : {}),
      status: "PENDING",
    })
    await warmupService.getOrCreateConfig(userId)
    return toPublicMailbox(mailbox)
  },

  async update(userId: string, id: string, input: UpdateMailboxInput) {
    const current = await getOwned(userId, id)
    const smtpEnabled = current.type === "WARMUP" ? true : (input.smtpEnabled ?? current.smtpEnabled)

    const data: Prisma.MailboxUncheckedUpdateInput = { smtpEnabled }
    if (input.email !== undefined) data.email = input.email

    let smtpChanged = smtpEnabled !== current.smtpEnabled
    if (smtpEnabled) {
      for (const k of SMTP_KEYS) {
        if (input[k] !== undefined && input[k] !== current[k]) {
          ;(data as Record<string, unknown>)[k] = input[k]
          smtpChanged = true
        }
      }
      if (input.smtpPassword) {
        data.encryptedSmtpPassword = encryptToString(input.smtpPassword)
        smtpChanged = true
      }
    } else if (current.type === "TARGET") {
      // Replies turned off: drop the reply SMTP credentials entirely.
      Object.assign(data, { smtpHost: null, smtpPort: null, smtpSecurity: null, smtpUsername: null, encryptedSmtpPassword: null })
    }

    let imapChanged = false
    if (current.type === "TARGET") {
      for (const k of IMAP_KEYS) {
        if (input[k] !== undefined && input[k] !== current[k]) {
          ;(data as Record<string, unknown>)[k] = input[k]
          imapChanged = true
        }
      }
      if (input.imapPassword) {
        data.encryptedImapPassword = encryptToString(input.imapPassword)
        imapChanged = true
      }
    }

    const merged = { ...current, ...data } as Mailbox
    assertComplete({
      ...merged,
      type: current.type,
      smtpEnabled,
      hasSmtpPassword: Boolean(merged.encryptedSmtpPassword),
      hasImapPassword: Boolean(merged.encryptedImapPassword),
    })

    // Changed credentials invalidate previous test results; the user must re-test before the mailbox counts as connected.
    if (smtpChanged) Object.assign(data, { smtpTestStatus: "UNTESTED", lastSmtpError: null })
    if (imapChanged) Object.assign(data, { imapTestStatus: "UNTESTED", lastImapError: null })
    data.status = deriveMailboxStatus({
      type: current.type,
      smtpEnabled,
      smtpTestStatus: smtpChanged ? "UNTESTED" : current.smtpTestStatus,
      imapTestStatus: imapChanged ? "UNTESTED" : current.imapTestStatus,
    })

    const updated = await mailboxRepository.update(id, data)

    // Replies can't run without target SMTP.
    if (current.type === "TARGET" && !smtpEnabled) {
      await prisma.warmupConfig.updateMany({ where: { userId }, data: { repliesEnabled: false } })
    }
    return toPublicMailbox(updated)
  },

  async remove(userId: string, id: string) {
    const mailbox = await getOwned(userId, id)
    const config = await prisma.warmupConfig.findUnique({ where: { userId } })
    if (config) {
      // Warmup can't run with a missing mailbox; stop it and drop unsent messages. Sent history is kept.
      await prisma.warmupConfig.update({
        where: { id: config.id },
        data: { enabled: false, ...(mailbox.type === "TARGET" ? { repliesEnabled: false } : {}) },
      })
      await schedulerService.cancelScheduled(config.id)
    }
    await mailboxRepository.delete(id)
    await warmupService.getOrCreateConfig(userId)
  },

  async testSmtp(userId: string, id: string): Promise<ConnectionTestResult> {
    const mailbox = await getOwned(userId, id)
    if (!mailbox.smtpEnabled) throw new AppError(400, "SMTP_NOT_CONFIGURED", "SMTP is not configured for this mailbox")
    return runTest(userId, mailbox, "SMTP", () => SmtpService.verifyConnection(getSmtpConfig(mailbox)))
  },

  async testImap(userId: string, id: string): Promise<ConnectionTestResult> {
    const mailbox = await getOwned(userId, id)
    if (mailbox.type !== "TARGET" || !mailbox.imapEnabled) {
      throw new AppError(400, "IMAP_NOT_CONFIGURED", "IMAP is not configured for this mailbox")
    }
    return runTest(userId, mailbox, "IMAP", () => ImapService.verifyConnection(getImapConfig(mailbox)))
  },
}

async function runTest(
  userId: string,
  mailbox: Mailbox,
  protocol: "SMTP" | "IMAP",
  verify: () => Promise<void>,
): Promise<ConnectionTestResult> {
  const testedAt = new Date()
  const prefix = protocol === "SMTP" ? "smtp" : "imap"
  try {
    await verify()
    const updated = await mailboxRepository.update(mailbox.id, {
      [`${prefix}TestStatus`]: "SUCCESS",
      [`last${protocol === "SMTP" ? "Smtp" : "Imap"}Error`]: null,
      [`last${protocol === "SMTP" ? "Smtp" : "Imap"}TestAt`]: testedAt,
      status: deriveMailboxStatus({ ...mailbox, [`${prefix}TestStatus`]: "SUCCESS" }),
    })
    await eventService.record(userId, protocol === "SMTP" ? "SMTP_CONNECTED" : "IMAP_CONNECTED", {
      metadata: { mailbox: mailbox.email, mailboxType: mailbox.type, test: true },
    })
    return { success: true, protocol, testedAt, message: "Connection successful", mailbox: toPublicMailbox(updated) }
  } catch (err) {
    const normalized = normalizeMailError(err, protocol)
    const updated = await mailboxRepository.update(mailbox.id, {
      [`${prefix}TestStatus`]: "FAILED",
      [`last${protocol === "SMTP" ? "Smtp" : "Imap"}Error`]: normalized.message,
      [`last${protocol === "SMTP" ? "Smtp" : "Imap"}TestAt`]: testedAt,
      status: "ERROR",
    })
    await eventService.record(userId, "FAILED", {
      metadata: { stage: `${protocol}_TEST`, mailbox: mailbox.email, code: normalized.code, providerCode: normalized.providerCode },
    })
    return {
      success: false,
      protocol,
      testedAt,
      message: normalized.message,
      error: { code: normalized.code, message: normalized.message, retryable: normalized.retryable, category: normalized.category },
      mailbox: toPublicMailbox(updated),
    }
  }
}
