import Link from "next/link"
import { ArrowRight, CheckCircle2, CircleDot, Sparkles, Users2 } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { SUBMISSION_TYPES, TYPE_LABELS, type SubmissionType } from "@/lib/csv"
import { cn } from "@/lib/utils"

type Search = { type?: string }

function isType(v: string | undefined): v is SubmissionType {
  return v === "act" || v === "volunteer" || v === "workshop"
}

type Counts = {
  yes_count: number
  no_count: number
  maybe_count: number
  total_judgments: number
}

type Tier = "locked" | "likely" | "bubble"

function classify(c: Counts): Tier | null {
  const { yes_count, no_count } = c
  if (yes_count <= 0) return null
  if (yes_count >= 2 && no_count === 0) return "locked"
  if (yes_count > no_count) return "likely"
  return "bubble"
}

const TIER_META: Record<
  Tier,
  { label: string; kicker: string; tone: string; icon: React.ReactNode; blurb: string }
> = {
  locked: {
    label: "Locked in",
    kicker: "Consensus yes",
    tone: "bg-emerald-100 text-emerald-900",
    icon: <CheckCircle2 className="h-4 w-4" />,
    blurb: "Two or more yes votes and nobody has said no.",
  },
  likely: {
    label: "Likely",
    kicker: "Leaning yes",
    tone: "bg-sky-100 text-sky-900",
    icon: <Sparkles className="h-4 w-4" />,
    blurb: "More yes than no — worth another look from the holdouts.",
  },
  bubble: {
    label: "On the bubble",
    kicker: "Contested",
    tone: "bg-amber-100 text-amber-900",
    icon: <CircleDot className="h-4 w-4" />,
    blurb: "At least one yes, but at least one no too. Needs a decision.",
  },
}

export default async function LineupPage({
  searchParams,
}: {
  searchParams: Promise<Search>
}) {
  const sp = await searchParams
  const type: SubmissionType = isType(sp.type) ? sp.type : "act"

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

  const { data: submissions } = ids.length
    ? await supabase
        .from("submissions")
        .select("id, name, email, submitted_at, data")
        .in("id", ids)
    : { data: [] as Array<{ id: string; name: string | null; email: string | null; submitted_at: string | null; data: unknown }> }

  const subMap = new Map((submissions ?? []).map((s) => [s.id, s]))

  const buckets: Record<Tier, Array<{
    id: string
    name: string
    email: string | null
    submittedAt: string | null
    counts: Counts
    meta: { actType?: string; location?: string }
  }>> = {
    locked: [],
    likely: [],
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
    const id = r.submission_id!
    const s = subMap.get(id)
    if (!s) continue
    const data = (s.data as Record<string, unknown>) ?? {}
    buckets[tier].push({
      id,
      name: s.name ?? "(no name)",
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
    })
  }

  // Sort each tier: more yes first, then fewer no, then newest.
  for (const tier of ["locked", "likely", "bubble"] as const) {
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

  const totalApproved = buckets.locked.length + buckets.likely.length + buckets.bubble.length

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-[11px] uppercase tracking-[0.3em] font-semibold text-blue-900 mb-2">
            The Lineup
          </div>
          <h1 className="font-[family-name:var(--font-serif)] text-5xl text-blue-950 leading-none">
            Approved <span className="italic text-[#2340d9]">talent</span>
          </h1>
          <p className="text-sm text-slate-700 mt-3 max-w-xl">
            Acts the team has said yes to, grouped by how solid the consensus is.
            Keep judging to push bubbles into the locked column.
          </p>
        </div>
        <div className="flex items-center gap-1 text-xs">
          {SUBMISSION_TYPES.map((t) => (
            <Link
              key={t}
              href={`/lineup?type=${t}`}
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
      </div>

      <div className="grid grid-cols-3 gap-3">
        <SummaryCard
          tier="locked"
          count={buckets.locked.length}
          total={totalApproved}
        />
        <SummaryCard
          tier="likely"
          count={buckets.likely.length}
          total={totalApproved}
        />
        <SummaryCard
          tier="bubble"
          count={buckets.bubble.length}
          total={totalApproved}
        />
      </div>

      {totalApproved === 0 ? (
        <EmptyLineup type={type} />
      ) : (
        <div className="space-y-8">
          {(["locked", "likely", "bubble"] as const).map((tier) => {
            const items = buckets[tier]
            if (items.length === 0) return null
            const meta = TIER_META[tier]
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
                    <LineupRow key={it.id} item={it} type={type} />
                  ))}
                </div>
              </section>
            )
          })}
        </div>
      )}
    </div>
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
  const meta = TIER_META[tier]
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
        {total > 0 && (
          <span className="text-xs text-slate-500 ml-auto">{pct}%</span>
        )}
      </div>
    </div>
  )
}

function LineupRow({
  item,
  type,
}: {
  item: {
    id: string
    name: string
    email: string | null
    submittedAt: string | null
    counts: Counts
    meta: { actType?: string; location?: string }
  }
  type: SubmissionType
}) {
  return (
    <div className="flex items-center gap-4 px-4 py-3 text-sm hover:bg-white/60 transition">
      <div className="flex-1 min-w-0">
        <Link
          href={`/submissions/${item.id}`}
          className="font-semibold text-slate-900 hover:underline"
        >
          {item.name}
        </Link>
        <div className="text-xs text-slate-600 truncate mt-0.5">
          {[item.meta.actType, item.meta.location].filter(Boolean).join(" · ") ||
            item.email ||
            "—"}
        </div>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <Tally tone="emerald" value={item.counts.yes_count} label="Y" />
        <Tally tone="amber" value={item.counts.maybe_count} label="M" />
        <Tally tone="rose" value={item.counts.no_count} label="N" />
      </div>
      <Link
        href={`/judge?type=${type}&id=${item.id}`}
        className="text-xs font-semibold text-[#2340d9] hover:underline inline-flex items-center gap-0.5 shrink-0"
      >
        Re-judge <ArrowRight className="h-3 w-3" />
      </Link>
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

