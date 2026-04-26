"use client"

import { useCallback, useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  FlaskConical,
  Grid3x3,
  ListChecks,
  Sparkles,
  Users,
} from "lucide-react"
import {
  type Performer,
  type PerformerAppearance,
} from "@/lib/performers"
import { cn } from "@/lib/utils"
import { saveJudgment } from "../submissions/[id]/actions"
import type { JudgmentRow, VerdictCountRow } from "./performer-list"

type Verdict = "yes" | "no" | "maybe"
type ConsiderKey = "yes" | "yesMaybe"
type ScenarioMode = "list" | "matrix" | "simulator"

const VERDICT_CONFIG: Record<
  Verdict,
  { label: string; chip: string; pillSolid: string; pillSoft: string }
> = {
  yes: {
    label: "Yes",
    chip: "bg-emerald-100 text-emerald-900 border-emerald-200",
    pillSolid: "bg-emerald-600 text-white border-emerald-600",
    pillSoft: "bg-white text-emerald-900 border-emerald-200 hover:bg-emerald-50",
  },
  maybe: {
    label: "Maybe",
    chip: "bg-amber-100 text-amber-900 border-amber-200",
    pillSolid: "bg-amber-500 text-white border-amber-500",
    pillSoft: "bg-white text-amber-900 border-amber-200 hover:bg-amber-50",
  },
  no: {
    label: "No",
    chip: "bg-rose-100 text-rose-900 border-rose-200",
    pillSolid: "bg-rose-600 text-white border-rose-600",
    pillSoft: "bg-white text-rose-900 border-rose-200 hover:bg-rose-50",
  },
}

const MODES: Array<{
  key: ScenarioMode
  label: string
  Icon: typeof Sparkles
  hint: string
}> = [
  {
    key: "list",
    label: "By performer",
    Icon: ListChecks,
    hint: "Group by people who land on multiple acts.",
  },
  {
    key: "matrix",
    label: "Act overlap",
    Icon: Grid3x3,
    hint: "Heatmap of how connected each pair of acts is.",
  },
  {
    key: "simulator",
    label: "Drop simulator",
    Icon: FlaskConical,
    hint: "Rank acts by overlap weight — preview the impact of cutting one.",
  },
]

type ConsideredAct = {
  id: string
  title: string
  submittedAt: string | null
  performerKeys: Set<string>
}

type Stats = {
  acts: number
  distinctPerformers: number
  duplicatedPeople: number
  duplicateSlots: number
}

type Props = {
  performers: Performer[]
  myJudgments: JudgmentRow[]
  verdictCounts: VerdictCountRow[]
}

