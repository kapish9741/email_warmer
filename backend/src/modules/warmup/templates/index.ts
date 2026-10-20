import { getZonedParts } from "../../../utils/time"
import { EMAIL_TEMPLATES, REPLY_TEMPLATES, type EmailTemplate, type ReplyTemplate, type TemplateCategory } from "./library"

export { EMAIL_TEMPLATES, REPLY_TEMPLATES }
export type { EmailTemplate, ReplyTemplate, TemplateCategory }

export const TEMPLATE_VARIABLES = [
  "sender_name",
  "recipient_name",
  "sender_first_name",
  "recipient_first_name",
  "sender_email",
  "recipient_email",
  "sender_domain",
  "recipient_domain",
  "weekday",
  "date",
  "time_of_day",
  "timezone",
  "active_window",
  "daily_limit",
  "test_id",
  "original_subject",
] as const

export type TemplateVariable = (typeof TEMPLATE_VARIABLES)[number]
export type TemplateContext = Record<TemplateVariable, string>

/** Manual test sends only use the technical category; scheduled warmup rotates through all of them. */
export const WARMUP_CATEGORIES: TemplateCategory[] = ["casual", "professional", "informational", "technical"]
export const TEST_CATEGORIES: TemplateCategory[] = ["technical"]

/** How many recent messages are considered when avoiding repeats. */
export const RECENT_TEMPLATE_WINDOW = 30

const templatesById = new Map(EMAIL_TEMPLATES.map((t) => [t.id, t]))

export function getTemplate(id: string | null | undefined): EmailTemplate | undefined {
  return id ? templatesById.get(id) : undefined
}

export function getRepliesFor(templateId: string): ReplyTemplate[] {
  return REPLY_TEMPLATES.filter((r) => r.replyTo === templateId)
}

/**
 * Picks a starter template. Templates used in the most recent messages are skipped while unused alternatives exist,
 * and the category of the previous message is avoided when another category is available.
 * `recentIds` is ordered newest first.
 */
export function selectTemplate(
  recentIds: (string | null | undefined)[],
  opts: { categories?: TemplateCategory[]; random?: () => number } = {},
): EmailTemplate {
  const categories = opts.categories ?? WARMUP_CATEGORIES
  const random = opts.random ?? Math.random
  const pool = EMAIL_TEMPLATES.filter((t) => categories.includes(t.category))
  if (pool.length === 0) throw new Error("No templates in the requested categories")

  const recent = recentIds.filter((id): id is string => !!id)
  // Exclude as much recent history as possible while always leaving at least one candidate.
  let candidates = pool
  for (let window = Math.min(recent.length, pool.length - 1); window > 0; window--) {
    const excluded = new Set(recent.slice(0, window))
    const remaining = pool.filter((t) => !excluded.has(t.id))
    if (remaining.length > 0) {
      candidates = remaining
      break
    }
  }

  const lastCategory = getTemplate(recent[0])?.category
  const otherCategory = candidates.filter((t) => t.category !== lastCategory)
  if (otherCategory.length > 0) candidates = otherCategory

  return candidates[Math.floor(random() * candidates.length)]
}

/** Picks the reply for a starter, avoiding the reply used most recently when it has alternatives. */
export function selectReply(
  templateId: string | null | undefined,
  opts: { recentReplyIds?: string[]; random?: () => number } = {},
): ReplyTemplate | undefined {
  if (!templateId) return undefined
  const replies = getRepliesFor(templateId)
  if (replies.length <= 1) return replies[0]
  const fresh = replies.filter((r) => !opts.recentReplyIds?.includes(r.id))
  const pool = fresh.length > 0 ? fresh : replies
  return pool[Math.floor((opts.random ?? Math.random)() * pool.length)]
}

/** Replaces {{placeholders}}. Unknown placeholders are removed rather than shown to the reader. */
export function renderTemplate(text: string, context: Partial<TemplateContext>): string {
  return text.replace(/\{\{\s*([a-z_]+)\s*\}\}/g, (_, key: string) => context[key as TemplateVariable] ?? "")
}

/**
 * "jordan.lee+warmup@example.com" → "Jordan Lee". Local parts that don't read as a name (digits, symbols,
 * e.g. "x7k2q") are used exactly as written rather than turned into a made-up name.
 */
export function nameFromEmail(email: string): string {
  const local = email.split("@")[0]?.split("+")[0] ?? ""
  const words = local.split(/[._-]+/).filter(Boolean)
  if (words.length === 0) return email
  if (!words.every((w) => /^\p{L}+$/u.test(w))) return local
  return words.map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ")
}

function domainOf(email: string) {
  return email.split("@")[1] ?? email
}

const pad = (n: number) => String(n).padStart(2, "0")

export interface ContextInput {
  senderEmail: string
  recipientEmail: string
  /** The time the message is about; scheduled time for warmup sends, so subject and body always agree. */
  at: Date
  timezone: string
  activeStartHour: number
  activeEndHour: number
  dailyLimit: number
  testId: string
  originalSubject?: string
}

export function buildTemplateContext(input: ContextInput): TemplateContext {
  const senderName = nameFromEmail(input.senderEmail)
  const recipientName = nameFromEmail(input.recipientEmail)
  const { hour } = getZonedParts(input.at, input.timezone)
  const weekday = new Intl.DateTimeFormat("en-US", { weekday: "long", timeZone: input.timezone }).format(input.at)
  const date = new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: input.timezone }).format(input.at)
  return {
    sender_name: senderName,
    recipient_name: recipientName,
    sender_first_name: senderName.split(" ")[0],
    recipient_first_name: recipientName.split(" ")[0],
    sender_email: input.senderEmail,
    recipient_email: input.recipientEmail,
    sender_domain: domainOf(input.senderEmail),
    recipient_domain: domainOf(input.recipientEmail),
    weekday,
    date,
    time_of_day: hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening",
    timezone: input.timezone,
    active_window: `${pad(input.activeStartHour)}:00–${pad(input.activeEndHour % 24)}:00`,
    daily_limit: String(input.dailyLimit),
    test_id: input.testId,
    original_subject: input.originalSubject ?? "",
  }
}

/** Identifies every message as coming from this app, and lets the receipt check find it by test ID. */
export function footer(testId: string): string {
  return ["", "--", "Sent between two mailboxes connected in Email Warmer.", `Test ID: ${testId}`].join("\n")
}
