"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { ChevronRight, Mail, Search, Sparkles, Users } from "lucide-react"
import {
  applyPerformerFilter,
  filterPerformersByQuery,
  sortPerformers,
  type Performer,
  type PerformerFilterKey,
  type PerformerSortKey,
} from "@/lib/performers"
import { cn } from "@/lib/utils"
import { PerformerScenarios } from "./performer-scenarios"

export type JudgmentRow = {
  submission_id: string
  verdict: string | null
  notes: string | null
}

export type VerdictCountRow = {
  submission_id: string | null
  yes_count: number | null
  no_count: number | null
  maybe_count: number | null
  total_judgments: number | null
}

const VERDICT_PILL: Record<string, string> = {
  yes: "bg-emerald-100 text-emerald-900 border-emerald-200/80",
  no: "bg-rose-100 text-rose-900 border-rose-200/80",
  maybe: "bg-amber-100 text-amber-900 border-amber-200/80",
}

const VERDICT_LABEL: Record<string, string> = {
  yes: "Yes",
  maybe: "Maybe",
  no: "No",
}

const FILTERS: Array<{ key: PerformerFilterKey; label: string }> = [
  { key: "all", label: "All" },
  { key: "cross", label: "Cross-submitter" },
  { key: "multiAct", label: "On multiple acts" },
  { key: "actsOnly", label: "Acts only" },
  { key: "workshopsOnly", label: "Workshops only" },
]

const SORTS: Array<{ key: PerformerSortKey; label: string }> = [
  { key: "submissions", label: "Most submissions" },
  { key: "name", label: "Alphabetical" },
]

