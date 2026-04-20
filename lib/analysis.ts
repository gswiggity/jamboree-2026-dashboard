import type { SubmissionType } from "@/lib/csv"

export type SubmissionRow = {
  id: string
  type: SubmissionType
  name: string | null
  email: string | null
  submitted_at: string | null
  created_at: string
  data: Record<string, unknown>
}

function getString(data: Record<string, unknown>, key: string): string {
  const v = data[key]
  if (v === null || v === undefined) return ""
  return String(v).trim()
}

// --- Act type bucketing ------------------------------------------------------

export type ActTypeBucket =
  | "Improv"
  | "Stand-up"
  | "Sketch/Character"
  | "Clown/Variety"
  | "Solo Show"
  | "Musical"
  | "Other"

export function bucketActType(raw: string): ActTypeBucket {
  const s = raw.toLowerCase()
  if (!s) return "Other"
  if (/solo show|storytelling/.test(s)) return "Solo Show"
  if (/music/.test(s)) return "Musical"
  if (/sketch|character/.test(s)) return "Sketch/Character"
  if (/clown|puppet|sideshow|variety|aerial|magic/.test(s)) return "Clown/Variety"
  if (/impro/.test(s)) return "Improv"
  if (/stand\s*[-]?\s*up|standup/.test(s)) return "Stand-up"
  return "Other"
}

export const ACT_TYPE_ORDER: ActTypeBucket[] = [
  "Improv",
  "Stand-up",
  "Sketch/Character",
  "Clown/Variety",
  "Solo Show",
  "Musical",
  "Other",
]

// --- Group size --------------------------------------------------------------

export type GroupSizeBucket = "Solo" | "Duo" | "Small (3-5)" | "Medium (6-8)" | "Large (9+)"

export const GROUP_SIZE_ORDER: GroupSizeBucket[] = [
  "Solo",
  "Duo",
  "Small (3-5)",
  "Medium (6-8)",
  "Large (9+)",
]

export function countPerformers(raw: string): number {
  if (!raw.trim()) return 0
  // Split on commas and " and " / "&" — Squarespace submissions mix all three.
  const parts = raw
    .split(/,|\s+and\s+|\s*&\s*/i)
    .map((p) => p.trim())
    .filter(Boolean)
  return parts.length
}

export function bucketGroupSize(n: number): GroupSizeBucket {
  if (n <= 1) return "Solo"
  if (n === 2) return "Duo"
  if (n <= 5) return "Small (3-5)"
  if (n <= 8) return "Medium (6-8)"
  return "Large (9+)"
}

// --- Location normalization --------------------------------------------------

export type LocationInfo = {
  raw: string
  city: string | null
  state: string | null
  key: string | null
  display: string | null
  lat: number | null
  lon: number | null
}