export function PerformerScenarios({
  performers,
  myJudgments,
  verdictCounts,
}: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [consider, setConsider] = useState<ConsiderKey>("yesMaybe")
  const [mode, setMode] = useState<ScenarioMode>("list")

  // Local mirror so verdict changes feel instant. We re-seed from props on
  // each render via the seedKey trick so router.refresh() pulls in any
  // server-side changes (e.g. another teammate's edit).
  const seedKey = useMemo(
    () =>
      myJudgments
        .map((j) => `${j.submission_id}:${j.verdict ?? ""}`)
        .sort()
        .join("|"),
    [myJudgments],
  )
  const [localVerdicts, setLocalVerdicts] = useState<
    Record<string, Verdict | null>
  >(() => buildVerdictMap(myJudgments))
  const [lastSeed, setLastSeed] = useState(seedKey)
  if (seedKey !== lastSeed) {
    setLocalVerdicts(buildVerdictMap(myJudgments))
    setLastSeed(seedKey)
  }

  const considerSet = useMemo<Verdict[]>(
    () => (consider === "yes" ? ["yes"] : ["yes", "maybe"]),
    [consider],
  )

  const countsMap = useMemo(
    () =>
      new Map(
        verdictCounts
          .filter((c) => c.submission_id !== null)
          .map((c) => [c.submission_id as string, c]),
      ),
    [verdictCounts],
  )

  const performerByKey = useMemo(
    () => new Map(performers.map((p) => [p.key, p])),
    [performers],
  )

  // Acts where the user's verdict is in the consider set, with their
  // aggregated performer keys. The unit of analysis for both the matrix and
  // the simulator.
  const consideredActs = useMemo<ConsideredAct[]>(() => {
    const map = new Map<string, ConsideredAct>()
    for (const p of performers) {
      for (const a of p.appearances) {
        if (a.submissionType !== "act") continue
        const v = localVerdicts[a.submissionId]
        if (v == null || !considerSet.includes(v)) continue
        let entry = map.get(a.submissionId)
        if (!entry) {
          entry = {
            id: a.submissionId,
            title: a.submissionTitle,
            submittedAt: a.submittedAt,
            performerKeys: new Set(),
          }
          map.set(a.submissionId, entry)
        }
        entry.performerKeys.add(p.key)
      }
    }
    return Array.from(map.values()).sort((a, b) =>
      a.title.localeCompare(b.title),
    )
  }, [performers, localVerdicts, considerSet])

  // Pair overlap: for each (A, B) act pair sharing ≥1 performer, the shared
  // performer keys. Stored both directions for easy lookup.
  const actOverlaps = useMemo(() => {
    const out = new Map<string, Map<string, string[]>>()
    for (let i = 0; i < consideredActs.length; i++) {
      for (let j = i + 1; j < consideredActs.length; j++) {
        const a = consideredActs[i]
        const b = consideredActs[j]
        const shared: string[] = []
        for (const k of a.performerKeys) {
          if (b.performerKeys.has(k)) shared.push(k)
        }
        if (shared.length === 0) continue
        if (!out.has(a.id)) out.set(a.id, new Map())
        if (!out.has(b.id)) out.set(b.id, new Map())
        out.get(a.id)!.set(b.id, shared)
        out.get(b.id)!.set(a.id, shared)
      }
    }
    return out
  }, [consideredActs])

  // Conflict load per act: how connected this act is.
  //  - linkedActs: # of distinct other acts sharing at least one performer
  //  - sharedTotal: total shared-performer instances across peer acts
  const conflictLoadByAct = useMemo(() => {
    const out = new Map<
      string,
      { linkedActs: number; sharedTotal: number }
    >()
    for (const a of consideredActs) {
      const peers = actOverlaps.get(a.id)
      if (!peers) {
        out.set(a.id, { linkedActs: 0, sharedTotal: 0 })
        continue
      }
      let total = 0
      for (const shared of peers.values()) total += shared.length
      out.set(a.id, { linkedActs: peers.size, sharedTotal: total })
    }
    return out
  }, [consideredActs, actOverlaps])

  // Performers who land on 2+ considered acts.
  const overlaps = useMemo(() => {
    const out: { performer: Performer; acts: PerformerAppearance[] }[] = []
    for (const p of performers) {
      const acts = p.appearances.filter((a) => {
        if (a.submissionType !== "act") return false
        const v = localVerdicts[a.submissionId]
        return v != null && considerSet.includes(v)
      })
      if (acts.length >= 2) out.push({ performer: p, acts })
    }
    out.sort((a, b) => {
      const d = b.acts.length - a.acts.length
      if (d !== 0) return d
      return a.performer.displayName.localeCompare(b.performer.displayName)
    })
    return out
  }, [performers, localVerdicts, considerSet])

  // Stats — accepts a set of "dropped" act IDs for what-if analysis.
  const computeStats = useCallback(
    (droppedActs: Set<string>): Stats => {
      const performerActCount = new Map<string, number>()
      let acts = 0
      for (const a of consideredActs) {
        if (droppedActs.has(a.id)) continue
        acts++
        for (const k of a.performerKeys) {
          performerActCount.set(k, (performerActCount.get(k) ?? 0) + 1)
        }
      }
      let distinctPerformers = 0
      let duplicatedPeople = 0
      let duplicateSlots = 0
      for (const c of performerActCount.values()) {
        if (c === 0) continue
        distinctPerformers++
        if (c >= 2) {
          duplicatedPeople++
          duplicateSlots += c - 1
        }
      }
      return { acts, distinctPerformers, duplicatedPeople, duplicateSlots }
    },
    [consideredActs],
  )

  const stats = useMemo(() => computeStats(new Set()), [computeStats])

  const setVerdict = useCallback(
    (submissionId: string, verdict: Verdict | null) => {
      const previous = localVerdicts[submissionId] ?? null
      if (previous === verdict) return
      setLocalVerdicts((cur) => ({ ...cur, [submissionId]: verdict }))
      startTransition(async () => {
        const existing = myJudgments.find(
          (j) => j.submission_id === submissionId,
        )
        const notes = existing?.notes ?? ""
        const r = await saveJudgment(submissionId, verdict, notes)
        if (!r.ok) {
          setLocalVerdicts((cur) => ({ ...cur, [submissionId]: previous }))
          toast.error(r.error)
          return
        }
        router.refresh()
      })
    },
    [localVerdicts, myJudgments, router],
  )

  const noOverlaps = overlaps.length === 0
  const activeMode = MODES.find((m) => m.key === mode)!

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-white/70 bg-white/65 backdrop-blur-xl p-5 shadow-[0_8px_28px_-18px_rgba(30,58,138,0.18)] space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] font-semibold text-blue-900">
              <Sparkles className="h-3 w-3" />
              Diversity scenario
            </div>
            <div className="text-xl font-[family-name:var(--font-serif)] text-blue-950 mt-1">
              Spread the lineup
            </div>
            <p className="text-sm text-slate-700 mt-1 max-w-xl">
              See where your current verdicts would land the same person on
              multiple acts. Use the views below to triage — they all share
              the same consider set.
            </p>
          </div>

          <div className="flex items-center gap-1 rounded-full border border-slate-200 bg-white/80 p-0.5">
            {(
              [
                { key: "yes", label: "Yes only" },
                { key: "yesMaybe", label: "Yes + Maybe" },
              ] as const
            ).map((opt) => {
              const active = consider === opt.key
              return (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setConsider(opt.key)}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-xs font-medium transition",
                    active
                      ? "bg-blue-950 text-white"
                      : "text-slate-700 hover:text-slate-950",
                  )}
                >
                  {opt.label}
                </button>
              )
            })}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Stat label="Acts considered" value={stats.acts} />
          <Stat
            label="Distinct performers"
            value={stats.distinctPerformers}
            tone="emerald"
          />
          <Stat
            label="People in 2+ acts"
            value={stats.duplicatedPeople}
            tone={stats.duplicatedPeople > 0 ? "amber" : "neutral"}
          />
          <Stat
            label="Duplicate slots"
            value={stats.duplicateSlots}
            hint={
              stats.duplicateSlots > 0
                ? "Slots you'd reclaim by deduping"
                : undefined
            }
            tone={stats.duplicateSlots > 0 ? "rose" : "neutral"}
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-1">
          <div className="flex items-center gap-1 rounded-full border border-slate-200 bg-white/80 p-0.5">
            {MODES.map(({ key, label, Icon }) => {
              const active = mode === key
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setMode(key)}
                  className={cn(
                    "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition",
                    active
                      ? "bg-blue-950 text-white"
                      : "text-slate-700 hover:text-slate-950",
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </button>
              )
            })}
          </div>
          <p className="text-xs text-slate-500">{activeMode.hint}</p>
        </div>
      </div>

      {noOverlaps ? (
        <EmptyOverlap consider={consider} />
      ) : mode === "list" ? (
        <ByPerformerView
          overlaps={overlaps}
          localVerdicts={localVerdicts}
          countsMap={countsMap}
          conflictLoadByAct={conflictLoadByAct}
          setVerdict={setVerdict}
          pending={pending}
        />
      ) : mode === "matrix" ? (
        <MatrixView
          consideredActs={consideredActs}
          actOverlaps={actOverlaps}
          performerByKey={performerByKey}
        />
      ) : (
        <SimulatorView
          consideredActs={consideredActs}
          conflictLoadByAct={conflictLoadByAct}
          countsMap={countsMap}
          localVerdicts={localVerdicts}
          baseStats={stats}
          computeStats={computeStats}
          setVerdict={setVerdict}
          pending={pending}
        />
      )}
    </div>
  )
}