export function PerformerList({
  performers,
  myJudgments,
  verdictCounts,
}: {
  performers: Performer[]
  myJudgments: JudgmentRow[]
  verdictCounts: VerdictCountRow[]
}) {
  const [view, setView] = useState<"directory" | "scenarios">("directory")
  const [q, setQ] = useState("")
  const [filter, setFilter] = useState<PerformerFilterKey>("all")
  const [sort, setSort] = useState<PerformerSortKey>("submissions")

  const myMap = useMemo(
    () =>
      new Map(
        myJudgments.map((j) => [
          j.submission_id,
          { verdict: j.verdict, notes: j.notes },
        ]),
      ),
    [myJudgments],
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

  // Filter counts (for the chip numbers) — always computed off the unfiltered
  // list, not the post-search list, so the numbers stay stable as you type.
  const filterCounts = useMemo(() => {
    const out: Record<PerformerFilterKey, number> = {
      all: performers.length,
      cross: 0,
      multiAct: 0,
      workshopsOnly: 0,
      actsOnly: 0,
    }
    for (const p of performers) {
      if (p.actCount > 0 && p.workshopCount > 0) out.cross++
      if (p.actCount >= 2) out.multiAct++
      if (p.workshopCount > 0 && p.actCount === 0) out.workshopsOnly++
      if (p.actCount > 0 && p.workshopCount === 0) out.actsOnly++
    }
    return out
  }, [performers])

  const visible = useMemo(() => {
    const filtered = applyPerformerFilter(performers, filter)
    const searched = filterPerformersByQuery(filtered, q)
    return sortPerformers(searched, sort)
  }, [performers, filter, sort, q])

  // Roll up a quick top-line count: how many total submissions are covered
  // by the currently-visible people.
  const summary = useMemo(() => {
    let acts = 0
    let workshops = 0
    for (const p of visible) {
      acts += p.actCount
      workshops += p.workshopCount
    }
    return { people: visible.length, acts, workshops }
  }, [visible])

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-[11px] uppercase tracking-[0.3em] font-semibold text-blue-900 mb-2">
            Talent
          </div>
          <h1 className="font-[family-name:var(--font-serif)] text-5xl text-blue-950 leading-none">
            Performers <span className="italic text-[#2340d9]">directory</span>
          </h1>
          <p className="text-sm text-slate-700 mt-3 max-w-xl">
            One row per person, pulled from act primary contacts, act
            teammates, and workshop submitters. Click a submission to jump
            into its full detail and your notes.
          </p>
        </div>
        <div className="text-right text-xs text-slate-600">
          <div className="tabular-nums">
            <span className="font-semibold text-slate-900">
              {performers.length.toLocaleString()}
            </span>{" "}
            distinct performers
          </div>
          <div className="tabular-nums mt-0.5 text-slate-500">
            across {performers.reduce((n, p) => n + p.actCount, 0)} act entries
            {" · "}
            {performers.reduce((n, p) => n + p.workshopCount, 0)} workshop entries
          </div>
        </div>
      </div>

      {/* VIEW TOGGLE */}
      <div className="flex items-center gap-1 rounded-full border border-white/70 bg-white/65 backdrop-blur-xl p-1 w-fit shadow-[0_4px_16px_-12px_rgba(30,58,138,0.18)]">
        <button
          type="button"
          onClick={() => setView("directory")}
          className={cn(
            "inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-medium transition",
            view === "directory"
              ? "bg-blue-950 text-white"
              : "text-slate-700 hover:text-slate-950 hover:bg-slate-100/70",
          )}
        >
          <Users className="h-3.5 w-3.5" />
          Directory
        </button>
        <button
          type="button"
          onClick={() => setView("scenarios")}
          className={cn(
            "inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-medium transition",
            view === "scenarios"
              ? "bg-blue-950 text-white"
              : "text-slate-700 hover:text-slate-950 hover:bg-slate-100/70",
          )}
        >
          <Sparkles className="h-3.5 w-3.5" />
          Scenarios
        </button>
      </div>

      {view === "scenarios" && (
        <PerformerScenarios
          performers={performers}
          myJudgments={myJudgments}
          verdictCounts={verdictCounts}
        />
      )}

      {view === "directory" && (
        <>

      {/* CONTROL PANEL */}
      <div className="rounded-2xl border border-white/70 bg-white/65 backdrop-blur-xl shadow-[0_8px_28px_-18px_rgba(30,58,138,0.18)] overflow-hidden">
        {/* Search row */}
        <div className="flex items-center gap-2 px-4 py-3">
          <span className="text-[10px] uppercase tracking-[0.22em] font-semibold text-slate-500 mr-2 w-12 shrink-0">
            Find
          </span>
          <div className="relative flex-1 max-w-lg">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by name, email, or act/workshop title…"
              className="w-full pl-9 pr-3 py-2 text-sm rounded-full border border-slate-200/80 bg-white/80 placeholder:text-slate-400 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition"
            />
          </div>
        </div>

        {/* Filter row */}
        <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-t border-slate-200/60 bg-slate-50/40">
          <span className="text-[10px] uppercase tracking-[0.22em] font-semibold text-slate-500 mr-2 w-12 shrink-0">
            Filter
          </span>
          {FILTERS.map((f) => {
            const active = filter === f.key
            const count = filterCounts[f.key]
            return (
              <button
                key={f.key}
                type="button"
                onClick={() => setFilter(f.key)}
                className={cn(
                  "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition",
                  active
                    ? "bg-blue-950 text-white"
                    : "text-slate-700 hover:text-slate-950 hover:bg-slate-100/70",
                )}
              >
                {f.label}
                <span
                  className={cn(
                    "tabular-nums text-xs",
                    active ? "text-white/70" : "text-slate-500",
                  )}
                >
                  {count}
                </span>
              </button>
            )
          })}
        </div>

        {/* Sort row */}
        <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-t border-slate-200/60">
          <span className="text-[10px] uppercase tracking-[0.22em] font-semibold text-slate-500 mr-2 w-12 shrink-0">
            Sort
          </span>
          {SORTS.map((s) => {
            const active = sort === s.key
            return (
              <button
                key={s.key}
                type="button"
                onClick={() => setSort(s.key)}
                className={cn(
                  "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition",
                  active
                    ? "bg-blue-950 text-white"
                    : "text-slate-700 hover:text-slate-950 hover:bg-slate-100/70",
                )}
              >
                {s.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* RESULTS */}
      {visible.length === 0 ? (
        <EmptyState hasQuery={q.trim().length > 0 || filter !== "all"} />
      ) : (
        <>
          <div className="flex items-baseline justify-between px-1">
            <p className="text-xs text-slate-600">
              Showing{" "}
              <span className="font-semibold text-slate-900 tabular-nums">
                {summary.people}
              </span>{" "}
              {summary.people === 1 ? "performer" : "performers"}
              {" · "}
              <span className="tabular-nums">{summary.acts}</span> act
              {summary.acts === 1 ? "" : "s"}
              {" · "}
              <span className="tabular-nums">{summary.workshops}</span> workshop
              {summary.workshops === 1 ? "" : "s"}
            </p>
          </div>

          <div className="space-y-3">
            {visible.map((p) => (
              <PerformerCard
                key={p.key}
                performer={p}
                myMap={myMap}
                countsMap={countsMap}
              />
            ))}
          </div>
        </>
      )}
        </>
      )}
    </div>
  )
}

function PerformerCard({
  performer,
  myMap,
  countsMap,
}: {
  performer: Performer
  myMap: Map<string, { verdict: string | null; notes: string | null }>
  countsMap: Map<string, VerdictCountRow>
}) {
  const isAnonymous = performer.email === null
  return (
    <div className="rounded-2xl border border-white/70 bg-white/65 backdrop-blur-xl shadow-[0_8px_28px_-18px_rgba(30,58,138,0.18)] overflow-hidden">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3 px-5 py-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-[family-name:var(--font-serif)] text-2xl text-blue-950 leading-tight truncate max-w-[28rem]">
              {performer.displayName}
            </h3>
            {performer.actCount > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 text-blue-900 border border-blue-100 px-2 py-0.5 text-[11px] font-semibold">
                {performer.actCount} act{performer.actCount === 1 ? "" : "s"}
              </span>
            )}
            {performer.workshopCount > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 text-violet-900 border border-violet-100 px-2 py-0.5 text-[11px] font-semibold">
                {performer.workshopCount} workshop
                {performer.workshopCount === 1 ? "" : "s"}
              </span>
            )}
            {performer.actCount > 0 && performer.workshopCount > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 text-amber-900 border border-amber-100 px-2 py-0.5 text-[11px] font-semibold">
                cross-submitter
              </span>
            )}
          </div>
          <div className="mt-1.5 flex items-center gap-3 text-xs text-slate-600 flex-wrap">
            {performer.email ? (
              <span className="inline-flex items-center gap-1.5">
                <Mail className="h-3 w-3 text-slate-400" />
                <a
                  href={`mailto:${performer.email}`}
                  className="hover:text-blue-900 hover:underline"
                >
                  {performer.email}
                </a>
              </span>
            ) : (
              <span
                className="inline-flex items-center gap-1.5 text-slate-500 italic"
                title="Surfaces from an act's Performers field — no email on file"
              >
                <Users className="h-3 w-3" />
                teammate, no email on file
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Appearances */}
      <div className="divide-y divide-slate-200/60 border-t border-slate-200/60">
        {performer.appearances.map((a) => (
          <AppearanceRow
            key={`${a.submissionId}-${a.role}`}
            appearance={a}
            my={myMap.get(a.submissionId) ?? null}
            counts={countsMap.get(a.submissionId) ?? null}
            mutedLink={isAnonymous && a.role === "member"}
          />
        ))}
      </div>
    </div>
  )
}

function AppearanceRow({
  appearance,
  my,
  counts,
  mutedLink,
}: {
  appearance: Performer["appearances"][number]
  my: { verdict: string | null; notes: string | null } | null
  counts: VerdictCountRow | null
  mutedLink: boolean
}) {
  const typeLabel = appearance.submissionType === "act" ? "Act" : "Workshop"
  const roleLabel =
    appearance.role === "primary"
      ? "primary contact"
      : appearance.role === "submitter"
      ? "submitter"
      : "teammate"
  const myVerdict = my?.verdict ?? null
  const myNotes = my?.notes?.trim() ?? ""
  return (
    <Link
      href={`/submissions/${appearance.submissionId}`}
      className="block px-5 py-3 hover:bg-white/80 transition group"
    >
      <div className="flex items-center gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={cn(
                "text-[10px] uppercase tracking-[0.18em] font-semibold shrink-0",
                appearance.submissionType === "act"
                  ? "text-blue-700"
                  : "text-violet-700",
              )}
            >
              {typeLabel}
            </span>
            <span
              className={cn(
                "font-semibold truncate",
                mutedLink ? "text-slate-700" : "text-slate-900",
                "group-hover:text-blue-900",
              )}
            >
              {appearance.submissionTitle}
            </span>
            <span className="text-[11px] text-slate-500 italic">
              as {roleLabel}
            </span>
          </div>
          {myNotes && (
            <p className="mt-1 text-xs text-slate-600 truncate max-w-3xl">
              <span className="text-slate-400">Your notes:</span> {myNotes}
            </p>
          )}
        </div>

        <TeamPips
          counts={{
            yes: counts?.yes_count ?? 0,
            maybe: counts?.maybe_count ?? 0,
            no: counts?.no_count ?? 0,
            total: counts?.total_judgments ?? 0,
          }}
        />

        <div className="w-24 shrink-0 text-right">
          {myVerdict ? (
            <span
              className={cn(
                "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold border",
                VERDICT_PILL[myVerdict],
              )}
            >
              {VERDICT_LABEL[myVerdict]}
            </span>
          ) : (
            <span className="text-xs text-slate-400">unjudged</span>
          )}
        </div>

        <div className="w-20 shrink-0 text-right text-[11px] text-slate-500 tabular-nums">
          {appearance.submittedAt
            ? new Date(appearance.submittedAt).toLocaleDateString()
            : "—"}
        </div>

        <ChevronRight className="h-3.5 w-3.5 text-slate-300 group-hover:text-blue-500 transition shrink-0" />
      </div>
    </Link>
  )
}

