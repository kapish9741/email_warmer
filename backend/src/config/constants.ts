export const WARMUP_DEFAULTS = {
  dailyLimit: 5,
  minDelayMinutes: 45,
  maxDelayMinutes: 180,
  activeStartHour: 9,
  activeEndHour: 17,
  rampStartVolume: 2,
  rampIncrement: 1,
} as const

// Server-side hard caps. Keep volume conservative: this is a two-mailbox test tool, not a bulk sender.
export const WARMUP_LIMITS = {
  maxDailyLimit: 50,
  minDelayMinutes: 5,
  maxDelayMinutes: 720,
  maxRampIncrement: 5,
} as const

export const QUEUE_NAMES = {
  send: "warmup-send",
  receiveCheck: "warmup-receive-check",
  reply: "warmup-reply",
  scheduler: "warmup-scheduler",
} as const

// Delays (ms) between successive IMAP receipt checks after a message is sent.
// The message is marked TIMEOUT if it has not been observed after the last check (~2h total).
export const RECEIVE_CHECK_DELAYS_MS = [
  30_000, 60_000, 2 * 60_000, 3 * 60_000, 5 * 60_000, 10 * 60_000, 15 * 60_000, 30 * 60_000, 60 * 60_000,
]

// Random wait between receipt and the optional reply, so replies are not instantaneous.
export const REPLY_DELAY_RANGE_MS = [2 * 60_000, 15 * 60_000] as const

export const SEND_MAX_ATTEMPTS = 3
export const SCHEDULER_TICK_MS = 60_000

export const AUTH_COOKIE = "mw_session"
export const AUTH_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60
