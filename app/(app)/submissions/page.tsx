import Link from "next/link"
import { Gavel, Inbox, Mail } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { SUBMISSION_TYPES, TYPE_LABELS, type SubmissionType } from "@/lib/csv"
import { buildCanonicalActFacets, canonicalActType } from "@/lib/act-types"
import { cn } from "@/lib/utils"
import { ActFacetsPicker } from "./facets-picker"

type Search = {
  type?: string
  filter?: string
  actType?: string
  location?: string
}

type FilterKey = "all" | "unjudged" | "yes" | "maybe" | "no"

function isType(v: string | undefined): v is SubmissionType {
  return v === "act" || v === "volunteer" || v === "workshop"
}

function isFilter(v: string | undefined): v is FilterKey {
  return v === "all" || v === "unjudged" || v === "yes" || v === "maybe" || v === "no"
}

function normalizeKey(s: string): string {
  return s
    .toLowerCase()
    .replace(/[-_/.,!]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function buildFacet(values: (string | null | undefined)[]): {
  key: string
  label: string
  count: number
}[] {
  const byKey = new Map<string, Map<string, number>>()
  const totalByKey = new Map<string, number>()
  for (const raw of values) {
    const s = (raw ?? "").trim()
    if (!s) continue
    const key = normalizeKey(s)
    if (!key) continue
    const bucket = byKey.get(key) ?? new Map<string, number>()
    bucket.set(s, (bucket.get(s) ?? 0) + 1)
    byKey.set(key, bucket)
    totalByKey.set(key, (totalByKey.get(key) ?? 0) + 1)
  }
  const out: { key: string; label: string; count: number }[] = []
  for (const [key, bucket] of byKey) {
    let topLabel = ""
    let topCount = -1
    for (const [label, n] of bucket) {
      if (n > topCount) {
        topCount = n
        topLabel = label
      }
    }
    out.push({ key, label: topLabel, count: totalByKey.get(key) ?? 0 })
  }
  out.sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
  return out
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

const FILTERS: Array<{ key: FilterKey; label: string; tone?: string }> = [
  { key: "all", label: "All" },
  { key: "unjudged", label: "Unjudged" },
  { key: "yes", label: "My yes", tone: "emerald" },
  { key: "maybe", label: "My maybe", tone: "amber" },
  { key: "no", label: "My no", tone: "rose" },
]

export default async function SubmissionsPage({
  searchParams,
}: {
  searchParams: Promise<Search>
}) {
  const params = await searchParams
  const type: SubmissionType = isType(params.type) ? params.type : "act"
  const filter: FilterKey = isFilter(params.filter) ? params.filter : "all"
  const actTypeRaw = params.actType ?? "all"
  const location = params.location ?? "all"

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const [{ data: submissions }, { data: lastUpdatedRow }, { data: allTypes }] =
    await Promise.all([
      supabase
        .from("submissions")
        .select("id, type, name, email, submitted_at, created_at, data")
        .eq("type", type)
        .order("submitted_at", { ascending: false, nullsFirst: false }),
      supabase
        .from("submissions")
        .select("updated_at")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase.from("submissions").select("type"),
    ])

  // Per-type counts for the tab pills.
  const typeCounts: Record<SubmissionType, number> = { act: 0, volunteer: 0, workshop: 0 }
  for (const r of allTypes ?? []) {
    if (r.type in typeCounts) typeCounts[r.type as SubmissionType]++
  }

  const typeFacets =
    type === "act"
      ? buildCanonicalActFacets(
          (submissions ?? []).map((s) => {
            const d = s.data as Record<string, unknown> | null
            const v = d?.["GroupAct Type"]
            return typeof v === "string" ? v : null
          }),
        )
      : []
  // Resolve the URL-supplied actType against canonical facet keys; collapse
  // stale/unknown values (e.g. pre-canonicalization links like "stand up")
  // back to "all" so results don't silently zero out.
  const actType =
    actTypeRaw === "all" || typeFacets.some((f) => f.key === actTypeRaw)
      ? actTypeRaw
      : "all"
  const locationFacets =
    type === "act"
      ? buildFacet(
          (submissions ?? []).map((s) => {
            const d = s.data as Record<string, unknown> | null
            const v = d?.["Location"]
            return typeof v === "string" ? v : null
          }),
        )
      : []

  const narrowedByActFacets = (submissions ?? []).filter((s) => {
    if (type !== "act") return true
    const d = s.data as Record<string, unknown> | null
    const rawType = typeof d?.["GroupAct Type"] === "string" ? (d!["GroupAct Type"] as string) : ""
    const rawLoc = typeof d?.["Location"] === "string" ? (d!["Location"] as string) : ""
    if (actType !== "all" && canonicalActType(rawType).key !== actType) return false
    if (location !== "all" && normalizeKey(rawLoc) !== location) return false
    return true
  })

  const ids = narrowedByActFacets.map((s) => s.id)

  const [{ data: myJudgments }, { data: counts }] = await Promise.all([
    ids.length > 0
      ? supabase
          .from("judgments")
          .select("submission_id, verdict")
          .eq("user_id", user!.id)
          .in("submission_id", ids)
      : Promise.resolve({ data: [] as { submission_id: string; verdict: string | null }[] }),
    ids.length > 0
      ? supabase
          .from("submission_verdict_counts")
          .select("submission_id, yes_count, no_count, maybe_count, total_judgments")
          .in("submission_id", ids)
      : Promise.resolve({
          data: [] as Array<{
            submission_id: string | null
            yes_count: number | null
            no_count: number | null
            maybe_count: number | null
            total_judgments: number | null
          }>,
        }),
  ])

  const myMap = new Map((myJudgments ?? []).map((j) => [j.submission_id, j.verdict]))
  const countsMap = new Map(
    (counts ?? [])
      .filter((c) => c.submission_id !== null)
      .map((c) => [c.submission_id as string, c]),
  )

  // Compute filter counts (within the narrowed-by-facets set) so each chip
  // shows a number.
  const filterCounts: Record<FilterKey, number> = {
    all: narrowedByActFacets.length,
    unjudged: 0,
    yes: 0,
    maybe: 0,
    no: 0,
  }
  for (const s of narrowedByActFacets) {
    const my = myMap.get(s.id) ?? null
    if (!my) filterCounts.unjudged++
    else if (my === "yes") filterCounts.yes++
    else if (my === "maybe") filterCounts.maybe++
    else if (my === "no") filterCounts.no++
  }

  const filtered = narrowedByActFacets.filter((s) => {
    const my = myMap.get(s.id) ?? null
    if (filter === "unjudged") return !my
    if (filter === "yes" || filter === "no" || filter === "maybe") return my === filter
    return true
  })

  const makeHref = (next: Partial<Search>) => {
    const sp = new URLSearchParams()
    const nextType = next.type ?? type
    sp.set("type", nextType)
    const nextFilter = next.filter ?? filter
    if (nextFilter !== "all") sp.set("filter", nextFilter)
    if (nextType === "act") {
      const nextActType = next.actType ?? actType
      const nextLoc = next.location ?? location
      if (nextActType !== "all") sp.set("actType", nextActType)
      if (nextLoc !== "all") sp.set("location", nextLoc)
    }
    return `/submissions?${sp.toString()}`
  }

  const makeDetailHref = (id: string) => {
    const sp = new URLSearchParams()
    sp.set("type", type)
    if (filter !== "all") sp.set("filter", filter)
    if (type === "act") {
      if (actType !== "all") sp.set("actType", actType)
      if (location !== "all") sp.set("location", location)
    }
    const qs = sp.toString()
    return qs ? `/submissions/${id}?${qs}` : `/submissions/${id}`
  }

  const judgeHref = `/judge?type=${type}${filter === "unjudged" ? "&filter=unjudged" : ""}`
  const facetsActive = type === "act" && (actType !== "all" || location !== "all")

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-[11px] uppercase tracking-[0.3em] font-semibold text-blue-900 mb-2">
            Submissions
          </div>
          <h1 className="font-[family-name:var(--font-serif)] text-5xl text-blue-950 leading-none">
            {TYPE_LABELS[type]}{" "}
            <span className="italic text-[#2340d9]">inbox</span>
          </h1>
          <p className="text-sm text-slate-700 mt-3 max-w-xl">
            Browse, filter, and judge submissions. Your verdict is saved
            privately but your teammates can see it.
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <Link
            href={judgeHref}
            className="inline-flex items-center gap-1.5 rounded-full bg-blue-950 text-white text-sm font-semibold px-4 py-2 hover:bg-blue-900 transition shadow-[0_6px_20px_-10px_rgba(30,58,138,0.4)]"
          >
            <Gavel className="h-3.5 w-3.5" />
            Enter judging mode
          </Link>
          {lastUpdatedRow?.updated_at && (
            <p className="text-xs text-slate-500 whitespace-nowrap">
              Last import {new Date(lastUpdatedRow.updated_at).toLocaleDateString()}
            </p>
          )}
        </div>
      </div>

      {/* CONSOLIDATED CONTROL PANEL */}
      <div className="rounded-2xl border border-white/70 bg-white/65 backdrop-blur-xl shadow-[0_8px_28px_-18px_rgba(30,58,138,0.18)] overflow-hidden">
        {/* Type row */}
        <div className="flex flex-wrap items-center gap-2 px-4 py-3">
          <span className="text-[10px] uppercase tracking-[0.22em] font-semibold text-slate-500 mr-2 w-12 shrink-0">
            Type
          </span>
          {SUBMISSION_TYPES.map((t) => (
            <Link
              key={t}
              href={makeHref({ type: t, filter: "all", actType: "all", location: "all" })}
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition",
                t === type
                  ? "bg-blue-950 text-white"
                  : "text-slate-700 hover:text-slate-950 hover:bg-slate-100/70",
              )}
            >
              {TYPE_LABELS[t]}
              <span
                className={cn(
                  "tabular-nums text-xs",
                  t === type ? "text-white/70" : "text-slate-500",
                )}
              >
                {typeCounts[t]}
              </span>
            </Link>
          ))}
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
              <Link
                key={f.key}
                href={makeHref({ filter: f.key })}
                className={cn(
                  "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition",
                  active
                    ? "bg-blue-950 text-white"
                    : "text-slate-700 hover:text-slate-950 hover:bg-slate-100/70",
                )}
              >
                {f.tone && (
                  <span
                    className={cn(
                      "h-1.5 w-1.5 rounded-full",
                      toneDot(f.tone, active),
                    )}
                  />
                )}
                {f.label}
                <span
                  className={cn(
                    "tabular-nums text-xs",
                    active ? "text-white/70" : "text-slate-500",
                  )}
                >
                  {count}
                </span>
              </Link>
            )
          })}
        </div>

        {/* Facets row (acts only) */}
        {type === "act" && (
          <div className="flex flex-wrap items-center gap-3 px-4 py-3 border-t border-slate-200/60">
            <span className="text-[10px] uppercase tracking-[0.22em] font-semibold text-slate-500 mr-2 w-12 shrink-0">
              Refine
            </span>
            <ActFacetsPicker
              typeFacets={typeFacets}
              locationFacets={locationFacets}
              selectedActType={actType}
              selectedLocation={location}
              type={type}
              filter={filter}
            />
          </div>
        )}
      </div>

      {/* RESULTS */}
      {filtered.length === 0 ? (
        <EmptyState
          hasFilters={filter !== "all" || facetsActive}
          clearHref={makeHref({ filter: "all", actType: "all", location: "all" })}
        />
      ) : (
        <>
          <div className="flex items-baseline justify-between px-1">
            <p className="text-xs text-slate-600">
              Showing{" "}
              <span className="font-semibold text-slate-900 tabular-nums">
                {filtered.length}
              </span>{" "}
              {filtered.length === 1 ? "submission" : "submissions"}
              {filter !== "all" && (
                <>
                  {" "}· <span className="italic">{activeFilterLabel(filter)}</span>
                </>
              )}
            </p>
            <p className="text-xs text-slate-500">Newest first</p>
          </div>
          <div className="rounded-2xl border border-white/70 bg-white/65 backdrop-blur-xl overflow-hidden divide-y divide-slate-200/60 shadow-[0_8px_28px_-18px_rgba(30,58,138,0.18)]">
            {filtered.map((s) => {
              const my = myMap.get(s.id) ?? null
              const c = countsMap.get(s.id)
              const d = s.data as Record<string, unknown> | null
              const actTypeLabel =
                type === "act" && typeof d?.["GroupAct Type"] === "string"
                  ? (d["GroupAct Type"] as string)
                  : ""
              const locationLabel =
                type === "act" && typeof d?.["Location"] === "string"
                  ? (d["Location"] as string)
                  : ""
              const metaParts =
                type === "act"
                  ? [actTypeLabel, locationLabel].filter(Boolean)
                  : s.email
                  ? [s.email]
                  : []
              return (
                <SubmissionRow
                  key={s.id}
                  id={s.id}
                  name={s.name ?? "(no name)"}
                  submittedAt={s.submitted_at}
                  metaParts={metaParts}
                  type={type}
                  myVerdict={my}
                  counts={{
                    yes: c?.yes_count ?? 0,
                    maybe: c?.maybe_count ?? 0,
                    no: c?.no_count ?? 0,
                    total: c?.total_judgments ?? 0,
                  }}
                  detailHref={makeDetailHref(s.id)}
                />
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

function activeFilterLabel(f: FilterKey): string {
  switch (f) {
    case "unjudged":
      return "unjudged"
    case "yes":
      return "my yes"
    case "maybe":
      return "my maybe"
    case "no":
      return "my no"
    default:
      return ""
  }
}

function toneDot(tone: string, active: boolean): string {
  const palette: Record<string, string> = {
    emerald: active ? "bg-emerald-300" : "bg-emerald-500",
    amber: active ? "bg-amber-300" : "bg-amber-500",
    rose: active ? "bg-rose-300" : "bg-rose-500",
  }
  return palette[tone] ?? "bg-slate-400"
}

function SubmissionRow({
  id,
  name,
  submittedAt,
  metaParts,
  type,
  myVerdict,
  counts,
  detailHref,
}: {
  id: string
  name: string
  submittedAt: string | null
  metaParts: string[]
  type: SubmissionType
  myVerdict: string | null
  counts: { yes: number; maybe: number; no: number; total: number }
  detailHref: string
}) {
  return (
    <div className="group flex items-center gap-4 px-4 py-3.5 hover:bg-white/80 transition">
      <div className="flex-1 min-w-0">
        <Link
          href={detailHref}
          className="font-semibold text-slate-900 hover:text-blue-900 block truncate"
        >
          {name}
        </Link>
        <div className="text-xs text-slate-600 truncate mt-0.5 flex items-center gap-1.5">
          {type !== "act" && metaParts[0] && (
            <Mail className="h-3 w-3 text-slate-400 shrink-0" />
          )}
          <span className="truncate">
            {metaParts.length > 0 ? metaParts.join(" · ") : "—"}
          </span>
        </div>
      </div>

      <div className="hidden sm:flex items-center gap-3 shrink-0">
        <TeamPips counts={counts} />
      </div>

      <div className="w-20 shrink-0 text-right">
        {myVerdict ? (
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold border",
              VERDICT_PILL[myVerdict],
            )}
          >
            {VERDICT_LABEL[myVerdict]}
          </span>
        ) : (
          <Link
            href={`/judge?type=${type}&id=${id}`}
            className="text-xs font-semibold text-[#2340d9] hover:underline inline-flex items-center gap-0.5"
          >
            Judge →
          </Link>
        )}
      </div>

      <div className="hidden md:block w-24 shrink-0 text-right text-xs text-slate-500 tabular-nums">
        {submittedAt ? new Date(submittedAt).toLocaleDateString() : "—"}
      </div>
    </div>
  )
}

function TeamPips({
  counts,
}: {
  counts: { yes: number; maybe: number; no: number; total: number }
}) {
  if (counts.total === 0) {
    return (
      <span className="text-[11px] text-slate-400 italic whitespace-nowrap">
        No team votes
      </span>
    )
  }
  const pip = "h-2 w-2 rounded-full"
  return (
    <div
      className="flex items-center gap-0.5"
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

function EmptyState({
  hasFilters,
  clearHref,
}: {
  hasFilters: boolean
  clearHref: string
}) {
  return (
    <div className="mx-auto max-w-xl rounded-3xl border border-white/70 bg-white/70 backdrop-blur-xl p-10 shadow-[0_16px_44px_-20px_rgba(30,58,138,0.25)] text-center">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-100 text-blue-900">
        <Inbox className="h-5 w-5" />
      </div>
      <h2 className="font-[family-name:var(--font-serif)] text-3xl text-blue-950">
        {hasFilters ? "No matches" : "Inbox empty"}
      </h2>
      <p className="mt-3 text-sm text-slate-700">
        {hasFilters
          ? "Nothing matches the active filters."
          : "Import a Squarespace CSV in Settings to start the queue."}
      </p>
      <div className="mt-6 flex items-center justify-center gap-2">
        {hasFilters ? (
          <Link
            href={clearHref}
            className="inline-flex items-center gap-1.5 rounded-full bg-blue-950 text-white text-sm font-semibold px-4 py-2 hover:bg-blue-900"
          >
            Clear filters
          </Link>
        ) : (
          <Link
            href="/settings"
            className="inline-flex items-center gap-1.5 rounded-full bg-blue-950 text-white text-sm font-semibold px-4 py-2 hover:bg-blue-900"
          >
            Import a CSV →
          </Link>
        )}
      </div>
    </div>
  )
}
