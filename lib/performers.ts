import type { SubmissionType } from "./csv"

// A "performer" here is any person surfaced across act + workshop
// submissions — primary contacts, workshop submitters, and the freeform
// teammates listed in an act's `Performers` jsonb field. We aggregate by
// email when we have one and fall back to a normalized-name key for
// teammates who only appear as text on someone else's submission.

export type SubmissionLite = {
  id: string
  type: SubmissionType
  name: string | null // Group Name for acts, Workshop Title for workshops, Name for volunteer
  email: string | null // primary contact email for acts, submitter email for workshops
  submitted_at: string | null
  data: Record<string, unknown> | null
}

export type PerformerAppearance = {
  submissionId: string
  submissionType: "act" | "workshop"
  submissionTitle: string // group name or workshop title (with "Self" placeholders substituted)
  // The literal group name as submitted, when it differs from the displayed
  // title — e.g. "Self". Useful for tooltips / "listed as" chips. Null when
  // no substitution happened.
  originalTitle: string | null
  submittedAt: string | null
  // How this person is attached to the submission.
  //  - "primary"   → they're the primary contact on an act
  //  - "member"    → they're named in the Performers text field of an act
  //  - "submitter" → they submitted a workshop
  role: "primary" | "member" | "submitter"
  // Primary contact name on the act — used to surface "Solo · <name>" chips
  // when the act is a one-person team. Always set for acts; null for
  // workshops where it doesn't apply.
  submitterName: string | null
  // True for acts where nobody besides the primary contact is named in
  // the Performers field. Workshops are always false.
  isSolo: boolean
}

export type Performer = {
  key: string // stable id for the aggregated performer: "email:..." or "name:..."
  displayName: string
  email: string | null
  normalizedName: string
  appearances: PerformerAppearance[]
  // Convenience counts.
  actCount: number
  workshopCount: number
}

// Normalize a human name for equality matching. Collapses whitespace,
// strips punctuation and accents, lowercases.
export function normalizeName(raw: string): string {
  return raw
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "") // strip accents
    .toLowerCase()
    .replace(/[.,'"`’]/g, "")
    .replace(/\s+/g, " ")
    .trim()
}

// Split the Squarespace freeform "Performers" field into individual names.
// The field is authored by submitters so shapes vary. Common patterns:
//   "Maria Geary"
//   "Amy Stewart and Kristin Elliott"
//   "Shane Burt, Sebastian Cocchi, Jordan Coleman, and Chris Davis"
//   "A / B / C"
// This is intentionally conservative: we split on commas, slashes, ampersands,
// newlines, and the word "and" / "&", drop bracketed parentheticals (e.g.
// "(she/her)"), and toss empties.
export function parsePerformersField(raw: string): string[] {
  if (!raw) return []
  const cleaned = raw
    // Drop parentheticals like "(she/her)" or "(director)" — noise.
    .replace(/\([^)]*\)/g, " ")
    // Turn " and " / " & " / slashes / semicolons / newlines into commas so
    // a single split below catches them all.
    .replace(/\s+&\s+/gi, ", ")
    .replace(/\s+and\s+/gi, ", ")
    .replace(/[\n;\/]/g, ", ")
  return cleaned
    .split(",")
    .map((s) => s.trim())
    .filter((s) => {
      if (!s) return false
      // A valid name needs at least one letter. Prevents stray dates or
      // numbers that sometimes land in this field from becoming "people".
      if (!/[A-Za-z]/.test(s)) return false
      // Cap at ~60 chars so runaway bio text doesn't become a name.
      if (s.length > 60) return false
      return true
    })
}

