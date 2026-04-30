import type React from "react"

// Consensus tiers across the Talent section. The team is 3 people, so the
// rules are tuned to that scale: a "locked" tier requires 2+ yes votes with
// zero opposition (e.g. 2Y+1M, 3Y, 2Y); a single yes with no opposition is
// "likely"; an all-maybes vote is "maybe"; any mix of yes and no is
// contested ("bubble"). Anything else (e.g. only nos, or some maybes with a
// no but no yes) is null and doesn't appear in the lineup.

export type Tier = "locked" | "likely" | "maybe" | "bubble"

export type Counts = {
  yes_count: number
  no_count: number
  maybe_count: number
  total_judgments: number
}

export const TIER_ORDER: Tier[] = ["locked", "likely", "maybe", "bubble"]

export function classify(c: Counts): Tier | null {
  const { yes_count, no_count, maybe_count } = c
  // Contested wins first — even a majority yes with one no is a bubble.
  if (yes_count > 0 && no_count > 0) return "bubble"
  if (yes_count >= 2 && no_count === 0) return "locked"
  if (yes_count === 1 && no_count === 0) return "likely"
  if (yes_count === 0 && no_count === 0 && maybe_count > 0) return "maybe"
  return null
}

// True when consensus is "team yes" — the badge/filter the dashboard
// surfaces on talent pages.
export function isTeamYes(c: Counts): boolean {
  return classify(c) === "locked"
}

export const TIER_LABEL: Record<Tier, string> = {
  locked: "Team yes",
  likely: "Likely",
  maybe: "Maybe",
  bubble: "Bubble",
}

export const TIER_KICKER: Record<Tier, string> = {
  locked: "Consensus yes",
  likely: "Leaning yes",
  maybe: "Worth a chat",
  bubble: "Contested",
}

export const TIER_BLURB: Record<Tier, string> = {
  locked: "Two or more yes votes and nobody has said no.",
  likely: "One yes, no opposition — needs more eyes.",
  maybe: "Only maybes so far. The team hasn't committed either way.",
  bubble: "At least one yes, but at least one no too. Needs a decision.",
}

// Tailwind tone classes for the tier badge / dot in lists.
export const TIER_TONE: Record<Tier, string> = {
  locked: "bg-emerald-100 text-emerald-900 border-emerald-200/80",
  likely: "bg-sky-100 text-sky-900 border-sky-200/80",
  maybe: "bg-slate-100 text-slate-700 border-slate-200/80",
  bubble: "bg-amber-100 text-amber-900 border-amber-200/80",
}

export const TIER_DOT: Record<Tier, string> = {
  locked: "bg-emerald-500",
  likely: "bg-sky-500",
  maybe: "bg-slate-400",
  bubble: "bg-amber-500",
}

// Numeric rank used for sorting (0 = strongest).
export const TIER_RANK: Record<Tier, number> = {
  locked: 0,
  likely: 1,
  maybe: 2,
  bubble: 3,
}

export type TierMeta = {
  label: string
  kicker: string
  tone: string
  blurb: string
  dot: string
  iconChar: React.ReactNode
}

export const TIER_META: Record<Tier, TierMeta> = {
  locked: {
    label: TIER_LABEL.locked,
    kicker: TIER_KICKER.locked,
    tone: TIER_TONE.locked,
    blurb: TIER_BLURB.locked,
    dot: TIER_DOT.locked,
    iconChar: "✓",
  },
  likely: {
    label: TIER_LABEL.likely,
    kicker: TIER_KICKER.likely,
    tone: TIER_TONE.likely,
    blurb: TIER_BLURB.likely,
    dot: TIER_DOT.likely,
    iconChar: "→",
  },
  maybe: {
    label: TIER_LABEL.maybe,
    kicker: TIER_KICKER.maybe,
    tone: TIER_TONE.maybe,
    blurb: TIER_BLURB.maybe,
    dot: TIER_DOT.maybe,
    iconChar: "?",
  },
  bubble: {
    label: TIER_LABEL.bubble,
    kicker: TIER_KICKER.bubble,
    tone: TIER_TONE.bubble,
    blurb: TIER_BLURB.bubble,
    dot: TIER_DOT.bubble,
    iconChar: "·",
  },
}