// Known cities we care about. Coordinates are approximate city centers.
// Add more as submissions surface new locations.
const CITY_TABLE: Array<{
  match: RegExp
  city: string
  state: string
  lat: number
  lon: number
}> = [
  { match: /philadelph|philly|philadephia|philadelpia/i, city: "Philadelphia", state: "PA", lat: 39.9526, lon: -75.1652 },
  { match: /\bbaltimore\b/i, city: "Baltimore", state: "MD", lat: 39.2904, lon: -76.6122 },
  { match: /new york|nyc|\bny\b|brooklyn|bronx|queens|manhattan/i, city: "New York", state: "NY", lat: 40.7128, lon: -74.006 },
  { match: /hudson valley/i, city: "Hudson Valley", state: "NY", lat: 41.7, lon: -73.9 },
  { match: /\bharrisburg\b/i, city: "Harrisburg", state: "PA", lat: 40.2732, lon: -76.8867 },
  { match: /washington|\bd\.?c\b/i, city: "Washington", state: "DC", lat: 38.9072, lon: -77.0369 },
  { match: /\bchicago\b/i, city: "Chicago", state: "IL", lat: 41.8781, lon: -87.6298 },
  { match: /\baustin\b/i, city: "Austin", state: "TX", lat: 30.2672, lon: -97.7431 },
  { match: /\bhouston\b/i, city: "Houston", state: "TX", lat: 29.7604, lon: -95.3698 },
  { match: /\bdallas\b/i, city: "Dallas", state: "TX", lat: 32.7767, lon: -96.797 },
  { match: /\bphoenix\b/i, city: "Phoenix", state: "AZ", lat: 33.4484, lon: -112.074 },
  { match: /\brichmond\b/i, city: "Richmond", state: "VA", lat: 37.5407, lon: -77.436 },
  { match: /\bfredericksburg\b/i, city: "Fredericksburg", state: "VA", lat: 38.3032, lon: -77.4605 },
  { match: /\bboston\b/i, city: "Boston", state: "MA", lat: 42.3601, lon: -71.0589 },
  { match: /\bpittsburgh\b/i, city: "Pittsburgh", state: "PA", lat: 40.4406, lon: -79.9959 },
  { match: /\blehigh|bethlehem\b/i, city: "Bethlehem", state: "PA", lat: 40.6259, lon: -75.3705 },
  { match: /\bambler\b/i, city: "Ambler", state: "PA", lat: 40.1551, lon: -75.2216 },
  { match: /\bduryea\b/i, city: "Duryea", state: "PA", lat: 41.3398, lon: -75.769 },
  { match: /\bspringfield il/i, city: "Springfield", state: "IL", lat: 39.7817, lon: -89.6501 },
  { match: /\bspokane\b/i, city: "Spokane", state: "WA", lat: 47.6588, lon: -117.426 },
  { match: /\bdetroit\b/i, city: "Detroit", state: "MI", lat: 42.3314, lon: -83.0458 },
  { match: /\bsan diego\b/i, city: "San Diego", state: "CA", lat: 32.7157, lon: -117.1611 },
  { match: /\bprinceton\b/i, city: "Princeton", state: "NJ", lat: 40.3573, lon: -74.6672 },
  { match: /central nj|new jersey|\bnj\b/i, city: "Central NJ", state: "NJ", lat: 40.2206, lon: -74.7597 },
]

export function normalizeLocation(raw: string): LocationInfo {
  const trimmed = raw.trim()
  if (!trimmed) {
    return { raw, city: null, state: null, key: null, display: null, lat: null, lon: null }
  }
  for (const row of CITY_TABLE) {
    if (row.match.test(trimmed)) {
      return {
        raw,
        city: row.city,
        state: row.state,
        key: `${row.city}|${row.state}`,
        display: `${row.city}, ${row.state}`,
        lat: row.lat,
        lon: row.lon,
      }
    }
  }
  return { raw, city: null, state: null, key: null, display: trimmed, lat: null, lon: null }
}

// --- "How did you hear" bucketing --------------------------------------------

export type HowHeardBucket =
  | "Instagram"
  | "Facebook"
  | "Social media (other)"
  | "Word of mouth"
  | "Previous festival"
  | "Festival listings / blogs"
  | "Discord / Email"
  | "Not specified"
  | "Other"

export const HOW_HEARD_ORDER: HowHeardBucket[] = [
  "Instagram",
  "Facebook",
  "Social media (other)",
  "Word of mouth",
  "Previous festival",
  "Festival listings / blogs",
  "Discord / Email",
  "Not specified",
  "Other",
]

export function bucketHowHeard(raw: string): HowHeardBucket {
  const s = raw.toLowerCase().trim()
  if (!s) return "Not specified"
  if (/instagram|insta\b|\big\b/.test(s)) return "Instagram"
  if (/facebook|\bfb\b/.test(s)) return "Facebook"
  if (/tiktok|twitter|social/.test(s)) return "Social media (other)"
  if (/last year|previous|ssicf|camp|jamboree|swear jar/.test(s)) return "Previous festival"
  if (/blog|pod|improv[-\s]festival|radical-elements|insidecomedy|festival/.test(s)) {
    return "Festival listings / blogs"
  }
  if (/discord|email|directly/.test(s)) return "Discord / Email"
  if (/friend|teammate|know|community|scene|being|love|sofia|diego|gabi|cassand/.test(s)) {
    return "Word of mouth"
  }
  return "Other"
}