// Given the list of submissions, produce one Performer entry per distinct
// person. Key rules:
//   - Anyone with an email (primary contact / workshop submitter) gets
//     `email:<lowercase-email>`.
//   - Teammates mentioned only by name get `name:<normalized-name>`.
//   - When we encounter a teammate name that exactly matches the name on an
//     email-keyed performer we've already seen, we merge the appearance
//     into that performer rather than creating a duplicate name-only record.
export function aggregatePerformers(subs: SubmissionLite[]): Performer[] {
  const byKey = new Map<string, Performer>()
  // Index so we can collapse name-only matches into an email-keyed entry.
  const emailByNormalizedName = new Map<string, string>()

  const upsert = (
    key: string,
    seed: () => Omit<Performer, "appearances" | "actCount" | "workshopCount">,
    appearance: PerformerAppearance,
  ) => {
    const existing = byKey.get(key)
    if (existing) {
      existing.appearances.push(appearance)
      if (appearance.submissionType === "act") existing.actCount++
      else existing.workshopCount++
      return existing
    }
    const base = seed()
    const p: Performer = {
      ...base,
      appearances: [appearance],
      actCount: appearance.submissionType === "act" ? 1 : 0,
      workshopCount: appearance.submissionType === "workshop" ? 1 : 0,
    }
    byKey.set(key, p)
    if (p.email) emailByNormalizedName.set(p.normalizedName, key)
    return p
  }

  // Pass 1: anyone with an email (primary act contact, workshop submitter).
  // Doing emails first lets pass 2 collapse teammate-by-name into the right
  // email-keyed record when there's a match.
  for (const s of subs) {
    if (s.type !== "act" && s.type !== "workshop") continue
    const email = s.email?.trim().toLowerCase() || null
    const data = s.data ?? {}
    const rawTitle = (s.name ?? "").trim()

    if (s.type === "workshop" && email) {
      const nameRaw = pickString(data, ["Name"]) ?? ""
      const displayName = nameRaw.trim() || email
      const key = `email:${email}`
      upsert(
        key,
        () => ({
          key,
          displayName,
          email,
          normalizedName: normalizeName(displayName),
        }),
        {
          submissionId: s.id,
          submissionType: "workshop",
          submissionTitle: rawTitle || "(untitled)",
          originalTitle: null,
          submittedAt: s.submitted_at,
          role: "submitter",
          submitterName: null,
          isSolo: false,
        },
      )
    }

    if (s.type === "act" && email) {
      const primaryName =
        pickString(data, ["Primary Contact 11", "Primary Contact Name"]) ?? ""
      const displayName = primaryName.trim() || email
      const key = `email:${email}`
      const memberCount = countActMembers(data, primaryName)
      // Substitute "Self"-style placeholders with a real identifier. Prefer
      // the first name from the Performers field (it usually has the full
      // first + last), fall back to primary contact, then email, then a
      // generic label.
      const titleSubstituted =
        !rawTitle || isPlaceholderActTitle(rawTitle)
      const titleFirstMember = parsePerformersField(
        pickString(data, ["Performers"]) ?? "",
      )[0]?.trim() ?? ""
      const actTitle = titleSubstituted
        ? titleFirstMember || primaryName.trim() || email || "Solo performer"
        : rawTitle
      upsert(
        key,
        () => ({
          key,
          displayName,
          email,
          normalizedName: normalizeName(displayName),
        }),
        {
          submissionId: s.id,
          submissionType: "act",
          submissionTitle: actTitle,
          originalTitle: titleSubstituted && rawTitle ? rawTitle : null,
          submittedAt: s.submitted_at,
          role: "primary",
          submitterName: primaryName.trim() || null,
          isSolo: memberCount === 0,
        },
      )
    }
  }

  // Pass 2: teammates from the Performers freeform field on act submissions.
  for (const s of subs) {
    if (s.type !== "act") continue
    const data = s.data ?? {}
    const performersRaw = pickString(data, ["Performers"]) ?? ""
    if (!performersRaw) continue
    const primaryName = pickString(data, ["Primary Contact 11", "Primary Contact Name"]) ?? ""
    const primaryNorm = primaryName ? normalizeName(primaryName) : ""
    const rawTitle = (s.name ?? "").trim()
    const titleSubstituted = !rawTitle || isPlaceholderActTitle(rawTitle)
    const titleEmail = s.email?.trim() ?? ""
    const names = parsePerformersField(performersRaw)
    // First entry of `names` is typically the full first + last name when
    // the act is solo, so prefer it over the partial primary contact name.
    const titleFirstMember = names[0]?.trim() ?? ""
    const title = titleSubstituted
      ? titleFirstMember || primaryName.trim() || titleEmail || "Solo performer"
      : rawTitle
    const originalTitle = titleSubstituted && rawTitle ? rawTitle : null

    const seenOnThisSub = new Set<string>()
    for (const rawName of names) {
      const norm = normalizeName(rawName)
      if (!norm) continue
      // Skip the primary — they're already in this submission via pass 1.
      if (norm === primaryNorm) continue
      // Dedupe within a single submission (e.g. "Ana Ana Ana").
      if (seenOnThisSub.has(norm)) continue
      seenOnThisSub.add(norm)

      // If we already have an email-keyed performer whose name matches, hang
      // this appearance on them rather than creating a name-only ghost.
      const mergedEmailKey = emailByNormalizedName.get(norm)
      const key = mergedEmailKey ?? `name:${norm}`
      upsert(
        key,
        () => ({
          key,
          displayName: rawName,
          email: null,
          normalizedName: norm,
        }),
        {
          submissionId: s.id,
          submissionType: "act",
          submissionTitle: title,
          originalTitle,
          submittedAt: s.submitted_at,
          role: "member",
          submitterName: primaryName.trim() || null,
          // A "member" appearance proves the act has at least one teammate
          // beyond the primary, so it's never solo.
          isSolo: false,
        },
      )
    }
  }

  return Array.from(byKey.values())
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

// Mirror of isPlaceholderActName in solo-act.ts. Duplicated here to avoid a
// circular import (solo-act already depends on this module). Keep the two
// in sync if either set changes.
const PLACEHOLDER_TITLES = new Set([
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
function isPlaceholderActTitle(name: string): boolean {
  const canonical = name
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s/]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
  if (!canonical) return true
  if (PLACEHOLDER_TITLES.has(canonical)) return true
  if (canonical === "n a") return true
  return false
}

// Count distinct teammates listed on an act, excluding the primary contact.
// Zero means a solo act.
function countActMembers(
  data: Record<string, unknown>,
  primaryName: string,
): number {
  const performersRaw = pickString(data, ["Performers"]) ?? ""
  if (!performersRaw) return 0
  const primaryNorm = primaryName ? normalizeName(primaryName) : ""
  const seen = new Set<string>()
  for (const raw of parsePerformersField(performersRaw)) {
    const norm = normalizeName(raw)
    if (!norm || norm === primaryNorm) continue
    seen.add(norm)
  }
  return seen.size
}

export type PerformerSortKey = "submissions" | "name"

export function sortPerformers(
  performers: Performer[],
  sort: PerformerSortKey,
): Performer[] {
  const copy = [...performers]
  if (sort === "submissions") {
    copy.sort((a, b) => {
      const aTotal = a.appearances.length
      const bTotal = b.appearances.length
      if (aTotal !== bTotal) return bTotal - aTotal
      return a.displayName.localeCompare(b.displayName)
    })
  } else {
    copy.sort((a, b) => a.displayName.localeCompare(b.displayName))
  }
  return copy
}

export type PerformerFilterKey =
  | "all"
  | "team_yes" // at least one appearance with locked-tier team consensus
  | "cross" // at least one act AND at least one workshop
  | "multiAct" // 2+ act appearances
  | "workshopsOnly"
  | "actsOnly"

export function applyPerformerFilter(
  performers: Performer[],
  filter: PerformerFilterKey,
  // Set of submission IDs the team has reached "locked" consensus on.
  // Required for the team_yes filter; ignored otherwise.
  teamYesSubmissionIds?: Set<string>,
): Performer[] {
  switch (filter) {
    case "team_yes": {
      const yesSet = teamYesSubmissionIds ?? new Set<string>()
      return performers.filter((p) =>
        p.appearances.some((a) => yesSet.has(a.submissionId)),
      )
    }
    case "cross":
      return performers.filter((p) => p.actCount > 0 && p.workshopCount > 0)
    case "multiAct":
      return performers.filter((p) => p.actCount >= 2)
    case "workshopsOnly":
      return performers.filter((p) => p.workshopCount > 0 && p.actCount === 0)
    case "actsOnly":
      return performers.filter((p) => p.actCount > 0 && p.workshopCount === 0)
    default:
      return performers
  }
}

export function filterPerformersByQuery(
  performers: Performer[],
  q: string,
): Performer[] {
  const needle = q.trim().toLowerCase()
  if (!needle) return performers
  return performers.filter((p) => {
    if (p.displayName.toLowerCase().includes(needle)) return true
    if (p.email && p.email.toLowerCase().includes(needle)) return true
    // Let the user search by a submission title they're attached to.
    return p.appearances.some((a) =>
      a.submissionTitle.toLowerCase().includes(needle),
    )
  })
}
