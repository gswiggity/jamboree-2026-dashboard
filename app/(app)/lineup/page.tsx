import Link from "next/link"
import { redirect } from "next/navigation"
import {
  CheckCircle2,
  CircleDot,
  HelpCircle,
  LayoutGrid,
  List,
  Sparkles,
  Users2,
} from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { canonicalActType } from "@/lib/act-types"
import {
  getActDisplayName,
  getActMembers,
  getActSubmitter,
  isSoloAct,
} from "@/lib/solo-act"
import { getActAvailability } from "@/lib/availability"
import {
  classify,
  TIER_BLURB,
  TIER_KICKER,
  TIER_LABEL,
  TIER_TONE,
  type Counts,
  type Tier,
} from "@/lib/lineup-tiers"
import { SUBMISSION_TYPES, TYPE_LABELS, type SubmissionType } from "@/lib/csv"
import { cn } from "@/lib/utils"
import { InlineVerdict, type Verdict } from "@/components/inline-verdict"
import { LineupBoard, type BoardCard, type BoardColumn } from "./board"

type Search = { type?: string; view?: string; filter?: string }
type ViewMode = "list" | "board"
type LineupFilter = "all" | "team_yes"

function isType(v: string | undefined): v is SubmissionType {
  return v === "act" || v === "volunteer" || v === "workshop"
}

function isView(v: string | undefined): v is ViewMode {
  return v === "list" || v === "board"
}

function isLineupFilter(v: string | undefined): v is LineupFilter {
  return v === "all" || v === "team_yes"
}

const TIER_ICON: Record<Tier, React.ReactNode> = {
  locked: <CheckCircle2 className="h-4 w-4" />,
  likely: <Sparkles className="h-4 w-4" />,
  maybe: <HelpCircle className="h-4 w-4" />,
  bubble: <CircleDot className="h-4 w-4" />,
}

const TIER_VIEW: Record<
  Tier,
  { label: string; kicker: string; tone: string; icon: React.ReactNode; blurb: string }
> = {
  locked: {
    label: TIER_LABEL.locked,
    kicker: TIER_KICKER.locked,
    tone: TIER_TONE.locked,
    icon: TIER_ICON.locked,
    blurb: TIER_BLURB.locked,
  },
  likely: {
    label: TIER_LABEL.likely,
    kicker: TIER_KICKER.likely,
    tone: TIER_TONE.likely,
    icon: TIER_ICON.likely,
    blurb: TIER_BLURB.likely,
  },
  maybe: {
    label: TIER_LABEL.maybe,
    kicker: TIER_KICKER.maybe,
    tone: TIER_TONE.maybe,
    icon: TIER_ICON.maybe,
    blurb: TIER_BLURB.maybe,
  },
  bubble: {
    label: TIER_LABEL.bubble,
    kicker: TIER_KICKER.bubble,
    tone: TIER_TONE.bubble,
    icon: TIER_ICON.bubble,
    blurb: TIER_BLURB.bubble,
  },
}

export default async function LineupPage({
  searchParams,
}: {
  searchParams: Promise<Search>
}) {
  const sp = await searchParams
  const type: SubmissionType = isType(sp.type) ? sp.type : "act"
  // The board only makes sense for acts (set length / tags are act-shaped),
  // so silently fall back to list view for vol/workshop.
  const requestedView: ViewMode = isView(sp.view) ? sp.view : "list"
  const view: ViewMode = type === "act" && requestedView === "board" ? "board" : "list"
  const filter: LineupFilter = isLineupFilter(sp.filter) ? sp.filter : "all"

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  return (
    <div className="space-y-8">
      <Header type={type} view={view} filter={filter} />
      {view === "board" ? (
        <BoardView userId={user.id} />
      ) : (
        <ListView type={type} userId={user.id} filter={filter} />
      )}
    </div>
  )
}

/* -------------------------------------------------- header */