function buildVerdictMap(
  judgments: JudgmentRow[],
): Record<string, Verdict | null> {
  const out: Record<string, Verdict | null> = {}
  for (const j of judgments) {
    out[j.submission_id] =
      j.verdict === "yes" || j.verdict === "no" || j.verdict === "maybe"
        ? j.verdict
        : null
  }
  return out
}

// ---------- View 1: by performer ----------

function ByPerformerView({
  overlaps,
  localVerdicts,
  countsMap,
  conflictLoadByAct,
  setVerdict,
  pending,
}: {
  overlaps: { performer: Performer; acts: PerformerAppearance[] }[]
  localVerdicts: Record<string, Verdict | null>
  countsMap: Map<string, VerdictCountRow>
  conflictLoadByAct: Map<string, { linkedActs: number; sharedTotal: number }>
  setVerdict: (id: string, v: Verdict | null) => void
  pending: boolean
}) {
  return (
    <ul className="space-y-4">
      {overlaps.map(({ performer, acts }) => (
        <li
          key={performer.key}
          className="rounded-2xl border border-white/70 bg-white/65 backdrop-blur-xl p-5 shadow-[0_4px_16px_-12px_rgba(30,58,138,0.18)]"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <Users className="h-4 w-4 text-blue-900 shrink-0" />
              <div className="font-semibold text-slate-900 truncate">
                {performer.displayName}
              </div>
              {performer.email && (
                <a
                  href={`mailto:${performer.email}`}
                  className="text-xs text-slate-500 truncate hover:underline"
                >
                  {performer.email}
                </a>
              )}
            </div>
            <span className="text-xs text-slate-600 tabular-nums">
              Appears in {acts.length} acts
            </span>
          </div>
          <ul className="mt-3 grid gap-2">
            {acts.map((a) => {
              const v = localVerdicts[a.submissionId] ?? null
              const counts = countsMap.get(a.submissionId)
              const load = conflictLoadByAct.get(a.submissionId)
              return (
                <li
                  key={a.submissionId}
                  className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200/70 bg-white/80 px-3 py-2"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-slate-900 truncate">
                      {a.submissionTitle}
                    </div>
                    <div className="mt-0.5 flex items-center gap-2 flex-wrap text-[11px] text-slate-500">
                      <span>
                        {a.role === "primary"
                          ? "Primary contact"
                          : a.role === "submitter"
                            ? "Submitter"
                            : "Listed performer"}
                      </span>
                      {load && load.linkedActs > 1 && (
                        <span>
                          · linked to {load.linkedActs - 1} other{" "}
                          {load.linkedActs - 1 === 1 ? "act" : "acts"} besides
                          this person
                        </span>
                      )}
                    </div>
                  </div>
                  <TeamPips counts={counts} />
                  <div className="flex items-center gap-1">
                    {(["yes", "maybe", "no"] as const).map((target) => {
                      const isActive = v === target
                      const cfg = VERDICT_CONFIG[target]
                      return (
                        <button
                          key={target}
                          type="button"
                          onClick={() => setVerdict(a.submissionId, target)}
                          disabled={pending}
                          className={cn(
                            "px-2.5 py-1 rounded-full text-[11px] font-semibold border transition",
                            isActive ? cfg.pillSolid : cfg.pillSoft,
                            "disabled:opacity-50",
                          )}
                        >
                          {cfg.label}
                        </button>
                      )
                    })}
                  </div>
                </li>
              )
            })}
          </ul>
        </li>
      ))}
    </ul>
  )
}