function TeamPips({
  counts,
}: {
  counts: { yes: number; maybe: number; no: number; total: number }
}) {
  if (counts.total === 0) {
    return (
      <span className="hidden sm:inline text-[11px] text-slate-400 italic whitespace-nowrap">
        no team votes
      </span>
    )
  }
  const pip = "h-2 w-2 rounded-full"
  return (
    <div
      className="hidden sm:flex items-center gap-0.5"
      title={`${counts.yes} yes · ${counts.maybe} maybe · ${counts.no} no`}
    >
      {Array.from({ length: counts.yes }).map((_, i) => (
        <span key={`y${i}`} className={cn(pip, "bg-emerald-500")} />
      ))}
      {Array.from({ length: counts.maybe }).map((_, i) => (
        <span key={`m${i}`} className={cn(pip, "bg-amber-400")} />
      ))}
      {Array.from({ length: counts.no }).map((_, i) => (
        <span key={`n${i}`} className={cn(pip, "bg-rose-400")} />
      ))}
    </div>
  )
}

function EmptyState({ hasQuery }: { hasQuery: boolean }) {
  return (
    <div className="mx-auto max-w-xl rounded-3xl border border-white/70 bg-white/70 backdrop-blur-xl p-10 shadow-[0_16px_44px_-20px_rgba(30,58,138,0.25)] text-center">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-100 text-blue-900">
        <Users className="h-5 w-5" />
      </div>
      <h2 className="font-[family-name:var(--font-serif)] text-3xl text-blue-950">
        {hasQuery ? "No matches" : "No performers yet"}
      </h2>
      <p className="mt-3 text-sm text-slate-700">
        {hasQuery
          ? "Try clearing the filter or loosening your search."
          : "Import an act or workshop CSV in Settings to populate this view."}
      </p>
    </div>
  )
}