// --- Availability (acts) -----------------------------------------------------

// Days surfaced in the form. Acts get all four; volunteers get set-up days too.
export const ACT_DAYS = ["Thursday", "Friday", "Saturday", "Sunday"] as const
export type ActDay = (typeof ACT_DAYS)[number]

export function parseActDays(raw: string): ActDay[] {
  if (!raw.trim()) return []
  const s = raw.toLowerCase()
  const days: ActDay[] = []
  if (/thursday|thu\b|thurs/.test(s)) days.push("Thursday")
  if (/friday|fri\b/.test(s)) days.push("Friday")
  if (/saturday|sat\b/.test(s)) days.push("Saturday")
  if (/sunday|sun\b/.test(s)) days.push("Sunday")
  return days
}

// --- Summary types -----------------------------------------------------------

export type BucketCount<T extends string> = { bucket: T; count: number }
export type Point = { date: string; count: number; cumulative: number }

export type ActSummary = {
  total: number
  byType: BucketCount<ActTypeBucket>[]
  byGroupSize: BucketCount<GroupSizeBucket>[]
  byLocation: { key: string; display: string; count: number; lat: number | null; lon: number | null }[]
  unmatchedLocations: { display: string; count: number }[]
  byHowHeard: BucketCount<HowHeardBucket>[]
  byDay: BucketCount<ActDay>[]
  timeline: Point[]
  totalStates: number
  performerCount: number
}

export function summarizeActs(rows: SubmissionRow[]): ActSummary {
  const acts = rows.filter((r) => r.type === "act")

  const typeCounts = new Map<ActTypeBucket, number>()
  const sizeCounts = new Map<GroupSizeBucket, number>()
  const locCounts = new Map<string, { display: string; count: number; lat: number | null; lon: number | null }>()
  const unmatched = new Map<string, number>()
  const heardCounts = new Map<HowHeardBucket, number>()
  const dayCounts = new Map<ActDay, number>()
  const dateCounts = new Map<string, number>()
  const states = new Set<string>()
  let performerCount = 0

  for (const a of acts) {
    const typeBucket = bucketActType(getString(a.data, "GroupAct Type"))
    typeCounts.set(typeBucket, (typeCounts.get(typeBucket) ?? 0) + 1)

    const n = countPerformers(getString(a.data, "Performers"))
    performerCount += n
    const sizeBucket = bucketGroupSize(n)
    sizeCounts.set(sizeBucket, (sizeCounts.get(sizeBucket) ?? 0) + 1)

    const loc = normalizeLocation(getString(a.data, "Location"))
    if (loc.key && loc.display) {
      const existing = locCounts.get(loc.key)
      if (existing) existing.count++
      else locCounts.set(loc.key, { display: loc.display, count: 1, lat: loc.lat, lon: loc.lon })
      if (loc.state) states.add(loc.state)
    } else if (loc.display) {
      unmatched.set(loc.display, (unmatched.get(loc.display) ?? 0) + 1)
    }

    const heard = bucketHowHeard(getString(a.data, "How did you hear about us"))
    heardCounts.set(heard, (heardCounts.get(heard) ?? 0) + 1)

    for (const d of parseActDays(getString(a.data, "Which days would you be available to perform"))) {
      dayCounts.set(d, (dayCounts.get(d) ?? 0) + 1)
    }

    const dateRaw = a.submitted_at ?? a.created_at
    if (dateRaw) {
      const day = new Date(dateRaw).toISOString().slice(0, 10)
      dateCounts.set(day, (dateCounts.get(day) ?? 0) + 1)
    }
  }

  const byType = ACT_TYPE_ORDER.map((b) => ({ bucket: b, count: typeCounts.get(b) ?? 0 })).filter(
    (b) => b.count > 0,
  )
  const byGroupSize = GROUP_SIZE_ORDER.map((b) => ({
    bucket: b,
    count: sizeCounts.get(b) ?? 0,
  }))
  const byLocation = Array.from(locCounts.entries())
    .map(([key, v]) => ({ key, ...v }))
    .sort((a, b) => b.count - a.count)
  const unmatchedLocations = Array.from(unmatched.entries())
    .map(([display, count]) => ({ display, count }))
    .sort((a, b) => b.count - a.count)
  const byHowHeard = HOW_HEARD_ORDER.map((b) => ({ bucket: b, count: heardCounts.get(b) ?? 0 })).filter(
    (b) => b.count > 0,
  )
  const byDay = ACT_DAYS.map((d) => ({ bucket: d, count: dayCounts.get(d) ?? 0 }))

  const sortedDays = Array.from(dateCounts.keys()).sort()
  const timeline: Point[] = []
  let cum = 0
  for (const day of sortedDays) {
    const c = dateCounts.get(day) ?? 0
    cum += c
    timeline.push({ date: day, count: c, cumulative: cum })
  }

  return {
    total: acts.length,
    byType,
    byGroupSize,
    byLocation,
    unmatchedLocations,
    byHowHeard,
    byDay,
    timeline,
    totalStates: states.size,
    performerCount,
  }
}