function Header({
  type,
  view,
  filter,
}: {
  type: SubmissionType
  view: ViewMode
  filter: LineupFilter
}) {
  const buildHref = (next: { type?: SubmissionType; view?: ViewMode; filter?: LineupFilter }) => {
    const t = next.type ?? type
    const v = next.view ?? view
    const f = next.filter ?? filter
    const params = new URLSearchParams()
    params.set("type", t)
    if (v === "board" && t === "act") params.set("view", "board")
    if (f !== "all") params.set("filter", f)
    return `/lineup?${params.toString()}`
  }
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <div className="text-[11px] uppercase tracking-[0.3em] font-semibold text-blue-900 mb-2">
          The Lineup
        </div>
        <h1 className="font-[family-name:var(--font-serif)] text-5xl text-blue-950 leading-none">
          {view === "board" ? (
            <>
              Sticky-note <span className="italic text-[#2340d9]">board</span>
            </>
          ) : (
            <>
              Approved <span className="italic text-[#2340d9]">talent</span>
            </>
          )}
        </h1>
        <p className="text-sm text-slate-700 mt-3 max-w-xl">
          {view === "board"
            ? "Drag approved acts onto your own columns to sketch the festival. Edit set lengths and add tags as you plan."
            : "Acts the team is moving on, grouped by how solid the consensus is. Click a Y / M / N pill to change your vote inline."}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1 text-xs">
          {SUBMISSION_TYPES.map((t) => (
            <Link
              key={t}
              href={buildHref({ type: t, filter: "all" })}
              className={cn(
                "px-3 py-1.5 rounded-full font-medium transition",
                t === type
                  ? "bg-blue-950 text-white"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/60",
              )}
            >
              {TYPE_LABELS[t]}
            </Link>
          ))}
        </div>
        {view === "list" && (
          <div className="inline-flex items-center gap-0.5 rounded-full border border-slate-200/80 bg-white/70 backdrop-blur p-0.5 text-xs font-medium">
            <Link
              href={buildHref({ filter: "all" })}
              className={cn(
                "px-3 py-1 rounded-full transition",
                filter === "all"
                  ? "bg-blue-950 text-white"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/60",
              )}
            >
              All tiers
            </Link>
            <Link
              href={buildHref({ filter: "team_yes" })}
              className={cn(
                "px-3 py-1 rounded-full transition inline-flex items-center gap-1",
                filter === "team_yes"
                  ? "bg-emerald-600 text-white"
                  : "text-emerald-800 hover:bg-emerald-50",
              )}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Team yes
            </Link>
          </div>
        )}
        {type === "act" && (
          <div
            role="tablist"
            aria-label="View mode"
            className="inline-flex items-center gap-0.5 rounded-full border border-slate-200/80 bg-white/70 backdrop-blur p-0.5 text-xs font-medium"
          >
            <ViewToggle href={buildHref({ view: "list" })} active={view === "list"}>
              <List className="h-3.5 w-3.5" />
              List
            </ViewToggle>
            <ViewToggle
              href={buildHref({ view: "board" })}
              active={view === "board"}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              Board
            </ViewToggle>
          </div>
        )}
      </div>
    </div>
  )
}

function ViewToggle({
  href,
  active,
  children,
}: {
  href: string
  active: boolean
  children: React.ReactNode
}) {
  return (
    <Link
      href={href}
      role="tab"
      aria-selected={active}
      className={cn(
        "inline-flex items-center gap-1.5 px-3 py-1 rounded-full transition",
        active
          ? "bg-blue-950 text-white"
          : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/60",
      )}
    >
      {children}
    </Link>
  )
}

/* -------------------------------------------------- list view */