// ---------- View 2: act × act matrix ----------

function MatrixView({
  consideredActs,
  actOverlaps,
  performerByKey,
}: {
  consideredActs: ConsideredAct[]
  actOverlaps: Map<string, Map<string, string[]>>
  performerByKey: Map<string, Performer>
}) {
  // Only acts that share ≥1 performer with another considered act —
  // unconnected acts would just be empty rows.
  const matrixActs = useMemo(
    () => consideredActs.filter((a) => actOverlaps.has(a.id)),
    [consideredActs, actOverlaps],
  )

  const [selected, setSelected] = useState<{ a: string; b: string } | null>(
    null,
  )

  const max = useMemo(() => {
    let m = 1
    for (const a of matrixActs) {
      const peers = actOverlaps.get(a.id)
      if (!peers) continue
      for (const shared of peers.values()) {
        if (shared.length > m) m = shared.length
      }
    }
    return m
  }, [matrixActs, actOverlaps])

  if (matrixActs.length < 2) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white/60 p-10 text-center">
        <p className="text-sm text-slate-700">
          No acts share performers in the current consideration set.
        </p>
      </div>
    )
  }

  const sharedDetails = (() => {
    if (!selected) return null
    const a = matrixActs.find((x) => x.id === selected.a)
    const b = matrixActs.find((x) => x.id === selected.b)
    if (!a || !b) return null
    const keys = actOverlaps.get(a.id)?.get(b.id) ?? []
    const performers = keys
      .map((k) => performerByKey.get(k))
      .filter((p): p is Performer => Boolean(p))
    return { a, b, performers }
  })()

  return (
    <div className="rounded-2xl border border-white/70 bg-white/65 backdrop-blur-xl p-5 shadow-[0_8px_28px_-18px_rgba(30,58,138,0.18)] space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm text-slate-700">
          Each cell is the number of performers shared by the two acts. Click
          a coloured cell to see who.
        </p>
        <div className="flex items-center gap-1 text-[10px] text-slate-500">
          <span>fewer</span>
          <span className="h-3 w-4 rounded bg-blue-100" />
          <span className="h-3 w-4 rounded bg-blue-300" />
          <span className="h-3 w-4 rounded bg-blue-500" />
          <span className="h-3 w-4 rounded bg-blue-700" />
          <span>more</span>
        </div>
      </div>

      <div className="overflow-x-auto pb-2">
        <table className="border-separate border-spacing-0">
          <thead>
            <tr>
              <th className="w-48 sticky left-0 z-10 bg-white/65 backdrop-blur-xl"></th>
              {matrixActs.map((a) => (
                <th
                  key={a.id}
                  className="h-32 align-bottom px-0"
                  title={a.title}
                >
                  <div className="origin-bottom-left -rotate-45 translate-y-2 translate-x-3 whitespace-nowrap text-[11px] font-medium text-slate-700">
                    <span className="inline-block max-w-[8.5rem] truncate align-bottom">
                      {a.title}
                    </span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matrixActs.map((row) => (
              <tr key={row.id}>
                <th
                  scope="row"
                  className="sticky left-0 z-10 bg-white/65 backdrop-blur-xl pr-3 py-1 text-right text-[11px] font-medium text-slate-700 max-w-[12rem]"
                  title={row.title}
                >
                  <span className="block truncate max-w-[12rem]">
                    {row.title}
                  </span>
                </th>
                {matrixActs.map((col) => {
                  const isSelf = row.id === col.id
                  const shared = actOverlaps.get(row.id)?.get(col.id) ?? []
                  const count = shared.length
                  const isSelected =
                    selected != null &&
                    ((selected.a === row.id && selected.b === col.id) ||
                      (selected.a === col.id && selected.b === row.id))
                  return (
                    <td key={col.id} className="p-0.5">
                      <button
                        type="button"
                        disabled={isSelf || count === 0}
                        onClick={() => setSelected({ a: row.id, b: col.id })}
                        className={cn(
                          "h-7 w-7 rounded text-[10px] font-semibold tabular-nums border",
                          isSelf
                            ? "bg-slate-100 border-slate-200 text-slate-300 cursor-default"
                            : count === 0
                              ? "bg-white border-slate-200 text-slate-300 cursor-default"
                              : cn(
                                  intensityClass(count, max),
                                  "border-blue-900/10 hover:ring-2 hover:ring-blue-300",
                                ),
                          isSelected ? "ring-2 ring-blue-500" : "",
                        )}
                        title={
                          isSelf
                            ? row.title
                            : count === 0
                              ? `${row.title} ↔ ${col.title}: no overlap`
                              : `${row.title} ↔ ${col.title}: ${count} shared`
                        }
                      >
                        {isSelf ? "—" : count > 0 ? count : ""}
                      </button>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {sharedDetails ? (
        <div className="rounded-xl border border-blue-200/70 bg-blue-50/60 p-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <div className="text-[11px] uppercase tracking-[0.22em] font-semibold text-blue-900">
                Shared performers
              </div>
              <div className="mt-1 text-sm font-medium text-slate-900">
                {sharedDetails.a.title}{" "}
                <span className="text-slate-400">↔</span>{" "}
                {sharedDetails.b.title}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setSelected(null)}
              className="text-xs text-slate-500 hover:text-slate-900 underline-offset-2 hover:underline"
            >
              clear
            </button>
          </div>
          <ul className="mt-3 flex flex-wrap gap-1.5">
            {sharedDetails.performers.map((p) => (
              <li
                key={p.key}
                className="inline-flex items-center gap-1.5 rounded-full bg-white border border-slate-200 px-2 py-0.5 text-[11px] text-slate-700"
              >
                <Users className="h-3 w-3 text-blue-700" />
                <span>{p.displayName}</span>
                {p.email && (
                  <span className="text-slate-400">· {p.email}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="text-xs text-slate-500">
          Click any coloured cell to inspect the shared performers.
        </div>
      )}
    </div>
  )
}

function intensityClass(count: number, max: number): string {
  const ratio = max <= 0 ? 0 : count / max
  if (ratio >= 0.75) return "bg-blue-700 text-white"
  if (ratio >= 0.5) return "bg-blue-500 text-white"
  if (ratio >= 0.25) return "bg-blue-300 text-blue-950"
  return "bg-blue-100 text-blue-950"
}

// ---------- View 3: drop simulator ----------

function SimulatorView({
  consideredActs,
  conflictLoadByAct,
  countsMap,
  localVerdicts,
  baseStats,
  computeStats,
  setVerdict,
  pending,
}: {
  consideredActs: ConsideredAct[]
  conflictLoadByAct: Map<string, { linkedActs: number; sharedTotal: number }>
  countsMap: Map<string, VerdictCountRow>
  localVerdicts: Record<string, Verdict | null>
  baseStats: Stats
  computeStats: (dropped: Set<string>) => Stats
  setVerdict: (id: string, v: Verdict | null) => void
  pending: boolean
}) {
  const ranked = useMemo(() => {
    const rows = consideredActs
      .map((a) => {
        const load = conflictLoadByAct.get(a.id) ?? {
          linkedActs: 0,
          sharedTotal: 0,
        }
        return { act: a, load }
      })
      .filter((r) => r.load.linkedActs > 0)
    rows.sort((a, b) => {
      const d = b.load.sharedTotal - a.load.sharedTotal
      if (d !== 0) return d
      return a.act.title.localeCompare(b.act.title)
    })
    return rows
  }, [consideredActs, conflictLoadByAct])

  const deltas = useMemo(() => {
    const out = new Map<string, Stats>()
    for (const { act } of ranked) {
      const after = computeStats(new Set([act.id]))
      out.set(act.id, {
        acts: after.acts - baseStats.acts,
        distinctPerformers:
          after.distinctPerformers - baseStats.distinctPerformers,
        duplicatedPeople: after.duplicatedPeople - baseStats.duplicatedPeople,
        duplicateSlots: after.duplicateSlots - baseStats.duplicateSlots,
      })
    }
    return out
  }, [ranked, computeStats, baseStats])

  if (ranked.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white/60 p-10 text-center">
        <p className="text-sm text-slate-700">
          No connected acts — every considered act has an independent cast.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-white/70 bg-white/65 backdrop-blur-xl p-4 shadow-[0_4px_16px_-12px_rgba(30,58,138,0.18)] text-sm text-slate-700">
        Each row shows the impact of dropping that act (your verdict becomes{" "}
        <span className="font-semibold">No</span>). Sorted by overlap weight —
        heaviest first, so the easiest cuts surface up top.
      </div>
      <ul className="space-y-2">
        {ranked.map(({ act, load }) => {
          const v = localVerdicts[act.id] ?? null
          const counts = countsMap.get(act.id)
          const delta = deltas.get(act.id)
          return (
            <li
              key={act.id}
              className="rounded-xl border border-white/70 bg-white/65 backdrop-blur-xl p-4 shadow-[0_4px_16px_-12px_rgba(30,58,138,0.18)]"
            >
              <div className="flex flex-wrap items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-slate-900 truncate">
                    {act.title}
                  </div>
                  <div className="mt-0.5 text-[11px] text-slate-600">
                    Linked to {load.linkedActs} other{" "}
                    {load.linkedActs === 1 ? "act" : "acts"} via{" "}
                    {load.sharedTotal} shared{" "}
                    {load.sharedTotal === 1 ? "performer" : "performers"}
                  </div>
                </div>
                <TeamPips counts={counts} />
                {v && (
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold",
                      VERDICT_CONFIG[v].chip,
                    )}
                  >
                    {VERDICT_CONFIG[v].label}
                  </span>
                )}
                <button
                  type="button"
                  disabled={pending || v === "no"}
                  onClick={() => setVerdict(act.id, "no")}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-semibold transition",
                    v === "no"
                      ? "border-rose-200 bg-rose-100 text-rose-900 cursor-default"
                      : "border-rose-200 bg-white text-rose-900 hover:bg-rose-50",
                    "disabled:opacity-50",
                  )}
                >
                  Set No
                </button>
              </div>
              {delta && (
                <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                  <DeltaStat label="Acts considered" delta={delta.acts} />
                  <DeltaStat
                    label="Distinct performers"
                    delta={delta.distinctPerformers}
                    tone={delta.distinctPerformers < 0 ? "amber" : "neutral"}
                  />
                  <DeltaStat
                    label="People in 2+ acts"
                    delta={delta.duplicatedPeople}
                    tone={delta.duplicatedPeople < 0 ? "emerald" : "neutral"}
                  />
                  <DeltaStat
                    label="Duplicate slots"
                    delta={delta.duplicateSlots}
                    tone={delta.duplicateSlots < 0 ? "emerald" : "neutral"}
                  />
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function DeltaStat({
  label,
  delta,
  tone = "neutral",
}: {
  label: string
  delta: number
  tone?: "neutral" | "emerald" | "amber" | "rose"
}) {
  const sign = delta > 0 ? "+" : ""
  const tones = {
    neutral: "text-slate-700",
    emerald: "text-emerald-700",
    amber: "text-amber-700",
    rose: "text-rose-700",
  }
  return (
    <div className="rounded-md border border-slate-200/70 bg-white/80 px-2 py-1.5">
      <div className="text-[9px] uppercase tracking-[0.2em] font-semibold text-slate-500">
        {label}
      </div>
      <div className={cn("text-sm font-semibold tabular-nums", tones[tone])}>
        {delta === 0 ? "0" : `${sign}${delta}`}
      </div>
    </div>
  )
}

// ---------- shared bits ----------

function TeamPips({ counts }: { counts: VerdictCountRow | undefined }) {
  if (!counts || (counts.total_judgments ?? 0) === 0) {
    return (
      <span className="hidden md:inline text-[11px] text-slate-400 italic whitespace-nowrap">
        no team votes
      </span>
    )
  }
  const yes = counts.yes_count ?? 0
  const maybe = counts.maybe_count ?? 0
  const no = counts.no_count ?? 0
  const pip = "h-2 w-2 rounded-full"
  return (
    <div
      className="hidden md:flex items-center gap-0.5"
      title={`${yes} yes · ${maybe} maybe · ${no} no`}
    >
      {Array.from({ length: yes }).map((_, i) => (
        <span key={`y${i}`} className={cn(pip, "bg-emerald-500")} />
      ))}
      {Array.from({ length: maybe }).map((_, i) => (
        <span key={`m${i}`} className={cn(pip, "bg-amber-400")} />
      ))}
      {Array.from({ length: no }).map((_, i) => (
        <span key={`n${i}`} className={cn(pip, "bg-rose-400")} />
      ))}
    </div>
  )
}

function EmptyOverlap({ consider }: { consider: ConsiderKey }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white/60 p-10 text-center">
      <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
        <Sparkles className="h-4 w-4" />
      </div>
      <p className="text-sm text-slate-700">
        No overlap among your{" "}
        {consider === "yes" ? "Yes" : "Yes + Maybe"} acts. The lineup is
        spread evenly.
      </p>
    </div>
  )
}

function Stat({
  label,
  value,
  hint,
  tone = "neutral",
}: {
  label: string
  value: number
  hint?: string
  tone?: "neutral" | "emerald" | "amber" | "rose"
}) {
  const tones: Record<string, string> = {
    neutral: "text-slate-900",
    emerald: "text-emerald-700",
    amber: "text-amber-700",
    rose: "text-rose-700",
  }
  return (
    <div className="rounded-xl border border-slate-200/70 bg-white/80 px-3 py-2.5">
      <div className="text-[10px] uppercase tracking-[0.22em] font-semibold text-slate-500">
        {label}
      </div>
      <div className={cn("text-2xl font-semibold tabular-nums mt-0.5", tones[tone])}>
        {value.toLocaleString()}
      </div>
      {hint && <div className="text-[10px] text-slate-500 mt-0.5">{hint}</div>}
    </div>
  )
}
