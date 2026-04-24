// Squarespace's "GroupAct Type" field is a freeform text input, so real-world
// values fragment wildly: "Improv" and "Improv Duo" and "Musical Improv" and
// "Impro" and "Narrative Improv" are all improv, but arrive as distinct
// strings. This module collapses raw values onto a short list of canonical
// genres so the facet picker stays useful. Rule precedence is designed to
// route hybrid descriptors (e.g. "Improv clown magic side show") to their
// most distinctive genre — a clown-improv submission gets bucketed with
// clown acts, where they're otherwise easy to lose.

export type CanonicalActType = {
  key: string // stable id used in URLs and map keys
  label: string // display label shown in the picker
}

const UNSPECIFIED: CanonicalActType = { key: "unspecified", label: "Unspecified" }
const OTHER: CanonicalActType = { key: "other", label: "Other" }

// Order here defines display order when we sort by the canonical key as a
// tiebreaker. The counts from real data drive the primary sort, so this is
// just a secondary stable ordering.
export const CANONICAL_ACT_TYPES: CanonicalActType[] = [
  { key: "improv", label: "Improv" },
  { key: "stand_up", label: "Stand-up" },
  { key: "sketch", label: "Sketch" },
  { key: "clown", label: "Clown" },
  { key: "musical", label: "Musical comedy" },
  { key: "solo_storytelling", label: "Solo / storytelling" },
  { key: "variety", label: "Variety" },
  OTHER,
  UNSPECIFIED,
]

const CANONICAL_ORDER = new Map(
  CANONICAL_ACT_TYPES.map((t, i) => [t.key, i] as const),
)

export function canonicalActType(raw: string | null | undefined): CanonicalActType {
  const trimmed = (raw ?? "").trim()
  if (!trimmed) return UNSPECIFIED
  const s = trimmed.toLowerCase()

  // Clown captures the dedicated clown acts plus the hybrid descriptions
  // that list clown alongside other disciplines — those submissions are
  // usually clown-first. Rule runs before stand-up/improv so "Improv clown
  // magic side show" lands here.
  if (/\bclown\b/.test(s)) return { key: "clown", label: "Clown" }

  // Stand-up normalizes all the hyphen / spacing / capitalization /
  // "standup comedian" / "Stand-up comedy" / "Alt Standup" / "Stand -up"
  // variants. The `[-\s]*` lets weird spacing like "Stand -up" match. Also
  // catches "Stand-up/Musical Comedian" (stand-up primary).
  if (/\bstand[-\s]*up\b/.test(s)) {
    return { key: "stand_up", label: "Stand-up" }
  }

  // Sketch is less noisy but "Sketch / Character" appears once — we fold
  // character-based comedy in alongside sketch since it's closer to sketch
  // than to any other genre in our list.
  if (/\b(sketch|character)\b/.test(s)) return { key: "sketch", label: "Sketch" }

  // Musical comedy catches standalone musical acts. Musical improv is
  // improv-first so we deliberately check improv AFTER this, with musical
  // improv falling through to improv below via the "impro" match.
  if (/\bmusical\b/.test(s) && !/\bimpro/.test(s)) {
    return { key: "musical", label: "Musical comedy" }
  }

  // Improv — the widest bucket. Matches: Improv, Impro, Improv!, Improvised
  // game show, Narrative Improv, Musical Improv, Comedic Improv, Improv Duo,
  // Duo Improv, Improv Trio, Improv clown (already caught by clown above),
  // etc. Prefix match on "impro" keeps this intentionally broad.
  if (/\bimpro/.test(s)) return { key: "improv", label: "Improv" }

  // Solo / storytelling — pulls in the occasional one-person show.
  if (/\b(solo\b.*show|storytell)/.test(s)) {
    return { key: "solo_storytelling", label: "Solo / storytelling" }
  }

  if (/\bvariety\b/.test(s)) return { key: "variety", label: "Variety" }

  return OTHER
}

// Builder that aggregates a list of raw values into canonical-keyed facets
// with counts. Sorted by count desc, then by our canonical display order so
// the picker layout stays predictable across imports.
export function buildCanonicalActFacets(
  values: (string | null | undefined)[],
): { key: string; label: string; count: number; rawExamples: string[] }[] {
  const byKey = new Map<
    string,
    { label: string; count: number; rawExamples: Set<string> }
  >()
  for (const raw of values) {
    const canon = canonicalActType(raw)
    const existing = byKey.get(canon.key) ?? {
      label: canon.label,
      count: 0,
      rawExamples: new Set<string>(),
    }
    existing.count++
    const trimmed = (raw ?? "").trim()
    if (trimmed) existing.rawExamples.add(trimmed)
    byKey.set(canon.key, existing)
  }
  return Array.from(byKey, ([key, v]) => ({
    key,
    label: v.label,
    count: v.count,
    rawExamples: Array.from(v.rawExamples).sort(),
  })).sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count
    const aOrder = CANONICAL_ORDER.get(a.key) ?? 99
    const bOrder = CANONICAL_ORDER.get(b.key) ?? 99
    return aOrder - bOrder
  })
}