async function ListView({
  type,
  userId,
  filter,
}: {
  type: SubmissionType
  userId: string
  filter: LineupFilter
}) {
  const supabase = await createClient()

  const { data: rows } = await supabase
    .from("submission_verdict_counts")
    .select("submission_id, yes_count, no_count, maybe_count, total_judgments")
    .eq("type", type)

  const approvedRows = (rows ?? []).filter((r) =>
    classify({
      yes_count: r.yes_count ?? 0,
      no_count: r.no_count ?? 0,
      maybe_count: r.maybe_count ?? 0,
      total_judgments: r.total_judgments ?? 0,
    }) !== null,
  )

  const ids = approvedRows
    .map((r) => r.submission_id)
    .filter((id): id is string => id !== null)

  const [{ data: submissions }, { data: myJudgments }, { data: cardRows }] =
    await Promise.all([
      ids.length
        ? supabase
            .from("submissions")
            .select("id, name, email, submitted_at, data")
            .in("id", ids)
            .is("deleted_at", null)
        : Promise.resolve({
            data: [] as Array<{
              id: string
              name: string | null
              email: string | null
              submitted_at: string | null
              data: unknown
            }>,
          }),
      ids.length
        ? supabase
            .from("judgments")
            .select("submission_id, verdict")
            .eq("user_id", userId)
            .in("submission_id", ids)
        : Promise.resolve({
            data: [] as Array<{ submission_id: string; verdict: string | null }>,
          }),
      // Board placement — only meaningful for acts. For vol/workshop the
      // result is empty and the indicator never renders.
      type === "act" && ids.length
        ? supabase
            .from("lineup_cards")
            .select("submission_id, lineup_columns(title)")
            .in("submission_id", ids)
        : Promise.resolve({
            data: [] as Array<{
              submission_id: string
              lineup_columns: { title: string } | { title: string }[] | null
            }>,
          }),
    ])

  // Map each submission to the title of the column it sits in on the board,
  // or null if it's in Unsorted / has no card yet. Supabase's nested-select
  // typing returns an array for to-many and an object for to-one, so we
  // normalize both shapes.
  const columnBySubId = new Map<string, string | null>()
  for (const row of cardRows ?? []) {
    const rel = row.lineup_columns
    const title = Array.isArray(rel) ? (rel[0]?.title ?? null) : (rel?.title ?? null)
    columnBySubId.set(row.submission_id, title)
  }

  const subMap = new Map((submissions ?? []).map((s) => [s.id, s]))
  const myMap = new Map(
    (myJudgments ?? []).map((j) => [j.submission_id, j.verdict]),
  )

  type Item = {
    id: string
    name: string
    nameWasSubstituted: boolean
    originalName: string | null
    email: string | null
    submittedAt: string | null
    counts: Counts
    meta: { actType?: string; location?: string }
    submitter: string | null
    isSolo: boolean
    myVerdict: Verdict | null
    // Title of the board column this act sits in. null means "in Unsorted"
    // or no card yet — surfaced in the row as a muted "Not on board" hint.
    // Only populated for type==="act" (the board only exists for acts).
    boardColumn: string | null
    onBoard: boolean
  }
  const buckets: Record<Tier, Item[]> = {
    locked: [],
    likely: [],
    maybe: [],
    bubble: [],
  }

  for (const r of approvedRows) {
    const counts: Counts = {
      yes_count: r.yes_count ?? 0,
      no_count: r.no_count ?? 0,
      maybe_count: r.maybe_count ?? 0,
      total_judgments: r.total_judgments ?? 0,
    }
    const tier = classify(counts)
    if (!tier) continue
    if (filter === "team_yes" && tier !== "locked") continue
    const id = r.submission_id!
    const s = subMap.get(id)
    if (!s) continue
    const data = (s.data as Record<string, unknown>) ?? {}
    const myVerdictRaw = myMap.get(id) ?? null
    const myVerdict: Verdict | null =
      myVerdictRaw === "yes" || myVerdictRaw === "no" || myVerdictRaw === "maybe"
        ? myVerdictRaw
        : null
    const displayName =
      type === "act"
        ? getActDisplayName({ name: s.name, data: data ?? null, email: s.email })
        : { display: s.name ?? "(no name)", substituted: false, original: s.name }
    buckets[tier].push({
      id,
      name: displayName.display,
      nameWasSubstituted: displayName.substituted,
      originalName: displayName.original,
      email: s.email,
      submittedAt: s.submitted_at,
      counts,
      meta: {
        actType:
          typeof data["GroupAct Type"] === "string"
            ? (data["GroupAct Type"] as string)
            : undefined,
        location:
          typeof data["Location"] === "string" ? (data["Location"] as string) : undefined,
      },
      submitter: type === "act" ? getActSubmitter({ data: data ?? null }) : null,
      isSolo: type === "act" ? isSoloAct({ data: data ?? null }) : false,
      myVerdict,
      boardColumn:
        type === "act" ? (columnBySubId.get(id) ?? null) : null,
      onBoard: type === "act",
    })
  }

  for (const tier of ["locked", "likely", "maybe", "bubble"] as const) {
    buckets[tier].sort((a, b) => {
      if (a.counts.yes_count !== b.counts.yes_count) {
        return b.counts.yes_count - a.counts.yes_count
      }
      if (a.counts.no_count !== b.counts.no_count) {
        return a.counts.no_count - b.counts.no_count
      }
      const aT = a.submittedAt ? new Date(a.submittedAt).getTime() : 0
      const bT = b.submittedAt ? new Date(b.submittedAt).getTime() : 0
      return bT - aT
    })
  }

  const totalApproved =
    buckets.locked.length +
    buckets.likely.length +
    buckets.maybe.length +
    buckets.bubble.length

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <SummaryCard tier="locked" count={buckets.locked.length} total={totalApproved} />
        <SummaryCard tier="likely" count={buckets.likely.length} total={totalApproved} />
        <SummaryCard tier="maybe" count={buckets.maybe.length} total={totalApproved} />
        <SummaryCard tier="bubble" count={buckets.bubble.length} total={totalApproved} />
      </div>

      {totalApproved === 0 ? (
        <EmptyLineup type={type} />
      ) : (
        <div className="space-y-8">
          {(["locked", "likely", "maybe", "bubble"] as const).map((tier) => {
            const items = buckets[tier]
            if (items.length === 0) return null
            const meta = TIER_VIEW[tier]
            return (
              <section key={tier}>
                <div className="flex items-baseline justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className={cn("rounded-xl p-1.5", meta.tone)}>{meta.icon}</div>
                    <h2 className="font-[family-name:var(--font-serif)] text-2xl text-blue-950">
                      {meta.label}
                    </h2>
                    <span className="text-xs text-slate-500 tabular-nums">
                      {items.length}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 italic hidden sm:block">
                    {meta.blurb}
                  </p>
                </div>
                <div className="rounded-2xl border border-white/70 bg-white/65 backdrop-blur-xl overflow-hidden divide-y divide-slate-200/60">
                  {items.map((it) => (
                    <LineupRow key={it.id} item={it} tier={tier} />
                  ))}
                </div>
              </section>
            )
          })}
        </div>
      )}
    </>
  )
}

