import Link from "next/link"
import { Shrikhand, Instrument_Serif } from "next/font/google"
import {
  AlertCircle,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Mail,
  Mic2,
  Sparkles,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

const shrikhand = Shrikhand({ subsets: ["latin"], weight: "400" })
const serif = Instrument_Serif({ subsets: ["latin"], weight: "400", style: ["normal", "italic"] })

const FESTIVAL = {
  name: "Swear Jar Jamboree",
  tagline: "Indie Comedy + Improv Fest · Philadelphia",
  start: new Date("2026-07-09T19:00:00-04:00"),
  end: new Date("2026-07-12T23:00:00-04:00"),
  phaseLabel: "Submissions open",
  phaseNext: "Judging",
}

const MOCK = {
  totalSubmissions: 142,
  acts: 87,
  volunteers: 42,
  workshops: 13,
  totalJudged: 12,
  unjudged: 75,
  budgetUsed: 2400,
  budgetTotal: 8000,
  ticketSales: 0,
  ticketGoal: 1200,
}

const SUBMISSION_TREND = [3, 5, 4, 8, 12, 9, 14, 11, 18, 22, 17, 19, 24, 31, 28] // last 15 days

const RECENT_ACTIVITY = [
  { id: 1, actor: "Gabs", text: "verdict · yes · Harold Team B", when: "2h", tone: "yes" },
  { id: 2, actor: "Alex", text: "verdict · maybe · Office Hours", when: "5h", tone: "maybe" },
  { id: 3, actor: "Gabs", text: "verdict · no · Two Dumb Guys", when: "1d", tone: "no" },
  { id: 4, actor: "Jordan", text: "verdict · yes · Longform Showcase", when: "1d", tone: "yes" },
  { id: 5, actor: "Gabs", text: "imported 12 new acts", when: "2d", tone: "neutral" },
] as const

function daysUntil(date: Date) {
  return Math.max(0, Math.ceil((date.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
}

function formatDateRange(start: Date, end: Date) {
  const month = start.toLocaleDateString("en-US", { month: "long" })
  return `${month} ${start.getDate()}–${end.getDate()}, ${start.getFullYear()}`
}

export default function AiryBentoPage() {
  const days = daysUntil(FESTIVAL.start)
  const judgingPct = Math.round((MOCK.totalJudged / MOCK.acts) * 100)
  const budgetPct = Math.round((MOCK.budgetUsed / MOCK.budgetTotal) * 100)

  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-b from-sky-100 via-white to-sky-50 text-slate-800">
      {/* ambient */}
      <div className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 h-[520px] w-[900px] rounded-full bg-gradient-to-br from-sky-200/55 via-blue-200/35 to-white/0 blur-3xl" />
      <div className="pointer-events-none absolute top-[40%] -left-40 h-[380px] w-[380px] rounded-full bg-blue-300/15 blur-3xl" />
      <div className="pointer-events-none absolute top-[20%] -right-40 h-[380px] w-[380px] rounded-full bg-cyan-200/25 blur-3xl" />

      <header className="sticky top-4 z-40 px-4">
        <div className="mx-auto max-w-6xl flex items-center justify-between rounded-full border border-white/70 bg-white/80 backdrop-blur-xl px-5 py-2 shadow-[0_4px_20px_rgb(15,23,42,0.05)]">
          <span className={cn("text-xl text-[#1e3aa8] tracking-wide leading-none translate-y-[1px]", shrikhand.className)}>
            Jamboree
          </span>
          <nav className="hidden md:flex items-center gap-0.5 text-sm font-medium">
            {["Dashboard", "Submissions", "Judge", "Upload", "Analysis", "Settings"].map((label, i) => (
              <span key={label} className={cn("px-3.5 py-1.5 rounded-full", i === 0 ? "bg-blue-950 text-white" : "text-slate-700 hover:text-slate-950 hover:bg-slate-100/60")}>
                {label}
              </span>
            ))}
          </nav>
          <span className="text-xs text-slate-600 hidden sm:inline font-medium">gabandgoof@gmail.com</span>
        </div>
      </header>

      <div className="relative mx-auto max-w-6xl px-4 py-10 space-y-10">
        <div className="rounded-md border border-dashed border-slate-300/50 bg-white/40 backdrop-blur px-3 py-1.5 text-[11px] text-slate-600 inline-flex">
          Preview · airy · <span className="px-1 font-medium">bento</span> · <Link href="/preview" className="underline underline-offset-2 ml-1">all variants</Link>
        </div>

        {/* HERO BENTO — 12-col grid, varied tile sizes */}
        <section className="grid grid-cols-12 auto-rows-[minmax(140px,auto)] gap-3">
          {/* wordmark hero — 7 cols, 2 rows */}
          <Tile className="col-span-12 lg:col-span-7 row-span-2 !p-0 overflow-hidden">
            <div className="relative h-full p-7 flex flex-col justify-between bg-gradient-to-br from-white/60 via-white/40 to-sky-100/50">
              <div>
                <p className="text-[11px] tracking-[0.3em] text-blue-900 uppercase font-semibold mb-4">
                  {FESTIVAL.tagline}
                </p>
                <h1 className={cn("text-[3.5rem] md:text-[5.5rem] leading-[0.9] tracking-tight text-blue-950", serif.className)}>
                  Swear Jar <br />
                  <span className={cn("italic text-[#2340d9]", serif.className)}>Jamboree</span>
                </h1>
              </div>
              <div className="flex items-center gap-3 text-sm text-slate-700">
                <CalendarDays className="h-4 w-4 text-slate-500" />
                <span className={cn("italic text-lg", serif.className)}>{formatDateRange(FESTIVAL.start, FESTIVAL.end)}</span>
              </div>
              {/* soft decorative dots */}
              <svg className="absolute -right-10 -bottom-10 w-64 h-64 opacity-40" viewBox="0 0 200 200" fill="none">
                <circle cx="100" cy="100" r="80" stroke="#2340d9" strokeWidth="0.5" strokeDasharray="2 6" />
                <circle cx="100" cy="100" r="50" stroke="#2340d9" strokeWidth="0.5" strokeDasharray="2 6" />
                <circle cx="100" cy="100" r="25" stroke="#2340d9" strokeWidth="0.5" strokeDasharray="2 6" />
              </svg>
            </div>
          </Tile>

          {/* countdown ring */}
          <Tile className="col-span-6 lg:col-span-3 row-span-2">
            <div className="flex flex-col h-full justify-between">
              <div className="text-[11px] uppercase tracking-[0.22em] font-semibold text-slate-600">
                Time to kickoff
              </div>
              <div className="relative flex-1 flex items-center justify-center">
                <ProgressRing percent={Math.min(100, ((365 - days) / 365) * 100)} size={160} stroke={8} />
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

          {/* phase */}
          <Tile className="col-span-6 lg:col-span-2">
            <div className="flex flex-col h-full justify-between gap-3">
              <div className="text-[11px] uppercase tracking-[0.22em] font-semibold text-slate-600">Phase</div>
              <div className="flex items-center gap-2.5">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-70" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
                </span>
                <div className="text-sm font-semibold text-slate-900 leading-tight">{FESTIVAL.phaseLabel}</div>
              </div>
              <div className="text-xs text-slate-600">next → {FESTIVAL.phaseNext}</div>
            </div>
          </Tile>

          {/* judging progress */}
          <Tile className="col-span-6 lg:col-span-2">
            <div className="flex flex-col h-full justify-between gap-2">
              <div className="text-[11px] uppercase tracking-[0.22em] font-semibold text-slate-600">Judging</div>
              <div className="flex items-center gap-3">
                <ProgressRing percent={judgingPct} size={52} stroke={5} />
                <div>
                  <div className="font-semibold text-slate-900 leading-none tabular-nums text-lg">{MOCK.totalJudged}/{MOCK.acts}</div>
                  <div className="text-xs text-slate-600 mt-0.5">acts judged</div>
                </div>
              </div>
              <Link href="#" className="text-xs font-semibold text-[#2340d9] inline-flex items-center gap-1 hover:underline">
                Enter judging <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </Tile>
        </section>

        {/* ATTENTION ROW — large + small tiles */}
        <section>
          <SectionHeader title="Needs your attention" count="3 items" />
          <div className="grid grid-cols-12 gap-3">
            <Tile tone="blue" className="col-span-12 md:col-span-6 lg:col-span-5">
              <div className="flex items-start gap-4">
                <div className="rounded-xl p-2.5 bg-blue-100 text-blue-900 shrink-0">
                  <Mic2 className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] uppercase tracking-[0.22em] font-semibold text-blue-900 mb-1">Judging</div>
                  <h3 className={cn("text-2xl text-blue-950 leading-tight", serif.className)}>
                    <span className="tabular-nums">{MOCK.unjudged}</span> unjudged submissions
                  </h3>
                  <p className="text-sm text-slate-700 mt-1.5">Clear the queue with keyboard shortcuts.</p>
                  <Link href="#" className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-[#2340d9] hover:underline">
                    Enter judging mode <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            </Tile>
            <Tile className="col-span-12 md:col-span-6 lg:col-span-4" stub>
              <ActionBlock tone="sky" icon={<Mail className="h-4 w-4" />} kicker="Comms" title="Volunteer kickoff email" subtitle="Draft · scheduled in 3 days" />
            </Tile>
            <Tile className="col-span-12 md:col-span-12 lg:col-span-3" stub>
              <ActionBlock tone="rose" icon={<AlertCircle className="h-4 w-4" />} kicker="Financials" title="Venue deposit due" subtitle="$500 · by May 1" />
            </Tile>
          </div>
        </section>

        {/* PILLARS — asymmetric bento */}
        <section>
          <SectionHeader title="Festival pillars" count="5 areas" />
          <div className="grid grid-cols-12 auto-rows-[minmax(150px,auto)] gap-3">
            {/* Talent spans wide + tall with sparkline */}
            <Tile tone="blue" className="col-span-12 lg:col-span-6 row-span-2">
              <div className="flex flex-col h-full gap-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div className="rounded-xl p-1.5 bg-blue-100 text-blue-900">
                      <Sparkles className="h-4 w-4" />
                    </div>
                    <div className="text-[11px] uppercase tracking-[0.2em] font-semibold text-slate-700">Talent</div>
                  </div>
                  <div className="text-xs text-slate-600 inline-flex items-center gap-1">
                    <TrendingUp className="h-3 w-3 text-emerald-600" />
                    <span>+18 this week</span>
                  </div>
                </div>
                <div>
                  <div className="flex items-baseline gap-2">
                    <div className="font-semibold text-5xl text-slate-900 tabular-nums leading-none">
                      {MOCK.totalSubmissions}
                    </div>
                    <div className={cn("italic text-xl text-slate-700", serif.className)}>submissions</div>
                  </div>
                  <div className="text-sm text-slate-600 mt-2">
                    <span className="tabular-nums font-medium text-slate-800">{MOCK.acts}</span> acts ·{" "}
                    <span className="tabular-nums font-medium text-slate-800">{MOCK.volunteers}</span> vols ·{" "}
                    <span className="tabular-nums font-medium text-slate-800">{MOCK.workshops}</span> wksps
                  </div>
                </div>
                <div className="flex-1 flex items-end">
                  <Sparkline values={SUBMISSION_TREND} className="w-full h-16" stroke="#2340d9" fill="rgba(35,64,217,0.08)" />
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-500 font-medium">
                  <span>15 days ago</span>
                  <span>today</span>
                </div>
              </div>
            </Tile>

            {/* Comms */}
            <Tile className="col-span-12 md:col-span-6 lg:col-span-3" stub>
              <PillarBody tone="sky" icon={<Mail className="h-4 w-4" />} name="Comms" value="2" unit="drafts" secondary="Next send in 3d" />
            </Tile>

            {/* Production */}
            <Tile className="col-span-12 md:col-span-6 lg:col-span-3" stub>
              <PillarBody tone="cyan" icon={<CalendarDays className="h-4 w-4" />} name="Production" value="4" unit="shows" secondary="0 of 4 booked" />
            </Tile>

            {/* Financials with progress bar */}
            <Tile className="col-span-12 md:col-span-6 lg:col-span-3" stub>
              <div className="flex flex-col h-full gap-2">
                <div className="flex items-center gap-2">
                  <div className="rounded-xl p-1.5 bg-emerald-100 text-emerald-900">
                    <Wallet className="h-4 w-4" />
                  </div>
                  <div className="text-[11px] uppercase tracking-[0.2em] font-semibold text-slate-700">Financials</div>
                </div>
                <div className="flex items-baseline gap-1.5 mt-1">
                  <span className="font-semibold text-2xl text-slate-900 tabular-nums leading-none">$2.4k</span>
                  <span className="text-xs text-slate-600">of $8k</span>
                </div>
                <div className="mt-2">
                  <div className="h-1.5 rounded-full bg-emerald-100/80 overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${budgetPct}%` }} />
                  </div>
                  <div className="text-xs text-slate-600 mt-1.5">{budgetPct}% of budget used</div>
                </div>
              </div>
            </Tile>

            {/* Ops */}
            <Tile className="col-span-12 md:col-span-6 lg:col-span-3">
              <PillarBody tone="slate" icon={<Users className="h-4 w-4" />} name="Ops" value="8" unit="members" secondary="2 invites pending" />
            </Tile>
          </div>
        </section>

        {/* ACTIVITY + STAT MOMENT */}
        <section className="grid grid-cols-12 gap-3">
          <Tile className="col-span-12 lg:col-span-8">
            <div className="flex items-baseline justify-between mb-4">
              <h2 className={cn("text-2xl text-blue-950", serif.className)}>Team activity</h2>
              <Link href="#" className="text-xs font-semibold text-[#2340d9] hover:underline">View all →</Link>
            </div>
            <ul className="divide-y divide-slate-200/60 text-sm -mx-1">
              {RECENT_ACTIVITY.map((a) => (
                <li key={a.id} className="px-1 py-3 flex items-center gap-3">
                  <span className={cn("h-2 w-2 rounded-full shrink-0", verdictDot(a.tone))} />
                  <div className="flex-1 min-w-0 flex items-center justify-between gap-3">
                    <div className="truncate">
                      <span className="font-semibold text-slate-900">{a.actor}</span>{" "}
                      <span className="text-slate-700">{a.text}</span>
                    </div>
                    <div className="text-xs text-slate-500 tabular-nums">{a.when}</div>
                  </div>
                </li>
              ))}
            </ul>
          </Tile>

          <Tile className="col-span-12 lg:col-span-4 bg-gradient-to-br from-blue-950 via-blue-900 to-[#2340d9] !border-transparent text-white">
            <div className="flex flex-col h-full justify-between gap-5">
              <div className="text-[11px] uppercase tracking-[0.22em] font-semibold text-blue-200">
                Ticket goal
              </div>
              <div>
                <div className="flex items-baseline gap-2">
                  <span className="font-mono font-semibold text-5xl tabular-nums leading-none">
                    {MOCK.ticketSales}
                  </span>
                  <span className={cn("italic text-xl text-blue-200", serif.className)}>
                    / {MOCK.ticketGoal}
                  </span>
                </div>
                <div className="text-sm text-blue-200/90 mt-2">tickets sold · not yet on sale</div>
              </div>
              <div>
                <div className="h-1.5 rounded-full bg-white/15 overflow-hidden">
                  <div className="h-full bg-white/70 rounded-full" style={{ width: `2%` }} />
                </div>
                <div className="text-xs text-blue-200/90 mt-2 inline-flex items-center gap-1">
                  <span>On-sale target: May 15</span>
                  <ArrowUpRight className="h-3 w-3" />
                </div>
              </div>
            </div>
          </Tile>
        </section>
      </div>
    </div>
  )
}

function verdictDot(tone: string) {
  return { yes: "bg-emerald-500", no: "bg-rose-400", maybe: "bg-amber-400", neutral: "bg-slate-400" }[tone] ?? "bg-slate-400"
}

function SectionHeader({ title, count }: { title: string; count: string }) {
  return (
    <div className="flex items-baseline justify-between mb-4">
      <h2 className={cn("text-2xl text-blue-950", serif.className)}>{title}</h2>
      <span className="text-xs font-medium text-slate-600 uppercase tracking-wider">{count}</span>
    </div>
  )
}

function Tile({ children, className, tone, stub }: {
  children: React.ReactNode
  className?: string
  tone?: "blue"
  stub?: boolean
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-white/70 bg-white/65 backdrop-blur-xl p-5 shadow-[0_8px_28px_-18px_rgba(30,58,138,0.22)] transition hover:bg-white/80 relative",
        tone === "blue" && "bg-white/70",
        stub && "opacity-95",
        className,
      )}
    >
      {stub && <Badge variant="outline" className="absolute top-3 right-3 text-[10px] font-medium border-slate-300/60 text-slate-500">stub</Badge>}
      {children}
    </div>
  )
}

function ActionBlock({ tone, icon, kicker, title, subtitle }: {
  tone: "sky" | "rose"
  icon: React.ReactNode
  kicker: string
  title: string
  subtitle: string
}) {
  const toneBg = { sky: "bg-sky-100 text-sky-900", rose: "bg-rose-100 text-rose-900" }[tone]
  return (
    <div className="flex flex-col h-full justify-between gap-3">
      <div className="flex items-center gap-2">
        <div className={cn("rounded-xl p-1.5", toneBg)}>{icon}</div>
        <div className="text-[11px] uppercase tracking-[0.22em] font-semibold text-slate-700">{kicker}</div>
      </div>
      <div>
        <h3 className={cn("text-xl text-blue-950 leading-tight", serif.className)}>{title}</h3>
        <p className="text-sm text-slate-600 mt-1">{subtitle}</p>
      </div>
    </div>
  )
}

function PillarBody({ tone, icon, name, value, unit, secondary }: {
  tone: "sky" | "cyan" | "slate"
  icon: React.ReactNode
  name: string
  value: string
  unit: string
  secondary: string
}) {
  const toneBg = { sky: "bg-sky-100 text-sky-900", cyan: "bg-cyan-100 text-cyan-900", slate: "bg-slate-100 text-slate-900" }[tone]
  return (
    <div className="flex flex-col h-full gap-3">
      <div className="flex items-center gap-2">
        <div className={cn("rounded-xl p-1.5", toneBg)}>{icon}</div>
        <div className="text-[11px] uppercase tracking-[0.2em] font-semibold text-slate-700">{name}</div>
      </div>
      <div>
        <div className="flex items-baseline gap-1.5">
          <span className="font-semibold text-2xl text-slate-900 tabular-nums leading-none">{value}</span>
          <span className="text-xs text-slate-600">{unit}</span>
        </div>
        <div className="text-xs text-slate-600 mt-1.5">{secondary}</div>
      </div>
    </div>
  )
}

function ProgressRing({ percent, size = 160, stroke = 8 }: { percent: number; size?: number; stroke?: number }) {
  const r = (size - stroke) / 2
  const circ = 2 * Math.PI * r
  const offset = circ - (percent / 100) * circ
  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(148,163,184,0.25)" strokeWidth={stroke} fill="none" />
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

function Sparkline({ values, className, stroke, fill }: {
  values: number[]
  className?: string
  stroke: string
  fill: string
}) {
  const max = Math.max(...values)
  const min = Math.min(...values)
  const w = 100
  const h = 30
  const step = w / (values.length - 1)
  const points = values.map((v, i) => {
    const x = i * step
    const y = h - ((v - min) / (max - min || 1)) * h
    return [x, y] as const
  })
  const line = points.map(([x, y], i) => `${i === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`).join(" ")
  const area = `${line} L ${w} ${h} L 0 ${h} Z`
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className={className}>
      <path d={area} fill={fill} />
      <path d={line} fill="none" stroke={stroke} strokeWidth={1.2} strokeLinecap="round" strokeLinejoin="round" />
      {points.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={i === points.length - 1 ? 1.6 : 0.8} fill={stroke} />
      ))}
    </svg>
  )
}
