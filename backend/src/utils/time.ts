export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz })
    return true
  } catch {
    return false
  }
}

interface ZonedParts {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second: number
}

export function getZonedParts(date: Date, timeZone: string): ZonedParts {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date)
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value)
  return { year: get("year"), month: get("month"), day: get("day"), hour: get("hour"), minute: get("minute"), second: get("second") }
}

/** Offset of `timeZone` from UTC at the given instant, in milliseconds. */
function offsetMs(date: Date, timeZone: string): number {
  const p = getZonedParts(date, timeZone)
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second)
  return asUtc - Math.floor(date.getTime() / 1000) * 1000
}

/** Converts a wall-clock time in `timeZone` to the corresponding UTC instant. */
export function zonedTimeToUtc(year: number, month: number, day: number, hour: number, timeZone: string): Date {
  const guess = Date.UTC(year, month - 1, day, hour)
  const first = guess - offsetMs(new Date(guess), timeZone)
  // Re-evaluate once in case the guess crossed a DST transition.
  const second = guess - offsetMs(new Date(first), timeZone)
  return new Date(second)
}

/** Local calendar day in `timeZone`, as YYYY-MM-DD. */
export function localDayKey(date: Date, timeZone: string): string {
  const p = getZonedParts(date, timeZone)
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`
}

export function daysBetweenKeys(fromKey: string, toKey: string): number {
  const toUtc = (k: string) => {
    const [y, m, d] = k.split("-").map(Number)
    return Date.UTC(y, m - 1, d)
  }
  return Math.round((toUtc(toKey) - toUtc(fromKey)) / 86_400_000)
}

/** UTC bounds of the local day containing `date`, plus the active sending window within it. */
export function dayWindow(date: Date, timeZone: string, startHour: number, endHour: number) {
  const p = getZonedParts(date, timeZone)
  return {
    dayKey: localDayKey(date, timeZone),
    dayStart: zonedTimeToUtc(p.year, p.month, p.day, 0, timeZone),
    dayEnd: zonedTimeToUtc(p.year, p.month, p.day + 1, 0, timeZone),
    windowStart: zonedTimeToUtc(p.year, p.month, p.day, startHour, timeZone),
    windowEnd: zonedTimeToUtc(p.year, p.month, p.day, endHour, timeZone),
  }
}

export function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min)
}