function SummaryCard({
  tier,
  count,
  total,
}: {
  tier: Tier
  count: number
  total: number
}) {
  const meta = TIER_VIEW[tier]
  const pct = total > 0 ? Math.round((count / total) * 100) : 0
  return (
    <div className="rounded-2xl border border-white/70 bg-white/65 backdrop-blur-xl p-4 shadow-[0_8px_28px_-18px_rgba(30,58,138,0.18)]">
      <div className="flex items-center gap-2">
        <div className={cn("rounded-xl p-1.5", meta.tone)}>{meta.icon}</div>
        <div className="text-[11px] uppercase tracking-[0.22em] font-semibold text-slate-600">
          {meta.kicker}
        </div>
      </div>
      <div className="mt-3 flex items-baseline gap-1.5">
        <span className="font-semibold text-3xl tabular-nums text-slate-900 leading-none">
          {count}
        </span>
        <span className="text-xs text-slate-600">{count === 1 ? "act" : "acts"}</span>
        {total > 0 && <span className="text-xs text-slate-500 ml-auto">{pct}%</span>}
      </div>
    </div>
  )
}

function LineupRow({
  item,
  tier,
}: {
  item: {
    id: string
    name: string
    nameWasSubstituted: boolean
    originalName: string | null
    email: string | null
    submittedAt: string | null
    counts: Counts
    meta: { actType?: string; location?: string }
    submitter: string | null
    isSolo: boolean
    myVerdict: Verdict | null
    boardColumn: string | null
    onBoard: boolean
  }
  tier: Tier
}) {
  return (
    <div className="flex items-center gap-4 px-4 py-3 text-sm hover:bg-white/60 transition">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <Link
            href={`/submissions/${item.id}`}
            className="font-semibold text-slate-900 hover:underline"
            title={
              item.nameWasSubstituted && item.originalName
                ? `Group name was "${item.originalName}" — showing primary contact instead`
                : undefined
            }
          >
            {item.name}
          </Link>
          {tier === "locked" && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-200/80 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Team yes
            </span>
          )}
          {item.isSolo && item.submitter && (
            <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 text-violet-900 border border-violet-100 px-2 py-0.5 text-[10px] font-semibold">
              Solo · {item.submitter}
            </span>
          )}
        </div>
        <div className="text-xs text-slate-600 truncate mt-0.5">
          {[item.meta.actType, item.meta.location].filter(Boolean).join(" · ") ||
            item.email ||
            "—"}
        </div>
      </div>
      {item.onBoard && (
        item.boardColumn ? (
          <span
            className="shrink-0 inline-flex items-center gap-1 rounded-full bg-blue-50 text-blue-900 border border-blue-200/80 px-2 py-0.5 text-[10px] font-semibold max-w-[12rem] truncate"
            title={`On the board in "${item.boardColumn}"`}
          >
            <LayoutGrid className="h-2.5 w-2.5" />
            {item.boardColumn}
          </span>
        ) : (
          <span
            className="shrink-0 inline-flex items-center gap-1 rounded-full border border-dashed border-slate-300 px-2 py-0.5 text-[10px] font-medium text-slate-500"
            title="Not placed in a board column yet"
          >
            Not on board
          </span>
        )
      )}
      <div className="flex items-center gap-1.5 shrink-0">
        <Tally tone="emerald" value={item.counts.yes_count} label="Y" />
        <Tally tone="amber" value={item.counts.maybe_count} label="M" />
        <Tally tone="rose" value={item.counts.no_count} label="N" />
      </div>
      <InlineVerdict submissionId={item.id} initialVerdict={item.myVerdict} />
    </div>
  )
}

