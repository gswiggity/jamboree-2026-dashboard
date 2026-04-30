import { normalizeName, parsePerformersField } from "./performers"

// "Solo / one-person team" check. An act is solo when nobody besides the
// primary contact is named in the freeform `Performers` field — that's
// either an empty Performers field, or one that only re-mentions the
// primary. We surface the submitter name across the dashboard for these
// acts so they're easy to spot among ensemble submissions.

export type SubmissionLikeForSolo = {
  data: Record<string, unknown> | null
}

function pickString(
  data: Record<string, unknown>,
  keys: string[],
): string | null {
  for (const k of keys) {
    const v = data[k]
    if (typeof v === "string" && v.trim()) return v
  }
  return null
}

export function getActSubmitter(
  s: SubmissionLikeForSolo,
): string | null {
  const data = s.data ?? {}
  return (
    pickString(data, ["Primary Contact 11", "Primary Contact Name"])?.trim() ??
    null
  )
}

export function getActMembers(s: SubmissionLikeForSolo): string[] {
  const data = s.data ?? {}
  const performersRaw = pickString(data, ["Performers"]) ?? ""
  if (!performersRaw) return []
  const primaryName = pickString(data, [
    "Primary Contact 11",
    "Primary Contact Name",
  ]) ?? ""
  const primaryNorm = primaryName ? normalizeName(primaryName) : ""
  const out: string[] = []
  const seen = new Set<string>()
  for (const raw of parsePerformersField(performersRaw)) {
    const norm = normalizeName(raw)
    if (!norm || norm === primaryNorm) continue
    if (seen.has(norm)) continue
    seen.add(norm)
    out.push(raw)
  }
  return out
}

export function isSoloAct(s: SubmissionLikeForSolo): boolean {
  return getActMembers(s).length === 0
}

// Submitters sometimes type their group name as a placeholder when it's a
// solo act — "Self", "Myself", "Solo", "N/A", etc. — which makes the
// dashboard useless for telling acts apart at a glance. We substitute the
// primary contact's name in those cases so list views show a real person
// instead.
//
// The canonicalize step strips parens/brackets, all punctuation, and
// collapses whitespace so variants like "Self.", "(Self)", "self?",
// "Solo Act", and "Just me" all match.
const PLACEHOLDER_ACT_NAMES = new Set([
  "self",
  "myself",
  "me",
  "just me",
  "only me",
  "solo",
  "solo act",
  "solo show",
  "solo performance",
  "one person",
  "one person show",
  "one person team",
  "one man show",
  "one woman show",
  "single",
  "individual",
  "n/a",
  "na",
  "none",
  "no name",
  "untitled",
  "tbd",
  "tba",
  "-",
  "--",
  "---",
  ".",
  "?",
  "x",
])

function canonicalizeActName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    // strip punctuation and brackets so "Self.", "(Self)", "self?" all match.
    .replace(/[^\p{L}\p{N}\s/]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
}

export function isPlaceholderActName(name: string | null | undefined): boolean {
  if (!name) return false
  const canonical = canonicalizeActName(name)
  if (!canonical) return true
  if (PLACEHOLDER_ACT_NAMES.has(canonical)) return true
  // Also catch "n/a"-style with the slash preserved by canonicalize.
  if (canonical === "n a") return true
  return false
}

// What to display where an act's title would normally go. When the group
// name is a placeholder ("Self") or missing, prefer the first name from the
// `Performers` field — that's typically the full first+last, whereas
// "Primary Contact 11" is often just the first name. Falls back to primary
// contact, then email, then a generic label. The second tuple member
// signals whether a substitution happened so callers can attach a tooltip.
export function getActDisplayName(s: {
  name: string | null
  data: Record<string, unknown> | null
  email?: string | null
}): { display: string; substituted: boolean; original: string | null } {
  const original = s.name?.trim() ?? null
  if (original && !isPlaceholderActName(original)) {
    return { display: original, substituted: false, original }
  }
  // Group name is "Self"-style — try the Performers field first since that
  // typically has the full first + last name. parsePerformersField handles
  // splitting on commas / "and" / "&" so a single performer comes back as
  // the only entry in the array.
  const performersRaw = pickString(s.data ?? {}, ["Performers"]) ?? ""
  const memberNames = parsePerformersField(performersRaw)
  const firstMember = memberNames[0]?.trim() ?? ""
  if (firstMember.length > 0) {
    return { display: firstMember, substituted: true, original }
  }
  const submitter = getActSubmitter(s)
  if (submitter && submitter.length > 0) {
    return { display: submitter, substituted: true, original }
  }
  const email = s.email?.trim() ?? null
  if (email) {
    return { display: email, substituted: true, original }
  }
  return {
    display: "Solo performer",
    substituted: true,
    original,
  }
}
