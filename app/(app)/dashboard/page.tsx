import Link from "next/link"
import {
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  CalendarRange,
  CheckSquare,
  Clapperboard,
  FileText,
  LayoutGrid,
  Mail,
  Send,
  Sparkles,
  TrendingUp,
  Users,
} from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { cn } from "@/lib/utils"
import { nextPhase, resolveCurrentPhase, type Phase } from "@/lib/phases"
import { classify } from "@/lib/lineup-tiers"
import { getActDisplayName } from "@/lib/solo-act"
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

type FeedKind = "email" | "placement" | "programming"
type FeedEvent = {
  key: string
  kind: FeedKind
  actName: string
  detail: string
  at: string
}

// Supabase nested selects type a to-one relation as either an object or a
// single-element array depending on inference — normalize both to one row.
function firstRel<T>(rel: T | T[] | null | undefined): T | null {
  if (!rel) return null
  return Array.isArray(rel) ? (rel[0] ?? null) : rel
}

function formatBlockDay(day: string): string {
  const d = new Date(`${day}T00:00:00`)
  if (Number.isNaN(d.getTime())) return day
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })
}

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ""
  const diffMs = Date.now() - then
  const mins = Math.round(diffMs / 60000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.round(hrs / 24)
  if (days < 7) return `${days}d ago`
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" })
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
    { data: profilesData, count: profilesCount },
    { data: phaseRow },
    { data: phases },
    { data: notes },
    { count: openTasksCount },
    { count: totalTasksCount },
    { count: lineupUnsortedCount },
    { count: lineupTotalCount },
    { count: documentsCount },
    { data: actVerdictRows },
    { data: emailEventRows },
    { data: placementEventRows },
    { data: programmingEventRows },
    { data: progDraft },
  ] = await Promise.all([
    supabase
      .from("submissions")
      .select("id, type, submitted_at")
      .is("deleted_at", null),
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
    // Act consensus tiers — used to find "locked" (Team yes) acts that still
    // need a first outreach email.
    supabase
      .from("submission_verdict_counts")
      .select("submission_id, yes_count, no_count, maybe_count, total_judgments")
      .eq("type", "act"),
    // Recent-actions feed source 1: acts whose first outreach email was sent.
    supabase
      .from("submissions")
      .select("id, name, email, data, first_emailed_at, first_emailed_by")
      .not("first_emailed_at", "is", null)
      .is("deleted_at", null)
      .order("first_emailed_at", { ascending: false })
      .limit(8),
    // Source 2: acts placed into a board column (column_id set).
    supabase
      .from("lineup_cards")
      .select("submission_id, updated_at, lineup_columns(title)")
      .not("column_id", "is", null)
      .order("updated_at", { ascending: false })
      .limit(8),
    // Source 3: acts slotted into a programming show block.
    supabase
      .from("show_block_submissions")
      .select("submission_id, created_at, show_blocks(title, day)")
      .order("created_at", { ascending: false })
      .limit(8),
    // Programming readiness: the active draft (published preferred, else most
    // recently updated). Block fill is resolved in the second batch below.
    supabase
      .from("programming_drafts")
      .select("id")
      .order("is_published", { ascending: false })
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  const counts = { act: 0, volunteer: 0, workshop: 0 }
  for (const s of submissions ?? []) {
    if (s.type in counts) counts[s.type as keyof typeof counts]++
  }
  const totalSubmissions = (submissions ?? []).length
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

  // ---- Act-management triage ----------------------------------------------
  // "Locked" = team-yes consensus (2+ yes, 0 no). These acts are ready for
  // outreach; the tile surfaces how many still have no first email sent.
  const lockedActIds = (actVerdictRows ?? [])
    .filter(
      (r) =>
        r.submission_id &&
        classify({
          yes_count: r.yes_count ?? 0,
          no_count: r.no_count ?? 0,
          maybe_count: r.maybe_count ?? 0,
          total_judgments: r.total_judgments ?? 0,
        }) === "locked",
    )
    .map((r) => r.submission_id as string)

  // Submission ids referenced by the placement / programming feed sources, so
  // we can resolve display names in a single round-trip.
  const feedSubIds = Array.from(
    new Set([
      ...(placementEventRows ?? []).map((r) => r.submission_id),
      ...(programmingEventRows ?? []).map((r) => r.submission_id),
    ]),
  )
  const emailerIds = Array.from(
    new Set(
      (emailEventRows ?? [])
        .map((r) => r.first_emailed_by)
        .filter((v): v is string => v !== null),
    ),
  )

  const [
    { count: actsToEmailCount },
    { data: feedSubs },
    { data: emailerProfiles },
    { data: progBlocks },
  ] = await Promise.all([
    lockedActIds.length > 0
      ? supabase
          .from("submissions")
          .select("id", { count: "exact", head: true })
          .in("id", lockedActIds)
          .is("first_emailed_at", null)
          .is("deleted_at", null)
      : Promise.resolve({ count: 0 }),
    feedSubIds.length > 0
      ? supabase
          .from("submissions")
          .select("id, name, email, data")
          .in("id", feedSubIds)
          .is("deleted_at", null)
      : Promise.resolve({
          data: [] as Array<{
            id: string
            name: string | null
            email: string | null
            data: unknown
          }>,
        }),
    emailerIds.length > 0
      ? supabase.from("profiles").select("id, full_name, email").in("id", emailerIds)
      : Promise.resolve({
          data: [] as Array<{
            id: string
            full_name: string | null
            email: string | null
          }>,
        }),
    progDraft
      ? supabase.from("show_blocks").select("id, kind").eq("draft_id", progDraft.id)
      : Promise.resolve({
          data: [] as Array<{ id: string; kind: string }>,
        }),
  ])

  const actsToEmail = actsToEmailCount ?? 0

  // Programming readiness against the active draft. A show block (kind=show, or
  // any block that isn't a workshop/event) with no acts assigned still "needs
  // acts"; a workshop block with nothing assigned is "unbooked". Event blocks
  // carry no submissions, so they're excluded from both counts.
  const progBlockList = progBlocks ?? []
  let showsNeedingActs = 0
  let workshopsUnbooked = 0
  if (progBlockList.length > 0) {
    const { data: progTags } = await supabase
      .from("show_block_submissions")
      .select("block_id")
      .in(
        "block_id",
        progBlockList.map((b) => b.id),
      )
    const filledBlocks = new Set((progTags ?? []).map((t) => t.block_id))
    for (const b of progBlockList) {
      if (filledBlocks.has(b.id)) continue
      if (b.kind === "workshop") workshopsUnbooked++
      else if (b.kind !== "event") showsNeedingActs++
    }
  }

  const displayNameById = new Map<string, string>()
  for (const s of [...(emailEventRows ?? []), ...(feedSubs ?? [])]) {
    displayNameById.set(
      s.id,
      getActDisplayName({
        name: s.name,
        data: (s.data as Record<string, unknown>) ?? null,
        email: s.email,
      }).display,
    )
  }
  const emailerNameById = new Map<string, string>()
  for (const p of emailerProfiles ?? []) {
    emailerNameById.set(p.id, p.full_name ?? p.email ?? "Teammate")
  }

  // Merge the three non-verdict activity sources into one recency-sorted feed.
  const feed: FeedEvent[] = []
  for (const s of emailEventRows ?? []) {
    if (!s.first_emailed_at) continue
    const by = s.first_emailed_by ? emailerNameById.get(s.first_emailed_by) : null
    feed.push({
      key: `email-${s.id}`,
      kind: "email",
      actName: displayNameById.get(s.id) ?? s.name ?? "An act",
      detail: by ? `Outreach email sent by ${by}` : "Outreach email sent",
      at: s.first_emailed_at,
    })
  }
  for (const r of placementEventRows ?? []) {
    // Skip cards whose act was deleted (no resolved display name).
    const actName = displayNameById.get(r.submission_id)
    if (!actName) continue
    const col = firstRel<{ title: string | null }>(r.lineup_columns)?.title?.trim()
    feed.push({
      key: `place-${r.submission_id}-${r.updated_at}`,
      kind: "placement",
      actName,
      detail: col ? `Placed in “${col}” on the board` : "Moved on the board",
      at: r.updated_at,
    })
  }
  for (const r of programmingEventRows ?? []) {
    const actName = displayNameById.get(r.submission_id)
    if (!actName) continue
    const block = firstRel<{ title: string | null; day: string | null }>(r.show_blocks)
    const label =
      block?.title?.trim() ||
      (block?.day ? `the ${formatBlockDay(block.day)} show` : "a show block")
    feed.push({
      key: `prog-${r.submission_id}-${r.created_at}`,
      kind: "programming",
      actName,
      detail: `Slotted into ${label}`,
      at: r.created_at,
    })
  }
  feed.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
  const recentActions = feed.slice(0, 6)

  const days = daysUntil(FESTIVAL.start)
  const phaseList: Phase[] = phases ?? []
  const phase = resolveCurrentPhase(phaseList, phaseRow?.phase)
  const upcomingPhase = nextPhase(phaseList, phase.key)
  const ticketPct = Math.round((TICKET_STUBS.ticketSales / TICKET_STUBS.ticketGoal) * 100)
  // The countdown ring visualises "time elapsed in the 365-day lead-up" — capped 0..100.
  const countdownPct = Math.min(100, Math.max(0, ((365 - days) / 365) * 100))

  return (
    <div className="space-y-10">
      {/* SLIM HERO STRIP — brand on the left, festival meta on the right */}
      <section className="flex flex-wrap items-center justify-between gap-6">
        <div className="min-w-0">
          <p className="text-[11px] tracking-[0.3em] text-blue-900 uppercase font-semibold mb-2">
            {FESTIVAL.tagline}
          </p>
          <h1 className="font-[family-name:var(--font-serif)] text-4xl sm:text-5xl text-blue-950 leading-[1.05]">
            Swear Jar{" "}
            <span className="italic text-brand">Jamboree</span>
          </h1>
          <div className="flex items-center gap-2 text-sm text-slate-700 mt-3">
            <CalendarDays className="h-4 w-4 text-slate-500" aria-hidden="true" />
            <span className="font-[family-name:var(--font-serif)] italic text-base">
              {formatDateRange(FESTIVAL.start, FESTIVAL.end)}
            </span>
          </div>
        </div>
        <div className="flex items-stretch gap-3 shrink-0">
          <Tile className="!p-4 min-w-[160px]">
            <div className="flex items-center gap-3 h-full">
              <ProgressRing
                percent={countdownPct}
                size={56}
                stroke={5}
                ariaLabel={`${days} days until kickoff`}
              />
              <div>
                <div className="font-mono text-2xl tabular-nums font-semibold text-blue-950 leading-none">
                  {days}
                </div>
                <div className="text-[10px] uppercase tracking-[0.22em] font-semibold text-slate-600 mt-1">
                  days to kickoff
                </div>
              </div>
            </div>
          </Tile>
          <Tile className="!p-4 min-w-[160px]">
            <div className="flex flex-col justify-between h-full gap-2">
              <div className="text-[10px] uppercase tracking-[0.22em] font-semibold text-slate-600">
                Phase
              </div>
              <div className="flex items-center gap-2">
                <span
                  className="relative flex h-2.5 w-2.5"
                  aria-hidden="true"
                >
                  <span className="absolute inline-flex h-full w-full animate-ping motion-reduce:hidden rounded-full bg-emerald-400 opacity-70" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
                </span>
                <div className="text-sm font-semibold text-slate-900 leading-tight truncate">
                  {phase.label}
                </div>
              </div>
              <div className="text-xs text-slate-600">
                next → {upcomingPhase?.short ?? "—"}
              </div>
            </div>
          </Tile>
        </div>
      </section>

      {/* MAIN: real tiles on the left, notepad pinned to the right */}
      <div className="grid grid-cols-12 gap-6 items-stretch">
        <div className="col-span-12 lg:col-span-8 space-y-10">
          {/* ATTENTION */}
          <section>
            <SectionHeader title="Needs your attention" count="4 items" />
            <div className="grid grid-cols-12 gap-3">
              <Tile className="col-span-12 sm:col-span-6 lg:col-span-3 !p-4">
                <Link href="/lineup?type=act&filter=team_yes" className="flex flex-col h-full gap-2 group rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50 focus-visible:ring-offset-2 focus-visible:ring-offset-white/80">
                  <div className="flex items-center gap-2">
                    <div className="rounded-xl p-1.5 bg-blue-100 text-blue-900">
                      <Mail className="h-4 w-4" />
                    </div>
                    <div className="text-[10px] uppercase tracking-[0.22em] font-semibold text-blue-900">
                      Outreach
                    </div>
                  </div>
                  <h3 className="font-[family-name:var(--font-serif)] text-xl text-blue-950 leading-tight mt-1">
                    <span className="tabular-nums">{actsToEmail}</span> to email next
                  </h3>
                  <p className="text-xs text-slate-600">
                    {actsToEmail > 0
                      ? "Team-yes acts with no first email yet."
                      : "Every team-yes act has been emailed."}
                  </p>
                  <span className="mt-auto inline-flex items-center gap-1 text-xs font-semibold text-brand group-hover:underline">
                    Open outreach <ArrowRight className="h-3 w-3" />
                  </span>
                </Link>
              </Tile>
              <Tile className="col-span-12 sm:col-span-6 lg:col-span-3 !p-4">
                <Link href="/tasks" className="flex flex-col h-full gap-2 group rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50 focus-visible:ring-offset-2 focus-visible:ring-offset-white/80">
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
                  <span className="mt-auto inline-flex items-center gap-1 text-xs font-semibold text-brand group-hover:underline">
                    Open tasks <ArrowRight className="h-3 w-3" />
                  </span>
                </Link>
              </Tile>
              <Tile className="col-span-12 sm:col-span-6 lg:col-span-3 !p-4">
                <Link href="/lineup" className="flex flex-col h-full gap-2 group rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50 focus-visible:ring-offset-2 focus-visible:ring-offset-white/80">
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
                  <span className="mt-auto inline-flex items-center gap-1 text-xs font-semibold text-brand group-hover:underline">
                    Open board <ArrowRight className="h-3 w-3" />
                  </span>
                </Link>
              </Tile>
              <Tile className="col-span-12 sm:col-span-6 lg:col-span-3 !p-4">
                <Link href="/production/programming" className="flex flex-col h-full gap-2 group rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50 focus-visible:ring-offset-2 focus-visible:ring-offset-white/80">
                  <div className="flex items-center gap-2">
                    <div className="rounded-xl p-1.5 bg-violet-100 text-violet-900">
                      <Clapperboard className="h-4 w-4" />
                    </div>
                    <div className="text-[10px] uppercase tracking-[0.22em] font-semibold text-violet-900">
                      Programming
                    </div>
                  </div>
                  <h3 className="font-[family-name:var(--font-serif)] text-xl text-blue-950 leading-tight mt-1">
                    <span className="tabular-nums">{showsNeedingActs}</span>{" "}
                    {showsNeedingActs === 1 ? "show needs" : "shows need"} acts
                  </h3>
                  <p className="text-xs text-slate-600">
                    {workshopsUnbooked > 0
                      ? `${workshopsUnbooked} workshop${workshopsUnbooked === 1 ? "" : "s"} still unbooked.`
                      : "All workshops booked."}
                  </p>
                  <span className="mt-auto inline-flex items-center gap-1 text-xs font-semibold text-brand group-hover:underline">
                    Open programming <ArrowRight className="h-3 w-3" />
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
                <Link href="/submissions" className="flex flex-col h-full gap-4 group rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50 focus-visible:ring-offset-2 focus-visible:ring-offset-white/80">
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
                      stroke="oklch(0.46 0.21 264)"
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
                <Link href="/settings" className="flex flex-col h-full gap-2 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50 focus-visible:ring-offset-2 focus-visible:ring-offset-white/80">
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
                <Link href="/documents" className="flex flex-col h-full gap-2 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50 focus-visible:ring-offset-2 focus-visible:ring-offset-white/80">
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
                  Recent activity
                </h2>
                <Link
                  href="/lineup?type=act"
                  className="text-xs font-semibold text-brand hover:underline"
                >
                  Open lineup →
                </Link>
              </div>
              {recentActions.length > 0 ? (
                <ul className="divide-y divide-slate-200/60 text-sm -mx-1">
                  {recentActions.map((ev) => (
                    <li key={ev.key} className="px-1 py-3 flex items-center gap-3">
                      <span
                        className={cn(
                          "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg",
                          feedTone(ev.kind),
                        )}
                      >
                        <FeedIcon kind={ev.kind} />
                      </span>
                      <div className="flex-1 min-w-0 flex items-center justify-between gap-3">
                        <div className="truncate">
                          <span className="font-semibold text-slate-900">{ev.actName}</span>{" "}
                          <span className="text-slate-700">· {ev.detail}</span>
                        </div>
                        <div className="text-xs text-slate-500 tabular-nums shrink-0">
                          {relativeTime(ev.at)}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-slate-600 italic py-4">
                  No act-management activity yet. Email a team-yes act or place
                  one on the board to start the feed.
                </p>
              )}
            </Tile>

            <Tile className="col-span-12 sm:col-span-5 bg-gradient-to-br from-blue-950 via-blue-900 to-brand !border-transparent text-white">
              <div className="flex flex-col h-full justify-between gap-5">
                <div className="text-[11px] uppercase tracking-[0.22em] font-semibold text-blue-100">
                  Ticket goal
                </div>
                <div>
                  <div className="flex items-baseline gap-2">
                    <span className="font-mono font-semibold text-5xl tabular-nums leading-none">
                      {TICKET_STUBS.ticketSales}
                    </span>
                    <span className="font-[family-name:var(--font-serif)] italic text-xl text-blue-100">
                      / {TICKET_STUBS.ticketGoal}
                    </span>
                  </div>
                  <div className="text-sm text-blue-100 mt-2">
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
                  <div className="text-xs text-blue-100 mt-2 inline-flex items-center gap-1">
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

function feedTone(kind: FeedKind): string {
  return {
    email: "bg-blue-100 text-blue-900",
    placement: "bg-amber-100 text-amber-900",
    programming: "bg-emerald-100 text-emerald-900",
  }[kind]
}

function FeedIcon({ kind }: { kind: FeedKind }) {
  const cls = "h-3.5 w-3.5"
  if (kind === "email") return <Send className={cls} />
  if (kind === "placement") return <LayoutGrid className={cls} />
  return <CalendarRange className={cls} />
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
        "rounded-2xl border border-white/70 bg-white/80 backdrop-blur-xl p-5 shadow-tile transition hover:bg-white/90 relative",
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
  ariaLabel,
}: {
  percent: number
  size?: number
  stroke?: number
  ariaLabel?: string
}) {
  const r = (size - stroke) / 2
  const circ = 2 * Math.PI * r
  const offset = circ - (percent / 100) * circ
  return (
    <svg
      width={size}
      height={size}
      className="-rotate-90"
      role="img"
      aria-label={ariaLabel ?? `${Math.round(percent)} percent`}
    >
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
        stroke="oklch(0.46 0.21 264)"
        strokeWidth={stroke}
        fill="none"
        strokeDasharray={circ}
        strokeDashoffset={offset}
        strokeLinecap="round"
        className="transition-all motion-reduce:transition-none"
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
  const total = values.reduce((a, b) => a + b, 0)
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      className={className}
      role="img"
      aria-label={`Submission trend over the last ${values.length} days, ${total} total`}
    >
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