function Tally({
  tone,
  value,
  label,
}: {
  tone: "emerald" | "amber" | "rose"
  value: number
  label: string
}) {
  const empty = value === 0
  const toneBg = empty
    ? "bg-slate-100 text-slate-400"
    : {
        emerald: "bg-emerald-100 text-emerald-900",
        amber: "bg-amber-100 text-amber-900",
        rose: "bg-rose-100 text-rose-900",
      }[tone]
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums",
        toneBg,
      )}
    >
      <span>{value}</span>
      <span className="opacity-70">{label}</span>
    </span>
  )
}

function EmptyLineup({ type }: { type: SubmissionType }) {
  return (
    <div className="mx-auto max-w-xl rounded-3xl border border-white/70 bg-white/70 backdrop-blur-xl p-10 shadow-[0_16px_44px_-20px_rgba(30,58,138,0.25)] text-center">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-100 text-blue-900">
        <Users2 className="h-5 w-5" />
      </div>
      <h2 className="font-[family-name:var(--font-serif)] text-3xl text-blue-950">
        No lineup yet
      </h2>
      <p className="mt-3 text-sm text-slate-700">
        Nothing has made the cut in {TYPE_LABELS[type].toLowerCase()} yet. Jump
        into judging and the approvals will show up here.
      </p>
      <div className="mt-6">
        <Link
          href={`/judge?type=${type}`}
          className="inline-flex items-center gap-1.5 rounded-full bg-blue-950 text-white text-sm font-semibold px-4 py-2 hover:bg-blue-900"
        >
          Start judging →
        </Link>
      </div>
    </div>
  )
}

/* -------------------------------------------------- board view */

