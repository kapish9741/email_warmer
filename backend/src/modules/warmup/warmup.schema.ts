import { z } from "zod"
import { WARMUP_LIMITS } from "../../config/constants"
import { isValidTimeZone } from "../../utils/time"

const int = (min: number, max: number, label: string) =>
  z.coerce.number().int(`${label} must be a whole number`).min(min, `${label} must be at least ${min}`).max(max, `${label} must be at most ${max}`)

export const warmupConfigFields = z
  .object({
    dailyLimit: int(1, WARMUP_LIMITS.maxDailyLimit, "Daily messages"),
    minDelayMinutes: int(WARMUP_LIMITS.minDelayMinutes, WARMUP_LIMITS.maxDelayMinutes, "Minimum delay"),
    maxDelayMinutes: int(WARMUP_LIMITS.minDelayMinutes, WARMUP_LIMITS.maxDelayMinutes, "Maximum delay"),
    activeStartHour: int(0, 23, "Active start hour"),
    activeEndHour: int(1, 24, "Active end hour"),
    timezone: z.string().trim().refine(isValidTimeZone, "Unknown timezone"),
    repliesEnabled: z.boolean(),
    rampUpEnabled: z.boolean(),
    rampStartVolume: int(1, WARMUP_LIMITS.maxDailyLimit, "Ramp-up start volume"),
    rampIncrement: int(1, WARMUP_LIMITS.maxRampIncrement, "Daily increase"),
  })
  .strict()

export const updateWarmupConfigSchema = warmupConfigFields.partial()

export type WarmupConfigInput = z.infer<typeof updateWarmupConfigSchema>

/** Cross-field rules, checked against the merged (saved + incoming) configuration. */
export function validateWarmupConfig(c: z.infer<typeof warmupConfigFields>): string | null {
  if (c.minDelayMinutes > c.maxDelayMinutes) return "Minimum delay must not exceed maximum delay"
  if (c.activeStartHour >= c.activeEndHour) return "Active end time must be after the start time"
  return null
}
