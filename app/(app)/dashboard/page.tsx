import Link from "next/link"
import {
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  CheckSquare,
  FileText,
  LayoutGrid,
  Mic2,
  Sparkles,
  TrendingUp,
  Users,
} from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { cn } from "@/lib/utils"
import { nextPhase, resolveCurrentPhase, type Phase } from "@/lib/phases"
import { Notepad, type NoteAuthor, type NoteRow } from "./notepad"

const FESTIVAL = {
  name: "Swear Jar Jamboree",
  tagline: "Indie Comedy + Improv Fest · Philadelphia",
  start: new Date("2026-07-09T19:00:00-04:00"),
  end: new Date("2026-07-12T23:00:00-04:00"),
}

const SPARK_DAYS = 15
// Ticket goal numbers are still placeholder until /tickets is wired up.
const TICKET_STUBS = {
  ticketSales: 0,
  ticketGoal: 1200,
  ticketOnSaleDate: "May 15",
}

function daysUntil(date: Date) {
  return Math.max(0, Math.ceil((date.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
}

function formatDateRange(start: Date, end: Date) {
  const month = start.toLocaleDateString("en-US", { month: "long" })
  const sameMonth = start.getMonth() === end.getMonth()
  if (sameMonth) return `${month} ${start.getDate()}–${end.getDate()}, ${start.getFullYear()}`
  return `${start.toLocaleDateString()} – ${end.toLocaleDateString()}`
}

function bucketSubmissionsByDay(dates: (string | null)[], days: number): number[] {
  const now = new Date()
  const buckets = Array(days).fill(0)
  for (const raw of dates) {
    if (!raw) continue
    const d = new Date(raw)
    if (Number.isNaN(d.getTime())) continue
    const daysAgo = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24))
    if (daysAgo >= 0 && daysAgo < days) {
      buckets[days - 1 - daysAgo] += 1
    }
  }
  return buckets
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const [
    { data: submissions },
    { data: myJudgments },
    { data: recentJudgments },
    { data: profilesData, count: profilesCount },
    { data: phaseRow },
    { data: phases },
    { data: notes },
    { count: openTasksCount },
    { count: totalTasksCount },
    { count: lineupUnsortedCount },
    { count: lineupTotalCount },
    { count: documentsCount },
  ] = await Promise.all([
    supabase
      .from("submissions")
      .select("id, type, submitted_at")
      .is("deleted_at", null),
    supabase.from("judgments").select("submission_id, verdict").eq("user_id", user!.id),
    supabase
      .from("judgments")
      .select("id, verdict, updated_at, user_id, profiles!judgments_user_id_fkey(email)")
      .order("updated_at", { ascending: false })
      .limit(5),
    supabase
      .from("profiles")
      .select("id, full_name, email", { count: "exact" }),
    supabase
      .from("festival_settings")
      .select("phase")
      .eq("id", true)
      .maybeSingle(),
    supabase.from("phases").select("*").order("sort_order", { ascending: true }),
    supabase
      .from("notes")
      .select("id, body, pinned, created_at, updated_at, created_by")
      .order("pinned", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .is("completed_at", null),
    supabase.from("tasks").select("id", { count: "exact", head: true }),
    supabase
      .from("lineup_cards")
      .select("id", { count: "exact", head: true })
      .is("column_id", null),
    supabase.from("lineup_cards").select("id", { count: "exact", head: true }),
    supabase.from("documents").select("id", { count: "exact", head: true }),
  ])

  const counts = { act: 0, volunteer: 0, workshop: 0 }
  for (const s of submissions ?? []) {
    if (s.type in counts) counts[s.type as keyof typeof counts]++
  }
  const totalSubmissions = (submissions ?? []).length
  const totalJudged = (myJudgments ?? []).filter((j) => j.verdict !== null).length
  const unjudged = Math.max(0, totalSubmissions - totalJudged)
  const teamCount = profilesCount ?? 0
  const openTasks = openTasksCount ?? 0
  const totalTasks = totalTasksCount ?? 0
  const lineupUnsorted = lineupUnsortedCount ?? 0
  const lineupTotal = lineupTotalCount ?? 0
  const documentsTotal = documentsCount ?? 0
  const noteRows: NoteRow[] = (notes ?? []).map((n) => ({
    id: n.id,
    body: n.body,
    pinned: n.pinned,
    created_at: n.created_at,
    updated_at: n.updated_at,
    created_by: n.created_by,
  }))
  const noteAuthors: NoteAuthor[] = (profilesData ?? []).map((p) => ({
    id: p.id,
    name: p.full_name,
    email: p.email,
  }))
  const submissionTrend = bucketSubmissionsByDay(
    (submissions ?? []).map((s) => s.submitted_at),
    SPARK_DAYS,
  )
  const trendThisWeek = submissionTrend.slice(-7).reduce((a, b) => a + b, 0)

  const days = daysUntil(FESTIVAL.start)
  const phaseList: Phase[] = phases ?? []
  const phase = resolveCurrentPhase(phaseList, phaseRow?.phase)
  const upcomingPhase = nextPhase(phaseList, phase.key)
  const judgingPct = counts.act > 0 ? Math.round((totalJudged / counts.act) * 100) : 0
  const ticketPct = Math.round((TICKET_STUBS.ticketSales / TICKET_STUBS.ticketGoal) * 100)
  // The countdown ring visualises "time elapsed in the 365-day lead-up" — capped 0..100.
  const countdownPct = Math.min(100, Math.max(0, ((365 - days) / 365) * 100))

  return (
    <div className="space-y-10">
      {/* HERO BENTO */}
      <section className="grid grid-cols-12 auto-rows-[minmax(140px,auto)] gap-3">
        <Tile className="col-span-12 lg:col-span-7 row-span-2 !p-0 overflow-hidden">
          <div className="relative h-full p-7 flex flex-col justify-between bg-gradient-to-br from-white/60 via-white/40 to-sky-100/50">
            <div>
              <p className="text-[11px] tracking-[0.3em] text-blue-900 uppercase font-semibold mb-4">
                {FESTIVAL.tagline}
              </p>
              <h1 className="font-[family-name:var(--font-serif)] text-[3.5rem] md:text-[5.5rem] leading-[0.9] tracking-tight text-blue-950">
                Swear Jar <br />
                <span className="italic text-[#2340d9]">Jamboree</span>
              </h1>
            </div>
            <div className="flex items-center gap-3 text-sm text-slate-700">
              <CalendarDays className="h-4 w-4 text-slate-500" />
              <span className="font-[family-name:var(--font-serif)] italic text-lg">
                {formatDateRange(FESTIVAL.start, FESTIVAL.end)}
              </span>
            </div>
            <svg
              className="absolute -right-10 -bottom-10 w-64 h-64 opacity-40"
              viewBox="0 0 200 200"
              fill="none"
            >
              <circle cx="100" cy="100" r="80" stroke="#2340d9" strokeWidth="0.5" strokeDasharray="2 6" />
              <circle cx="100" cy="100" r="50" stroke="#2340d9" strokeWidth="0.5" strokeDasharray="2 6" />
              <circle cx="100" cy="100" r="25" stroke="#2340d9" strokeWidth="0.5" strokeDasharray="2 6" />
            </svg>
          </div>
        </Tile>

        <Tile className="col-span-6 lg:col-span-3 row-span-2">
          <div className="flex flex-col h-full justify-between">
            <div className="text-[11px] uppercase tracking-[0.22em] font-semibold text-slate-600">
              Time to kickoff
            </div>
            <div className="relative flex-1 flex items-center justify-center">
              <ProgressRing percent={countdownPct} size={160} stroke={8} />
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <div className="font-mono text-5xl tabular-nums font-semibold text-blue-950 leading-none">
                  {days}
                </div>
                <div className="text-[11px] uppercase tracking-[0.22em] font-semibold text-slate-600 mt-1">
                  days
                </div>
              </div>
            </div>
          </div>
        </Tile>

        <Tile className="col-span-6 lg:col-span-2">
          <div className="flex flex-col h-full justify-between gap-3">
            <div className="text-[11px] uppercase tracking-[0.22em] font-semibold text-slate-600">
              Phase
            </div>
            <div className="flex items-center gap-2.5">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-70" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
              </span>
              <div className="text-sm font-semibold text-slate-900 leading-tight">
                {phase.label}
              </div>
            </div>
            <div className="text-xs text-slate-600">
              next → {upcomingPhase?.short ?? "—"}
            </div>
          </div>
        </Tile>

        <Tile className="col-span-6 lg:col-span-2 !p-0 overflow-hidden">
          <Link
            href="/judge?type=act"
            className="flex flex-col h-full justify-between gap-2 p-5 transition hover:bg-white/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2340d9]/40"
          >
            <div className="text-[11px] uppercase tracking-[0.22em] font-semibold text-slate-600">
              Judging
            </div>
            <div className="flex items-center gap-3">
              <ProgressRing percent={judgingPct} size={52} stroke={5} />
              <div>
                <div className="font-semibold text-slate-900 leading-none tabular-nums text-lg">
                  {totalJudged}/{counts.act}
                </div>
                <div className="text-xs text-slate-600 mt-0.5">acts judged</div>
              </div>
            </div>
            <span className="text-xs font-semibold text-[#2340d9] inline-flex items-center gap-1 group-hover:underline">
              Enter judging <ArrowRight className="h-3 w-3" />
            </span>
          </Link>
        </Tile>
      </section>

      {/* MAIN: real tiles on the left, notepad pinned to the right */}
      <div className="grid grid-cols-12 gap-6 items-stretch">
        <div className="col-span-12 lg:col-span-8 space-y-10">
          {/* ATTENTION */}
          <section>
            <SectionHeader title="Needs your attention" count="3 items" />
            <div className="grid grid-cols-12 gap-3">
              <Tile className="col-span-12 sm:col-span-4 !p-4">
                <Link href="/judge?type=act" className="flex flex-col h-full gap-2 group">
                  <div className="flex items-center gap-2">
                    <div className="rounded-xl p-1.5 bg-blue-100 text-blue-900">
                      <Mic2 className="h-4 w-4" />
                    </div>
                    <div className="text-[10px] uppercase tracking-[0.22em] font-semibold text-blue-900">
                      Judging
                    </div>
                  </div>
                  <h3 className="font-[family-name:var(--font-serif)] text-xl text-blue-950 leading-tight mt-1">
                    <span className="tabular-nums">{unjudged}</span> unjudged
                  </h3>
                  <p className="text-xs text-slate-600">
                    Clear the queue with shortcuts.
                  </p>
                  <span className="mt-auto inline-flex items-center gap-1 text-xs font-semibold text-[#2340d9] group-hover:underline">
                    Enter judging <ArrowRight className="h-3 w-3" />
                  </span>
                </Link>
              </Tile>
              <Tile className="col-span-12 sm:col-span-4 !p-4">
                <Link href="/tasks" className="flex flex-col h-full gap-2 group">
                  <div className="flex items-center gap-2">
                    <div className="rounded-xl p-1.5 bg-emerald-100 text-emerald-900">
                      <CheckSquare className="h-4 w-4" />
                    </div>
                    <div className="text-[10px] uppercase tracking-[0.22em] font-semibold text-emerald-900">
                      Tasks
                    </div>
                  </div>
                  <h3 className="font-[family-name:var(--font-serif)] text-xl text-blue-950 leading-tight mt-1">
                    <span className="tabular-nums">{openTasks}</span> open
                  </h3>
                  <p className="text-xs text-slate-600">
                    {totalTasks > 0
                      ? `${totalTasks - openTasks} of ${totalTasks} done.`
                      : "No tasks yet."}
                  </p>
                  <span className="mt-auto inline-flex items-center gap-1 text-xs font-semibold text-[#2340d9] group-hover:underline">
                    Open tasks <ArrowRight className="h-3 w-3" />
                  </span>
                </Link>
              </Tile>
              <Tile className="col-span-12 sm:col-span-4 !p-4">
                <Link href="/lineup" className="flex flex-col h-full gap-2 group">
                  <div className="flex items-center gap-2">
                    <div className="rounded-xl p-1.5 bg-amber-100 text-amber-900">
                      <LayoutGrid className="h-4 w-4" />
                    </div>
                    <div className="text-[10px] uppercase tracking-[0.22em] font-semibold text-amber-900">
                      Lineup
                    </div>
                  </div>
                  <h3 className="font-[family-name:var(--font-serif)] text-xl text-blue-950 leading-tight mt-1">
                    <span className="tabular-nums">{lineupUnsorted}</span> unsorted
                  </h3>
                  <p className="text-xs text-slate-600">
                    {lineupTotal > 0
                      ? `${lineupTotal - lineupUnsorted} of ${lineupTotal} placed.`
                      : "No acts in lineup yet."}
                  </p>
                  <span className="mt-auto inline-flex items-center gap-1 text-xs font-semibold text-[#2340d9] group-hover:underline">
                    Open board <ArrowRight className="h-3 w-3" />
                  </span>
                </Link>
              </Tile>
            </div>
          </section>

          {/* PILLARS */}
          <section>
            <SectionHeader title="Festival pillars" count="3 areas" />
            <div className="grid grid-cols-12 gap-3">
              <Tile className="col-span-12 sm:col-span-8 row-span-2">
                <Link href="/submissions" className="flex flex-col h-full gap-4 group">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <div className="rounded-xl p-1.5 bg-blue-100 text-blue-900">
                        <Sparkles className="h-4 w-4" />
                      </div>
                      <div className="text-[11px] uppercase tracking-[0.2em] font-semibold text-slate-700">
                        Talent
                      </div>
                    </div>
                    {trendThisWeek > 0 && (
                      <div className="text-xs text-slate-600 inline-flex items-center gap-1">
                        <TrendingUp className="h-3 w-3 text-emerald-600" />
                        <span>+{trendThisWeek} this week</span>
                      </div>
                    )}
                  </div>
                  <div>
                    <div className="flex items-baseline gap-2">
                      <div className="font-semibold text-5xl text-slate-900 tabular-nums leading-none">
                        {totalSubmissions}
                      </div>
                      <div className="font-[family-name:var(--font-serif)] italic text-xl text-slate-700">
                        submissions
                      </div>
                    </div>
                    <div className="text-sm text-slate-600 mt-2">
                      <span className="tabular-nums font-medium text-slate-800">{counts.act}</span> acts ·{" "}
                      <span className="tabular-nums font-medium text-slate-800">{counts.volunteer}</span> vols ·{" "}
                      <span className="tabular-nums font-medium text-slate-800">{counts.workshop}</span> wksps
                    </div>
                  </div>
                  <div className="flex-1 flex items-end min-h-[64px]">
                    <Sparkline
                      values={submissionTrend}
                      className="w-full h-16"
                      stroke="#2340d9"
                      fill="rgba(35,64,217,0.08)"
                    />
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-500 font-medium">
                    <span>{SPARK_DAYS} days ago</span>
                    <span>today</span>
                  </div>
                </Link>
              </Tile>

              <Tile className="col-span-12 sm:col-span-4 !p-4">
                <Link href="/settings" className="flex flex-col h-full gap-2">
                  <PillarBody
                    tone="slate"
                    icon={<Users className="h-4 w-4" />}
                    name="Ops"
                    value={`${teamCount}`}
                    unit={teamCount === 1 ? "member" : "members"}
                    secondary="Allowlist on /settings"
                  />
                </Link>
              </Tile>

              <Tile className="col-span-12 sm:col-span-4 !p-4">
                <Link href="/documents" className="flex flex-col h-full gap-2">
                  <PillarBody
                    tone="amber"
                    icon={<FileText className="h-4 w-4" />}
                    name="Documents"
                    value={`${documentsTotal}`}
                    unit={documentsTotal === 1 ? "file" : "files"}
                    secondary="Shared team library"
                  />
                </Link>
              </Tile>
            </div>
          </section>

          {/* ACTIVITY + TICKET GOAL */}
          <section className="grid grid-cols-12 gap-3">
            <Tile className="col-span-12 sm:col-span-7">
              <div className="flex items-baseline justify-between mb-4">
                <h2 className="font-[family-name:var(--font-serif)] text-2xl text-blue-950">
                  Team activity
                </h2>
                <Link
                  href="/analysis"
                  className="text-xs font-semibold text-[#2340d9] hover:underline"
                >
                  View all →
                </Link>
              </div>
              {recentJudgments && recentJudgments.length > 0 ? (
                <ul className="divide-y divide-slate-200/60 text-sm -mx-1">
                  {recentJudgments.map((j) => {
                    const actorEmail = getActorEmail(j.profiles)
                    const actor = actorEmail?.split("@")[0] ?? "someone"
                    return (
                      <li key={j.id} className="px-1 py-3 flex items-center gap-3">
                        <span className={cn("h-2 w-2 rounded-full shrink-0", verdictDot(j.verdict))} />
                        <div className="flex-1 min-w-0 flex items-center justify-between gap-3">
                          <div className="truncate">
                            <span className="font-semibold text-slate-900 capitalize">{actor}</span>{" "}
                            <span className="text-slate-700">
                              verdict · {j.verdict ?? "skip"}
                            </span>
                          </div>
                          <div className="text-xs text-slate-500 tabular-nums">
                            {new Date(j.updated_at).toLocaleDateString()}
                          </div>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              ) : (
                <p className="text-sm text-slate-600 italic py-4">
                  No verdicts cast yet. Start judging to fill the timeline.
                </p>
              )}
            </Tile>

            <Tile className="col-span-12 sm:col-span-5 bg-gradient-to-br from-blue-950 via-blue-900 to-[#2340d9] !border-transparent text-white">
              <div className="flex flex-col h-full justify-between gap-5">
                <div className="text-[11px] uppercase tracking-[0.22em] font-semibold text-blue-200">
                  Ticket goal
                </div>
                <div>
                  <div className="flex items-baseline gap-2">
                    <span className="font-mono font-semibold text-5xl tabular-nums leading-none">
                      {TICKET_STUBS.ticketSales}
                    </span>
                    <span className="font-[family-name:var(--font-serif)] italic text-xl text-blue-200">
                      / {TICKET_STUBS.ticketGoal}
                    </span>
                  </div>
                  <div className="text-sm text-blue-200/90 mt-2">
                    tickets sold · not yet on sale
                  </div>
                </div>
                <div>
                  <div className="h-1.5 rounded-full bg-white/15 overflow-hidden">
                    <div
                      className="h-full bg-white/70 rounded-full"
                      style={{ width: `${Math.max(2, ticketPct)}%` }}
                    />
                  </div>
                  <div className="text-xs text-blue-200/90 mt-2 inline-flex items-center gap-1">
                    <span>On-sale target: {TICKET_STUBS.ticketOnSaleDate}</span>
                    <ArrowUpRight className="h-3 w-3" />
                  </div>
                </div>
              </div>
            </Tile>
          </section>
        </div>

        {/* RIGHT COL: notepad sticks while you scroll the rest */}
        <aside className="col-span-12 lg:col-span-4 lg:h-full">
          <div className="lg:sticky lg:top-4 lg:h-[calc(100vh-2rem)]">
            <Notepad
              notes={noteRows}
              authors={noteAuthors}
              currentUserId={user!.id}
            />
          </div>
        </aside>
      </div>
    </div>
  )
}

function getActorEmail(profile: unknown): string | null {
  if (!profile) return null
  if (Array.isArray(profile)) {
    const first = profile[0] as { email?: string } | undefined
    return first?.email ?? null
  }
  return (profile as { email?: string }).email ?? null
}

function verdictDot(verdict: string | null) {
  return (
    {
      yes: "bg-emerald-500",
      no: "bg-rose-400",
      maybe: "bg-amber-400",
    }[verdict ?? ""] ?? "bg-slate-400"
  )
}

function SectionHeader({ title, count }: { title: string; count: string }) {
  return (
    <div className="flex items-baseline justify-between mb-4">
      <h2 className="font-[family-name:var(--font-serif)] text-2xl text-blue-950">{title}</h2>
      <span className="text-xs font-medium text-slate-600 uppercase tracking-wider">{count}</span>
    </div>
  )
}

function Tile({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-white/70 bg-white/65 backdrop-blur-xl p-5 shadow-[0_8px_28px_-18px_rgba(30,58,138,0.22)] transition hover:bg-white/80 relative",
        className,
      )}
    >
      {children}
    </div>
  )
}

function PillarBody({
  tone,
  icon,
  name,
  value,
  unit,
  secondary,
}: {
  tone: "slate" | "amber"
  icon: React.ReactNode
  name: string
  value: string
  unit: string
  secondary: string
}) {
  const toneBg = {
    slate: "bg-slate-100 text-slate-900",
    amber: "bg-amber-100 text-amber-900",
  }[tone]
  return (
    <div className="flex flex-col h-full gap-3">
      <div className="flex items-center gap-2">
        <div className={cn("rounded-xl p-1.5", toneBg)}>{icon}</div>
        <div className="text-[11px] uppercase tracking-[0.2em] font-semibold text-slate-700">
          {name}
        </div>
      </div>
      <div>
        <div className="flex items-baseline gap-1.5">
          <span className="font-semibold text-2xl text-slate-900 tabular-nums leading-none">
            {value}
          </span>
          <span className="text-xs text-slate-600">{unit}</span>
        </div>
        <div className="text-xs text-slate-600 mt-1.5">{secondary}</div>
      </div>
    </div>
  )
}

function ProgressRing({
  percent,
  size = 160,
  stroke = 8,
}: {
  percent: number
  size?: number
  stroke?: number
}) {
  const r = (size - stroke) / 2
  const circ = 2 * Math.PI * r
  const offset = circ - (percent / 100) * circ
  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        stroke="rgba(148,163,184,0.25)"
        strokeWidth={stroke}
        fill="none"
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        stroke="#2340d9"
        strokeWidth={stroke}
        fill="none"
        strokeDasharray={circ}
        strokeDashoffset={offset}
        strokeLinecap="round"
        className="transition-all"
      />
    </svg>
  )
}

function Sparkline({
  values,
  className,
  stroke,
  fill,
}: {
  values: number[]
  className?: string
  stroke: string
  fill: string
}) {
  const hasData = values.some((v) => v > 0)
  const max = Math.max(...values, 1)
  const min = Math.min(...values)
  const w = 100
  const h = 30
  const step = w / Math.max(1, values.length - 1)
  const points = values.map((v, i) => {
    const x = i * step
    const y = h - ((v - min) / (max - min || 1)) * h
    return [x, y] as const
  })
  const line = points
    .map(([x, y], i) => `${i === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`)
    .join(" ")
  const area = `${line} L ${w} ${h} L 0 ${h} Z`
  if (!hasData) {
    return (
      <div className={cn("w-full text-xs text-slate-500 italic flex items-end", className)}>
        No submission activity in the last {values.length} days.
      </div>
    )
  }
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className={className}>
      <path d={area} fill={fill} />
      <path
        d={line}
        fill="none"
        stroke={stroke}
        strokeWidth={1.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {points.map(([x, y], i) => (
        <circle
          key={i}
          cx={x}
          cy={y}
          r={i === points.length - 1 ? 1.6 : 0.8}
          fill={stroke}
        />
      ))}
    </svg>
  )
}
