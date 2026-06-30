// Volunteer availability: parse the free-form sign-up answers stored in
// `submissions.data` into a structured shape, and match a volunteer against a
// shift (day + time-of-day + role). The festival sign-up form collects days
// (Jul 7–12), a coarse time-of-day preference, and role interests — none of it
// precise, so matching is a *signal* to sort and flag by, not a hard rule.
// Free-text constraints (e.g. "only evenings Thu/Fri") live in `note`.

export type DayPart = "morning" | "afternoon" | "evening"

export const DAY_PARTS: DayPart[] = ["morning", "afternoon", "evening"]

export type VolunteerAvailability = {
  days: string[] // YYYY-MM-DD, sorted ascending
  parts: DayPart[] // empty = no time preference given (treat as flexible)
  roleKeys: string[] // mapped to volunteer_roles.key
  flexibleRole: boolean // picked "Whatever is most helpful!"
  note: string // free-text "Anything else we should know"
}

// Exact column headers from the Squarespace volunteer sign-up CSV.
const COL_DAYS = "Which days are you available"
const COL_PARTS = "Time availability"
const COL_ROLES = "Which roles are you interested in"
const COL_NOTE = "Anything else we should know"

// Sign-up-form role labels → volunteer_roles.key (see migration 0024). The form
// option "Whatever is most helpful!" is handled separately as `flexibleRole`.
const ROLE_KEY_BY_LABEL: Record<string, string> = {
  "front of house / check in": "front-of-house",
  "workshop support": "workshop-support",
  "performer support / green room": "green-room",
  "set up & tear down": "setup-teardown",
  "tech booth / lighting / sound": "tech-booth",
  "admin / communication support": "admin-comms",
}

const FLEXIBLE_ROLE_LABEL = "whatever is most helpful!"

function norm(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim()
}

function asString(value: unknown): string {
  return value == null ? "" : String(value)
}

/** "July 9" → "2026-07-09". Pulls every "July N" mention out of the cell. */
function parseDays(raw: string): string[] {
  const found = new Set<string>()
  for (const m of raw.matchAll(/july\s+(\d{1,2})/gi)) {
    const n = parseInt(m[1], 10)
    if (n >= 7 && n <= 12) found.add(`2026-07-${String(n).padStart(2, "0")}`)
  }
  return Array.from(found).sort()
}

function parseParts(raw: string): DayPart[] {
  const out: DayPart[] = []
  for (const token of raw.split(",")) {
    const t = norm(token)
    if ((t === "morning" || t === "afternoon" || t === "evening") && !out.includes(t)) {
      out.push(t)
    }
  }
  return out
}

function parseRoles(raw: string): { roleKeys: string[]; flexibleRole: boolean } {
  const keys = new Set<string>()
  let flexibleRole = false
  for (const token of raw.split(",")) {
    const t = norm(token)
    if (!t) continue
    if (t === FLEXIBLE_ROLE_LABEL) {
      flexibleRole = true
      continue
    }
    const key = ROLE_KEY_BY_LABEL[t]
    if (key) keys.add(key)
  }
  return { roleKeys: Array.from(keys), flexibleRole }
}

/** Parse one volunteer submission's raw `data` jsonb into structured availability. */
export function parseAvailability(
  data: Record<string, unknown> | null | undefined,
): VolunteerAvailability {
  const d = data ?? {}
  const { roleKeys, flexibleRole } = parseRoles(asString(d[COL_ROLES]))
  return {
    days: parseDays(asString(d[COL_DAYS])),
    parts: parseParts(asString(d[COL_PARTS])),
    roleKeys,
    flexibleRole,
    note: asString(d[COL_NOTE]).trim(),
  }
}

/** Map a clock time ("HH:mm" or "HH:mm:ss") to a coarse day-part. */
export function dayPartForTime(time: string): DayPart {
  const h = parseInt(time.slice(0, 2), 10)
  if (!Number.isFinite(h)) return "evening"
  if (h < 12) return "morning"
  if (h < 17) return "afternoon"
  return "evening"
}

export type ShiftLike = { day: string; start_time: string; role_key: string }

export type FitStatus =
  | "available" // free that day and time-of-day
  | "time" // free that day, but a different time-of-day than the shift
  | "day" // not available that day at all
  | "unknown" // no availability info on file

export type Fit = {
  status: FitStatus
  dayOk: boolean
  timeOk: boolean
  timeKnown: boolean
  roleInterested: boolean
}

/** How well a volunteer fits a given shift. `roleInterested` is orthogonal. */
export function fitForShift(av: VolunteerAvailability, shift: ShiftLike): Fit {
  const roleInterested = av.flexibleRole || av.roleKeys.includes(shift.role_key)

  if (av.days.length === 0 && av.parts.length === 0) {
    return { status: "unknown", dayOk: false, timeOk: false, timeKnown: false, roleInterested }
  }

  const dayOk = av.days.includes(shift.day)
  if (!dayOk) {
    return { status: "day", dayOk: false, timeOk: false, timeKnown: av.parts.length > 0, roleInterested }
  }

  const timeKnown = av.parts.length > 0
  const part = dayPartForTime(shift.start_time)
  const timeOk = !timeKnown || av.parts.includes(part)

  return {
    status: timeOk ? "available" : "time",
    dayOk: true,
    timeOk,
    timeKnown,
    roleInterested,
  }
}
