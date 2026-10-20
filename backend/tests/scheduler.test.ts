import { test } from "node:test"
import assert from "node:assert/strict"
import "./env"
import { computeDailyLimit, planSendTimes } from "../src/modules/warmup/scheduler.service"
import { dayWindow, zonedTimeToUtc, localDayKey } from "../src/utils/time"

const base = {
  dailyLimit: 10,
  rampUpEnabled: true,
  rampStartVolume: 2,
  rampIncrement: 1,
  timezone: "UTC",
  activeStartHour: 9,
  activeEndHour: 17,
  minDelayMinutes: 45,
  maxDelayMinutes: 180,
}

test("ramp-up grows daily and caps at dailyLimit", () => {
  const startedAt = new Date("2026-01-01T10:00:00Z")
  const day = (d: string) => computeDailyLimit({ ...base, startedAt }, new Date(d))
  assert.deepEqual(day("2026-01-01T12:00:00Z"), { rampDay: 1, limit: 2 })
  assert.deepEqual(day("2026-01-02T12:00:00Z"), { rampDay: 2, limit: 3 })
  assert.equal(day("2026-01-20T12:00:00Z").limit, 10)
})

test("ramp-up disabled uses the flat daily limit", () => {
  assert.equal(computeDailyLimit({ ...base, rampUpEnabled: false, startedAt: null }).limit, 10)
})

test("planned send times respect delays and the window end", () => {
  const from = new Date("2026-01-01T09:00:00Z")
  const windowEnd = new Date("2026-01-01T17:00:00Z")
  for (let i = 0; i < 50; i++) {
    const times = planSendTimes(base, { from, windowEnd, count: 10 })
    assert.ok(times.length >= 1 && times.length <= 10)
    assert.ok(times[0] > from)
    for (let j = 1; j < times.length; j++) {
      const gapMin = (times[j].getTime() - times[j - 1].getTime()) / 60_000
      assert.ok(gapMin >= 45 - 0.01 && gapMin <= 180 + 0.01, `gap ${gapMin}`)
    }
    assert.ok(times.every((t) => t < windowEnd))
  }
})

test("planning continues after the previous message, never in the past", () => {
  const from = new Date("2026-01-01T12:00:00Z")
  const previous = new Date("2026-01-01T09:30:00Z")
  const times = planSendTimes(base, { from, windowEnd: new Date("2026-01-01T17:00:00Z"), count: 1, previous })
  assert.ok(times[0] >= from)
})

test("timezone window conversion", () => {
  // 09:00 in Kolkata (UTC+5:30) is 03:30 UTC.
  assert.equal(zonedTimeToUtc(2026, 3, 10, 9, "Asia/Kolkata").toISOString(), "2026-03-10T03:30:00.000Z")
  // New York across DST: EST (-5) in January, EDT (-4) in July.
  assert.equal(zonedTimeToUtc(2026, 1, 15, 9, "America/New_York").toISOString(), "2026-01-15T14:00:00.000Z")
  assert.equal(zonedTimeToUtc(2026, 7, 15, 9, "America/New_York").toISOString(), "2026-07-15T13:00:00.000Z")

  const win = dayWindow(new Date("2026-03-10T20:00:00Z"), "Asia/Kolkata", 9, 17)
  assert.equal(win.dayKey, "2026-03-11")
  assert.equal(localDayKey(new Date("2026-03-10T20:00:00Z"), "UTC"), "2026-03-10")
})