// --- Volunteer summary -------------------------------------------------------

export type VolunteerSummary = {
  total: number
  byRole: BucketCount<string>[]
  byDay: BucketCount<string>[]
}

export function summarizeVolunteers(rows: SubmissionRow[]): VolunteerSummary {
  const vols = rows.filter((r) => r.type === "volunteer")
  const roleCounts = new Map<string, number>()
  const dayCounts = new Map<string, number>()

  for (const v of vols) {
    const roles = getString(v.data, "Which roles are you interested in")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
    for (const r of roles) roleCounts.set(r, (roleCounts.get(r) ?? 0) + 1)

    const days = getString(v.data, "Which days are you available")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
    for (const d of days) dayCounts.set(d, (dayCounts.get(d) ?? 0) + 1)
  }

  const byRole = Array.from(roleCounts.entries())
    .map(([bucket, count]) => ({ bucket, count }))
    .sort((a, b) => b.count - a.count)
  const byDay = Array.from(dayCounts.entries())
    .map(([bucket, count]) => ({ bucket, count }))
    .sort((a, b) => b.count - a.count)

  return { total: vols.length, byRole, byDay }
}

// --- Workshop summary --------------------------------------------------------

export type WorkshopSummary = {
  total: number
  byTitle: { title: string; count: number }[]
}

export function summarizeWorkshops(rows: SubmissionRow[]): WorkshopSummary {
  const ws = rows.filter((r) => r.type === "workshop")
  const titleCounts = new Map<string, number>()
  for (const w of ws) {
    const t = getString(w.data, "Workshop Title") || w.name || "Untitled"
    titleCounts.set(t, (titleCounts.get(t) ?? 0) + 1)
  }
  return {
    total: ws.length,
    byTitle: Array.from(titleCounts.entries())
      .map(([title, count]) => ({ title, count }))
      .sort((a, b) => b.count - a.count),
  }
}

// --- Overview ----------------------------------------------------------------

export type OverviewTimelinePoint = {
  date: string
  act: number
  volunteer: number
  workshop: number
}

export function overviewTimeline(rows: SubmissionRow[]): OverviewTimelinePoint[] {
  const byDay = new Map<string, OverviewTimelinePoint>()
  for (const r of rows) {
    const raw = r.submitted_at ?? r.created_at
    if (!raw) continue
    const date = new Date(raw).toISOString().slice(0, 10)
    let p = byDay.get(date)
    if (!p) {
      p = { date, act: 0, volunteer: 0, workshop: 0 }
      byDay.set(date, p)
    }
    p[r.type]++
  }
  return Array.from(byDay.values()).sort((a, b) => a.date.localeCompare(b.date))
}
