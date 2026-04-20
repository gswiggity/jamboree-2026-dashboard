// Festival phases now live in the `phases` DB table so the team can edit
// them from /settings. This module is just a shared shape + helpers for
// working with a Phase[] that's been fetched server-side.

import type { Tables } from "@/lib/database.types"

export type Phase = Tables<"phases">

export const DEFAULT_PHASE_KEY = "submissions"

/** Look up a single phase by key. */
export function phaseByKey(
  phases: Phase[],
  key: string | null | undefined,
): Phase | null {
  if (!key) return null
  return phases.find((p) => p.key === key) ?? null
}

/**
 * Return the phase that comes after `key` in sort_order, or null if it's
 * the final phase (or not found at all).
 */
export function nextPhase(
  phases: Phase[],
  key: string | null | undefined,
): Phase | null {
  if (!key) return null
  const sorted = [...phases].sort((a, b) => a.sort_order - b.sort_order)
  const idx = sorted.findIndex((p) => p.key === key)
  if (idx < 0 || idx >= sorted.length - 1) return null
  return sorted[idx + 1]
}

/**
 * Pick the phase to show when the DB row is missing the currently-active
 * phase (shouldn't happen given FK, but defensive). Falls back to the first
 * phase by sort_order, then to a minimal placeholder.
 */
export function resolveCurrentPhase(
  phases: Phase[],
  key: string | null | undefined,
): Phase {
  const direct = phaseByKey(phases, key)
  if (direct) return direct
  const sorted = [...phases].sort((a, b) => a.sort_order - b.sort_order)
  if (sorted.length > 0) return sorted[0]
  return {
    key: DEFAULT_PHASE_KEY,
    label: "Submissions open",
    short: "Submissions",
    blurb: "",
    sort_order: 1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
}

/** Normalize a free-text key into a URL-safe slug for new phases. */
export function slugifyPhaseKey(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40)
}
