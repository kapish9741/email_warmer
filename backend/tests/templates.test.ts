import { test } from "node:test"
import assert from "node:assert/strict"
import {
  buildTemplateContext,
  EMAIL_TEMPLATES,
  nameFromEmail,
  renderTemplate,
  REPLY_TEMPLATES,
  selectReply,
  selectTemplate,
  TEMPLATE_VARIABLES,
  TEST_CATEGORIES,
} from "../src/modules/warmup/templates"

const placeholders = (text: string) => [...text.matchAll(/\{\{\s*([a-z_]+)\s*\}\}/g)].map((m) => m[1])

const context = buildTemplateContext({
  senderEmail: "jordan.lee@example.com",
  recipientEmail: "casey@example.org",
  at: new Date("2026-10-21T14:30:00Z"),
  timezone: "UTC",
  activeStartHour: 9,
  activeEndHour: 17,
  dailyLimit: 20,
  testId: "tst_abc123",
  originalSubject: "Original",
})

test("library has at least 50 templates with unique ids, subjects and bodies", () => {
  assert.ok(EMAIL_TEMPLATES.length + REPLY_TEMPLATES.length >= 50)
  const ids = [...EMAIL_TEMPLATES, ...REPLY_TEMPLATES].map((t) => t.id)
  assert.equal(new Set(ids).size, ids.length)
  assert.equal(new Set(EMAIL_TEMPLATES.map((t) => t.subject)).size, EMAIL_TEMPLATES.length)
  const bodies = [...EMAIL_TEMPLATES, ...REPLY_TEMPLATES].map((t) => t.body)
  assert.equal(new Set(bodies).size, bodies.length)
  for (const category of ["casual", "professional", "informational", "technical"]) {
    assert.ok(EMAIL_TEMPLATES.filter((t) => t.category === category).length >= 5, category)
  }
})

test("every starter has a reply and every reply answers an existing starter", () => {
  const starterIds = new Set(EMAIL_TEMPLATES.map((t) => t.id))
  for (const t of EMAIL_TEMPLATES) assert.ok(selectReply(t.id), `no reply for ${t.id}`)
  for (const r of REPLY_TEMPLATES) assert.ok(starterIds.has(r.replyTo), `orphan reply ${r.id}`)
})

test("only known placeholders are used, and original_subject only in replies", () => {
  const known = new Set<string>(TEMPLATE_VARIABLES)
  for (const t of EMAIL_TEMPLATES) {
    for (const p of placeholders(t.subject + t.body)) {
      assert.ok(known.has(p), `${t.id}: {{${p}}}`)
      assert.notEqual(p, "original_subject", `${t.id} is not a reply`)
    }
  }
  for (const r of REPLY_TEMPLATES) for (const p of placeholders(r.body)) assert.ok(known.has(p), `${r.id}: {{${p}}}`)
})

test("rendering fills every placeholder", () => {
  for (const t of [...EMAIL_TEMPLATES, ...REPLY_TEMPLATES]) {
    const out = renderTemplate("subject" in t ? t.subject + t.body : t.body, context)
    assert.ok(!/\{\{|\}\}/.test(out), `${t.id} left a placeholder`)
  }
  assert.equal(renderTemplate("Hi {{recipient_name}}, {{unknown}}!", context), "Hi Casey, !")
  assert.equal(context.sender_first_name, "Jordan")
  assert.equal(context.sender_name, "Jordan Lee")
  assert.equal(context.active_window, "09:00–17:00")
  assert.equal(context.time_of_day, "afternoon")
  assert.equal(context.weekday, "Wednesday")
})

test("no long sentence is reused across templates", () => {
  const seen = new Map<string, string>()
  for (const t of [...EMAIL_TEMPLATES, ...REPLY_TEMPLATES]) {
    for (const sentence of t.body.split(/(?<=[.!?])\s+|\n+/)) {
      const s = sentence.trim()
      if (s.length < 40) continue
      assert.ok(!seen.has(s), `"${s}" appears in ${seen.get(s)} and ${t.id}`)
      seen.set(s, t.id)
    }
  }
  assert.ok(![...EMAIL_TEMPLATES, ...REPLY_TEMPLATES].some((t) => /hope you('|’)re doing well/i.test(t.body)))
})

test("selection avoids recently used templates and the previous category", () => {
  const recent: string[] = []
  for (let i = 0; i < EMAIL_TEMPLATES.length; i++) {
    const t = selectTemplate(recent)
    assert.ok(!recent.includes(t.id), `repeated ${t.id} after ${i} picks`)
    const lastCategory = EMAIL_TEMPLATES.find((x) => x.id === recent[0])?.category
    const alternativeExisted = EMAIL_TEMPLATES.some((x) => !recent.includes(x.id) && x.category !== lastCategory)
    if (lastCategory && alternativeExisted) assert.notEqual(t.category, lastCategory)
    recent.unshift(t.id)
  }
  // Once everything has been used, the least recently used template is the only candidate.
  const next = selectTemplate(recent, { random: () => 0 })
  assert.equal(next.id, recent[recent.length - 1])
})

test("test sends use technical templates only", () => {
  for (let i = 0; i < 20; i++) assert.equal(selectTemplate([], { categories: TEST_CATEGORIES }).category, "technical")
})

test("names are derived from the address", () => {
  assert.equal(nameFromEmail("jordan.lee+warmup@example.com"), "Jordan Lee")
  assert.equal(nameFromEmail("CASEY@example.org"), "Casey")
  assert.equal(nameFromEmail("upaunefjye4epudt@ethereal.email"), "upaunefjye4epudt")
  assert.equal(nameFromEmail("sales_2024@example.org"), "sales_2024")
})
