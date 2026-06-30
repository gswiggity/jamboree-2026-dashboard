import type { Database } from "@/lib/database.types"

// First-class act-status pipeline — the spine of post-judging act management.
// team_yes → emailed → accepted | declined | ghosted → programmed.
// Lives on submissions.act_status (only meaningful for type='act'); a null
// status means the act isn't in the pipeline yet. The authoritative transition
// guard is in the DB (set_act_status / clear_act_status, migration 0023); the
// maps below mirror it so the UI only offers legal moves.

export type ActStatus = Database["public"]["Enums"]["act_status"]

// Display order — pipeline left-to-right.
export const ACT_STATUS_ORDER: ActStatus[] = [
  "team_yes",
  "emailed",
  "accepted",
  "declined",
  "ghosted",
  "programmed",
]

export const ACT_STATUS_LABEL: Record<ActStatus, string> = {
  team_yes: "Team yes",
  emailed: "Emailed",
  accepted: "Accepted",
  declined: "Declined",
  ghosted: "Ghosted",
  programmed: "Programmed",
}

// Short verb used on the advance buttons in the control.
export const ACT_STATUS_VERB: Record<ActStatus, string> = {
  team_yes: "Add to pipeline",
  emailed: "Mark emailed",
  accepted: "Mark accepted",
  declined: "Mark declined",
  ghosted: "Mark ghosted",
  programmed: "Mark programmed",
}

// Tailwind tint classes for the pill — same tinted-badge family as the
// consensus-tier badges in lib/lineup-tiers.ts.
export const ACT_STATUS_TONE: Record<ActStatus, string> = {
  team_yes: "bg-emerald-100 text-emerald-900 border-emerald-200/80",
  emailed: "bg-sky-100 text-sky-900 border-sky-200/80",
  accepted: "bg-teal-100 text-teal-900 border-teal-200/80",
  declined: "bg-rose-100 text-rose-900 border-rose-200/80",
  ghosted: "bg-amber-100 text-amber-900 border-amber-200/80",
  programmed: "bg-violet-100 text-violet-900 border-violet-200/80",
}

export const ACT_STATUS_DOT: Record<ActStatus, string> = {
  team_yes: "bg-emerald-500",
  emailed: "bg-sky-500",
  accepted: "bg-teal-500",
  declined: "bg-rose-500",
  ghosted: "bg-amber-500",
  programmed: "bg-violet-500",
}

// Legal forward/sideways transitions per current status. Mirrors the guard in
// set_act_status(). Entering from no status (null) is handled separately.
export const ACT_STATUS_NEXT: Record<ActStatus, ActStatus[]> = {
  team_yes: ["emailed"],
  emailed: ["accepted", "declined", "ghosted"],
  accepted: ["programmed"],
  declined: ["emailed"],
  ghosted: ["accepted", "emailed"],
  programmed: [],
}

// Next statuses available given the current value (null = not in pipeline).
export function nextStatuses(current: ActStatus | null): ActStatus[] {
  if (current === null) return ["team_yes"]
  return ACT_STATUS_NEXT[current]
}

export function isActStatus(v: string | undefined | null): v is ActStatus {
  return (
    v === "team_yes" ||
    v === "emailed" ||
    v === "accepted" ||
    v === "declined" ||
    v === "ghosted" ||
    v === "programmed"
  )
}
