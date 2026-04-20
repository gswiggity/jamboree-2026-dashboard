import Link from "next/link"
import { Shrikhand, Instrument_Serif } from "next/font/google"
import {
  AlertCircle,
  ArrowUpRight,
  CalendarDays,
  Mail,
  Mic2,
  Sparkles,
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
}

const RECENT_ACTIVITY = [
  { id: 1, actor: "Gabs", text: "cast verdict yes on Harold Team B", when: "2h ago", tone: "yes" },
  { id: 2, actor: "Alex", text: "cast verdict maybe on Office Hours", when: "5h ago", tone: "maybe" },
  { id: 3, actor: "Gabs", text: "cast verdict no on Two Dumb Guys", when: "yesterday", tone: "no" },
  { id: 4, actor: "Jordan", text: "cast verdict yes on Longform Showcase", when: "yesterday", tone: "yes" },
  { id: 5, actor: "Gabs", text: "imported 12 new acts", when: "2 days ago", tone: "neutral" },
] as const

function daysUntil(date: Date) {
  return Math.max(0, Math.ceil((date.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
}

function formatDateRange(start: Date, end: Date) {
  const month = start.toLocaleDateString("en-US", { month: "long" })
  return `${month} ${start.getDate()}–${end.getDate()}, ${start.getFullYear()}`
}

export default function AiryPolishPage() {
  const days = daysUntil(FESTIVAL.start)

  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-b from-sky-100 via-white to-sky-50 text-slate-800">
      {/* softer, more contained ambient glows */}
      <div className="pointer-events-none absolute -top-32 left-1/2 -translate-x-1/2 h-[420px] w-[820px] rounded-full bg-gradient-to-br from-sky-200/40 via-blue-200/25 to-white/0 blur-3xl" />
      <div className="pointer-events-none absolute top-[38%] -left-32 h-[320px] w-[320px] rounded-full bg-blue-300/10 blur-3xl" />
      <div className="pointer-events-none absolute top-[18%] -right-32 h-[320px] w-[320px] rounded-full bg-cyan-200/20 blur-3xl" />

      {/* Floating nav — pulled tighter, stronger contrast */}
      <header className="sticky top-4 z-40 px-4">
        <div className="mx-auto max-w-5xl flex items-center justify-between rounded-full border border-white/70 bg-white/80 backdrop-blur-xl px-5 py-2 shadow-[0_4px_20px_rgb(15,23,42,0.05)]">
          <span className={cn("text-xl text-[#1e3aa8] tracking-wide leading-none translate-y-[1px]", shrikhand.className)}>
            Jamboree
          </span>
          <nav className="hidden md:flex items-center gap-0.5 text-sm font-medium">
            {["Dashboard", "Submissions", "Judge", "Upload", "Analysis", "Settings"].map((label, i) => (
              <span
                key={label}
                className={cn(
                  "px-3.5 py-1.5 rounded-full transition",
                  i === 0
                    ? "bg-blue-950 text-white"
                    : "text-slate-700 hover:text-slate-950 hover:bg-slate-100/60",
                )}
              >
                {label}
              </span>
            ))}
          </nav>
          <span className="text-xs text-slate-600 hidden sm:inline font-medium">gabandgoof@gmail.com</span>
        </div>
      </header>

      <div className="relative mx-auto max-w-5xl px-4 py-12 space-y-16">
        <div className="rounded-md border border-dashed border-slate-300/50 bg-white/40 backdrop-blur px-3 py-1.5 text-[11px] text-slate-600 inline-flex">
          Preview · airy · <span className="px-1 font-medium">polish</span> · <Link href="/preview" className="underline underline-offset-2 ml-1">all variants</Link>
        </div>

        {/* HERO — single balanced row, clearer hierarchy */}
        <section className="relative text-center pt-4 pb-2">
          <p className="text-[11px] tracking-[0.32em] text-blue-900 uppercase font-semibold">
            {FESTIVAL.tagline}
          </p>
          <h1 className={cn("mt-4 text-6xl md:text-[7.5rem] leading-[0.92] tracking-tight text-blue-950", serif.className)}>
            Swear Jar <br className="md:hidden" />
            <span className={cn("italic text-[#2340d9]", serif.className)}>Jamboree</span>
          </h1>
          <p className={cn("mt-5 text-xl text-slate-800", serif.className)}>
            {formatDateRange(FESTIVAL.start, FESTIVAL.end)}
          </p>

          {/* Countdown redesigned: bigger number, clearer label, phase pill merged */}
          <div className="mt-10 inline-flex flex-wrap items-stretch rounded-2xl border border-white/80 bg-white/75 backdrop-blur-xl shadow-[0_16px_44px_-20px_rgba(30,58,138,0.3)] overflow-hidden">
            <div className="px-7 py-5 flex items-center gap-4">
              <span className="font-mono text-6xl md:text-7xl tabular-nums font-semibold text-blue-950 leading-none">
                {days}
              </span>
              <div className="text-left">
                <div className="text-[11px] uppercase tracking-[0.2em] font-semibold text-slate-700">Days to</div>
                <div className="text-[11px] uppercase tracking-[0.2em] font-semibold text-slate-700">Kickoff</div>
              </div>
            </div>
            <div className="border-l border-slate-200/70 px-6 py-5 flex items-center gap-2.5 bg-gradient-to-r from-white/0 to-sky-50">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-70" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
              </span>
              <div className="text-left">
                <div className="text-sm font-semibold text-slate-900">{FESTIVAL.phaseLabel}</div>
                <div className="text-xs text-slate-600">next → {FESTIVAL.phaseNext}</div>
              </div>
            </div>
          </div>
        </section>

        {/* NEEDS YOUR ATTENTION — larger heading, higher-contrast cards */}
        <section>
          <div className="flex items-baseline justify-between mb-5">
            <h2 className={cn("text-3xl text-blue-950", serif.className)}>Needs your attention</h2>
            <span className="text-xs font-medium text-slate-600 uppercase tracking-wider">3 items</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <ActionCard tone="blue" icon={<Mic2 className="h-4 w-4" />} title={`${MOCK.unjudged} unjudged submissions`} subtitle="Enter judging mode" linky />
            <ActionCard tone="sky" icon={<Mail className="h-4 w-4" />} title="Volunteer kickoff email" subtitle="Draft · scheduled in 3 days" stub />
            <ActionCard tone="rose" icon={<AlertCircle className="h-4 w-4" />} title="Venue deposit due" subtitle="$500 · by May 1" stub />
          </div>
        </section>

        {/* PILLARS — stronger numbers, clearer label position */}
        <section>
          <div className="flex items-baseline justify-between mb-5">
            <h2 className={cn("text-3xl text-blue-950", serif.className)}>Festival pillars</h2>
            <span className="text-xs font-medium text-slate-600 uppercase tracking-wider">5 areas</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <PillarCard tone="blue" icon={<Sparkles className="h-4 w-4" />} name="Talent" value={`${MOCK.totalSubmissions}`} unit="submissions" secondary={`${MOCK.acts} acts · ${MOCK.volunteers} vols · ${MOCK.workshops} wksps`} />
            <PillarCard tone="sky" icon={<Mail className="h-4 w-4" />} name="Comms" value="2" unit="drafts" secondary="Next send in 3d" stub />
            <PillarCard tone="cyan" icon={<CalendarDays className="h-4 w-4" />} name="Production" value="4" unit="shows" secondary="0 of 4 booked" stub />
            <PillarCard tone="emerald" icon={<Wallet className="h-4 w-4" />} name="Financials" value="$2.4k" unit="of $8k" secondary="30% of budget" stub />
            <PillarCard tone="slate" icon={<Users className="h-4 w-4" />} name="Ops" value="8" unit="members" secondary="2 invites pending" />
          </div>
        </section>

        {/* ACTIVITY — verdict-coloured dot, stronger typography */}
        <section>
          <div className="flex items-baseline justify-between mb-5">
            <h2 className={cn("text-3xl text-blue-950", serif.className)}>Team activity</h2>
            <Link href="#" className="text-xs font-medium text-[#2340d9] hover:underline">View all →</Link>
          </div>
          <div className="rounded-2xl border border-white/80 bg-white/75 backdrop-blur-xl shadow-[0_8px_30px_-18px_rgba(30,58,138,0.2)]">
            <ul className="divide-y divide-slate-200/60 text-sm">
              {RECENT_ACTIVITY.map((a) => (
                <li key={a.id} className="px-5 py-4 flex items-start gap-3">
                  <span className={cn("h-2 w-2 rounded-full mt-2 shrink-0", verdictDot(a.tone))} />
                  <div className="flex-1 min-w-0 flex items-start justify-between gap-3">
                    <div>
                      <span className="font-semibold text-slate-900">{a.actor}</span>{" "}
                      <span className="text-slate-700">{a.text}</span>
                    </div>
                    <div className="text-xs text-slate-500 whitespace-nowrap">{a.when}</div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </div>
    </div>
  )
}

function verdictDot(tone: string) {
  return {
    yes: "bg-emerald-500",
    no: "bg-rose-400",
    maybe: "bg-amber-400",
    neutral: "bg-slate-400",
  }[tone] ?? "bg-slate-400"
}

function ActionCard({ icon, title, subtitle, tone, stub, linky }: {
  icon: React.ReactNode
  title: string
  subtitle: string
  tone: "blue" | "sky" | "rose"
  stub?: boolean
  linky?: boolean
}) {
  const toneBg = { blue: "bg-blue-100 text-blue-900", sky: "bg-sky-100 text-sky-900", rose: "bg-rose-100 text-rose-900" }[tone]
  return (
    <div className={cn(
      "group rounded-2xl border border-white/80 bg-white/75 backdrop-blur-xl p-4 flex items-start gap-3 shadow-[0_6px_22px_-16px_rgba(30,58,138,0.2)] transition hover:bg-white/90",
      stub && "opacity-90",
    )}>
      <div className={cn("rounded-xl p-2 shrink-0", toneBg)}>{icon}</div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold text-slate-900 leading-snug">{title}</div>
        <div className="text-xs text-slate-600 mt-0.5">{subtitle}</div>
      </div>
      {linky && <ArrowUpRight className="h-4 w-4 text-slate-500 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-slate-900" />}
      {stub && <Badge variant="outline" className="text-[10px] font-medium border-slate-300/70 text-slate-600">stub</Badge>}
    </div>
  )
}

function PillarCard({ tone, icon, name, value, unit, secondary, stub }: {
  tone: "blue" | "sky" | "cyan" | "emerald" | "slate"
  icon: React.ReactNode
  name: string
  value: string
  unit: string
  secondary: string
  stub?: boolean
}) {
  const toneBg = {
    blue: "bg-blue-100 text-blue-900",
    sky: "bg-sky-100 text-sky-900",
    cyan: "bg-cyan-100 text-cyan-900",
    emerald: "bg-emerald-100 text-emerald-900",
    slate: "bg-slate-100 text-slate-900",
  }[tone]
  return (
    <div className={cn(
      "rounded-2xl border border-white/80 bg-white/75 backdrop-blur-xl p-4 flex flex-col gap-3 shadow-[0_6px_22px_-16px_rgba(30,58,138,0.2)]",
      stub && "opacity-90",
    )}>
      <div className="flex items-center justify-between">
        <div className={cn("rounded-xl p-1.5", toneBg)}>{icon}</div>
        {stub && <Badge variant="outline" className="text-[10px] font-medium border-slate-300/70 text-slate-600">soon</Badge>}
      </div>
      <div>
        <div className="text-[11px] font-semibold text-slate-600 uppercase tracking-[0.14em]">{name}</div>
        <div className="mt-1 flex items-baseline gap-1.5">
          <span className="font-semibold text-2xl text-slate-900 leading-none tabular-nums">{value}</span>
          <span className="text-xs text-slate-600">{unit}</span>
        </div>
        <div className="text-xs text-slate-600 mt-1.5 leading-snug">{secondary}</div>
      </div>
    </div>
  )
}
