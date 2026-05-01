// Festival availability — parsed from the Squarespace "Which days would
// you be available to perform" field, which arrives as a freeform
// comma-joined string like:
//   "Thursday, July 9th, 2026 (new!),Friday, July 10th, 2026 (new!)"
// Plus assorted typos and stray "(new!)" markers depending on the year's
// form revision. We only care about the day-of-week — the dates are
// canonical for a single festival year, so a substring match on the day
// name is enough.

export type FestivalDay = "thu" | "fri" | "sat" | "sun"

export const FESTIVAL_DAY_ORDER: FestivalDay[] = ["thu", "fri", "sat", "sun"]

export const FESTIVAL_DAY_META: Record<
  FestivalDay,
  { letter: string; long: string }
> = {
  thu: { letter: "T", long: "Thursday" },
  fri: { letter: "F", long: "Friday" },
  sat: { letter: "S", long: "Saturday" },
  sun: { letter: "S", long: "Sunday" },
}

const DAY_PATTERNS: { code: FestivalDay; pattern: RegExp }[] = [
  { code: "thu", pattern: /\bthu(?:rsday)?\b/i },
  { code: "fri", pattern: /\bfri(?:day)?\b/i },
  { code: "sat", pattern: /\bsat(?:urday)?\b/i },
  { code: "sun", pattern: /\bsun(?:day)?\b/i },
]

const RAW_AVAILABILITY_KEYS = [
  "Which days would you be available to perform",
  "Which days are you available to perform",
  "Availability",
  "Available days",
]

export function parseAvailability(raw: string | null | undefined): FestivalDay[] {
  if (!raw) return []
  const found = new Set<FestivalDay>()
  for (const { code, pattern } of DAY_PATTERNS) {
    if (pattern.test(raw)) found.add(code)
  }
  // Return in canonical T/F/S/S order so callers don't have to sort.
  return FESTIVAL_DAY_ORDER.filter((d) => found.has(d))
}

export function getActAvailability(
  data: Record<string, unknown> | null | undefined,
): FestivalDay[] {
  if (!data) return []
  for (const key of RAW_AVAILABILITY_KEYS) {
    const v = data[key]
    if (typeof v === "string" && v.trim()) return parseAvailability(v)
  }
  return []
}