async function BoardView({ userId }: { userId: string }) {
  const supabase = await createClient()

  // Acts that earned at least one tier (locked / likely / maybe / bubble).
  // Maybe-tier acts have no yes votes but no nos either, so they belong on
  // the board too — they're acts the team hasn't committed to discarding.
  const { data: verdictRows } = await supabase
    .from("submission_verdict_counts")
    .select("submission_id, yes_count, no_count, maybe_count, total_judgments")
    .eq("type", "act")

  const approved = (verdictRows ?? []).filter(
    (r) =>
      r.submission_id &&
      classify({
        yes_count: r.yes_count ?? 0,
        no_count: r.no_count ?? 0,
        maybe_count: r.maybe_count ?? 0,
        total_judgments: r.total_judgments ?? 0,
      }) !== null,
  )
  const approvedIds = approved.map((r) => r.submission_id!)

  const [
    { data: submissions },
    { data: columns },
    { data: cards },
    { data: myJudgments },
  ] = await Promise.all([
    approvedIds.length > 0
      ? supabase
          .from("submissions")
          .select("id, name, email, data")
          .in("id", approvedIds)
          .is("deleted_at", null)
      : Promise.resolve({ data: [] as never[] }),
    supabase
      .from("lineup_columns")
      .select("id, title, position, color")
      .order("position", { ascending: true }),
    supabase
      .from("lineup_cards")
      .select(
        "id, submission_id, column_id, position, set_length_minutes, tags",
      ),
    approvedIds.length > 0
      ? supabase
          .from("judgments")
          .select("submission_id, verdict")
          .eq("user_id", userId)
          .in("submission_id", approvedIds)
      : Promise.resolve({
          data: [] as Array<{ submission_id: string; verdict: string | null }>,
        }),
  ])

  // Bootstrap missing cards. The unique constraint on submission_id keeps
  // this idempotent across concurrent loads.
  const cardBySubId = new Map(
    (cards ?? []).map((c) => [c.submission_id, c]),
  )
  const missing = approvedIds.filter((id) => !cardBySubId.has(id))
  if (missing.length > 0) {
    const { data: inserted } = await supabase
      .from("lineup_cards")
      .insert(missing.map((id) => ({ submission_id: id })))
      .select(
        "id, submission_id, column_id, position, set_length_minutes, tags",
      )
    for (const c of inserted ?? []) cardBySubId.set(c.submission_id, c)
  }

  const subById = new Map(
    (submissions ?? []).map((s) => [s.id, s] as const),
  )
  const verdictById = new Map(
    approved.map((r) => [r.submission_id!, r] as const),
  )
  const myVerdictBySubId = new Map(
    (myJudgments ?? []).map((j) => [j.submission_id, j.verdict] as const),
  )

  const boardColumns: BoardColumn[] = (columns ?? []).map((c) => ({
    id: c.id,
    title: c.title,
    position: c.position,
  }))

  const boardCards: BoardCard[] = []
  for (const id of approvedIds) {
    const card = cardBySubId.get(id)
    const sub = subById.get(id)
    if (!card || !sub) continue
    const data = (sub.data as Record<string, unknown>) ?? {}
    const rawType =
      typeof data["GroupAct Type"] === "string"
        ? (data["GroupAct Type"] as string)
        : null
    const submitter = getActSubmitter({ data: data ?? null })
    const members = getActMembers({ data: data ?? null })
    const isSolo = members.length === 0
    const v = verdictById.get(id)
    const counts = {
      yes_count: v?.yes_count ?? 0,
      no_count: v?.no_count ?? 0,
      maybe_count: v?.maybe_count ?? 0,
    }
    const myVerdictRaw = myVerdictBySubId.get(id) ?? null
    const myVerdict: Verdict | null =
      myVerdictRaw === "yes" || myVerdictRaw === "no" || myVerdictRaw === "maybe"
        ? myVerdictRaw
        : null
    const displayName = getActDisplayName({
      name: sub.name,
      data: data ?? null,
      email: sub.email,
    })
    boardCards.push({
      id: card.id,
      submissionId: id,
      columnId: card.column_id,
      position: card.position,
      name: displayName.display,
      nameWasSubstituted: displayName.substituted,
      originalName: displayName.original,
      typeLabel: canonicalActType(rawType).label,
      submitter,
      members,
      isSolo,
      setLengthMinutes: card.set_length_minutes,
      tags: card.tags ?? [],
      tier: classify({
        ...counts,
        total_judgments: counts.yes_count + counts.no_count + counts.maybe_count,
      }),
      counts,
      myVerdict,
      availability: getActAvailability(data),
    })
  }

  return <LineupBoard columns={boardColumns} cards={boardCards} />
}
