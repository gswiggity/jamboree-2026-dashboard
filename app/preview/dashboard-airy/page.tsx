import Link from "next/link"
import { Shrikhand, Instrument_Serif } from "next/font/google"
import {
  AlertCircle,
  ArrowUpRight,
  CalendarDays,
  CheckCircle2,
  Mail,
  Mic2,
  Sparkles,
  Upload as UploadIcon,
  Users,
  Wallet,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

const shrikhand = Shrikhand({ subsets: ["latin"], weight: "400" })
const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
})

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
  { id: 1, actor: "Gabs", text: "cast verdict yes on Harold Team B", when: "2h ago" },
  { id: 2, actor: "Alex", text: "cast verdict maybe on Office Hours", when: "5h ago" },
  { id: 3, actor: "Gabs", text: "cast verdict no on Two Dumb Guys", when: "yesterday" },
  { id: 4, actor: "Jordan", text: "cast verdict yes on Longform Showcase", when: "yesterday" },
  { id: 5, actor: "Gabs", text: "imported 12 new acts", when: "2 days ago" },
]

function daysUntil(date: Date) {
  const ms = date.getTime() - Date.now()
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)))
}

function formatDateRange(start: Date, end: Date) {
  const sameMonth = start.getMonth() === end.getMonth()
  const month = start.toLocaleDateString("en-US", { month: "long" })
  const year = start.getFullYear()
  if (sameMonth) return `${month} ${start.getDate()}–${end.getDate()}, ${year}`
  return `${start.toLocaleDateString()} – ${end.toLocaleDateString()}`
}

export default function AiryDashboardPage() {
  const days = daysUntil(FESTIVAL.start)

  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-b from-sky-100 via-white to-sky-50">
      {/* ambient glows */}
      <div className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 h-[520px] w-[900px] rounded-full bg-gradient-to-br from-sky-200/60 via-blue-200/40 to-white/0 blur-3xl" />
      <div className="pointer-events-none absolute top-[40%] -left-40 h-[380px] w-[380px] rounded-full bg-blue-300/20 blur-3xl" />
      <div className="pointer-events-none absolute top-[20%] -right-40 h-[380px] w-[380px] rounded-full bg-cyan-200/30 blur-3xl" />

      {/* Floating glass nav */}
      <header className="sticky top-4 z-40 px-4">
        <div className="mx-auto max-w-5xl flex items-center justify-between rounded-full border border-white/60 bg-white/70 backdrop-blur-xl px-5 py-2 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
          <span className={cn("text-lg text-[#2340d9] tracking-wide", shrikhand.className)}>
            Jamboree
          </span>
          <nav className="hidden md:flex items-center gap-1 text-sm">
            {["Dashboard", "Submissions", "Judge", "Upload", "Analysis", "Settings"].map((label, i) => (
              <span
                key={label}
                className={cn(
                  "px-3 py-1.5 rounded-full",
                  i === 0
                    ? "bg-blue-950 text-white"
                    : "text-slate-600 hover:text-slate-900",
                )}
              >
                {label}
              </span>
            ))}
          </nav>
          <span className="text-xs text-slate-500 hidden sm:inline">gabandgoof@gmail.com</span>
        </div>
      </header>

      <div className="relative mx-auto max-w-5xl px-4 py-12 space-y-14">
        <div className="rounded-md border border-dashed border-slate-300/60 bg-white/50 backdrop-blur px-3 py-2 text-xs text-slate-600">
          Preview · variant B (airy/editorial) · <Link href="/preview" className="underline underline-offset-2">all variants</Link>
        </div>

        {/* HERO — centered editorial */}
        <section className="relative text-center pt-6 pb-4">
          <p className="text-[11px] tracking-[0.3em] text-blue-950/70 uppercase font-medium">
            {FESTIVAL.tagline}
          </p>
          <h1
            className={cn(
              "mt-3 text-6xl md:text-8xl leading-[0.95] tracking-tight text-blue-950",
              instrumentSerif.className,
            )}
          >
            Swear Jar <br className="md:hidden" />
            <span className={cn("italic text-[#2340d9]", instrumentSerif.className)}>Jamboree</span>
          </h1>
          <p className={cn("mt-4 text-xl text-slate-700", instrumentSerif.className)}>
            {formatDateRange(FESTIVAL.start, FESTIVAL.end)}
          </p>

          {/* Glass countdown + phase card */}
          <div className="mt-10 inline-flex flex-wrap items-stretch gap-0 rounded-2xl border border-white/70 bg-white/60 backdrop-blur-xl shadow-[0_20px_60px_-20px_rgba(35,64,217,0.25)] overflow-hidden">
            <div className="px-8 py-5 flex items-baseline gap-3">
              <span className="font-mono text-5xl md:text-6xl tabular-nums font-semibold text-blue-950 leading-none">
                {days}
              </span>
              <span className="text-xs text-slate-600 uppercase tracking-wider">
                days to<br />kickoff
              </span>
            </div>
            <div className="border-l border-white/60 px-6 py-5 flex items-center gap-2 bg-gradient-to-r from-white/0 to-sky-100/40">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              <div className="text-left">
                <div className="text-sm font-medium text-slate-900">{FESTIVAL.phaseLabel}</div>
                <div className="text-xs text-slate-500">next: {FESTIVAL.phaseNext}</div>
              </div>
            </div>
          </div>
        </section>

        {/* NEEDS YOUR ATTENTION */}
        <section>
          <div className="flex items-baseline justify-between mb-4">
            <h2 className={cn("text-2xl text-blue-950", instrumentSerif.className)}>
              Needs your attention
            </h2>
            <span className="text-xs text-slate-500">3 items</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <GlassCard tone="blue" icon={<Mic2 className="h-4 w-4" />} title={`${MOCK.unjudged} unjudged submissions`} subtitle="Enter judging mode →" linky />
            <GlassCard tone="sky" icon={<Mail className="h-4 w-4" />} title="Volunteer kickoff email" subtitle="Draft · scheduled in 3 days" stub />
            <GlassCard tone="rose" icon={<AlertCircle className="h-4 w-4" />} title="Venue deposit due" subtitle="$500 · by May 1" stub />
          </div>
        </section>

        {/* PILLARS */}
        <section>
          <div className="flex items-baseline justify-between mb-4">
            <h2 className={cn("text-2xl text-blue-950", instrumentSerif.className)}>
              Festival pillars
            </h2>
            <span className="text-xs text-slate-500">5 areas</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <PillarGlass
              tone="blue"
              icon={<Sparkles className="h-4 w-4" />}
              name="Talent"
              pulse={`${MOCK.totalSubmissions} submissions`}
              secondary={`${MOCK.acts} acts · ${MOCK.volunteers} vols · ${MOCK.workshops} wksps`}
            />
            <PillarGlass tone="sky" icon={<Mail className="h-4 w-4" />} name="Comms" pulse="2 drafts" secondary="Next send in 3d" stub />
            <PillarGlass tone="cyan" icon={<CalendarDays className="h-4 w-4" />} name="Production" pulse="4 shows planned" secondary="0 fully booked" stub />
            <PillarGlass tone="emerald" icon={<Wallet className="h-4 w-4" />} name="Financials" pulse="$2.4k / $8k" secondary="30% of budget used" stub />
            <PillarGlass tone="slate" icon={<Users className="h-4 w-4" />} name="Ops" pulse="8 team members" secondary="2 invites pending" />
          </div>
        </section>

        {/* ACTIVITY */}
        <section>
          <div className="flex items-baseline justify-between mb-4">
            <h2 className={cn("text-2xl text-blue-950", instrumentSerif.className)}>
              Team activity
            </h2>
            <Link href="#" className="text-xs text-[#2340d9] hover:underline">View all →</Link>
          </div>
          <div className="rounded-2xl border border-white/70 bg-white/60 backdrop-blur-xl shadow-[0_10px_40px_-20px_rgba(35,64,217,0.2)]">
            <ul className="divide-y divide-slate-200/50 text-sm">
              {RECENT_ACTIVITY.map((a) => (
                <li key={a.id} className="px-5 py-4 flex items-start gap-3">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0 flex items-start justify-between gap-2">
                    <div>
                      <span className="font-medium text-slate-900">{a.actor}</span>{" "}
                      <span className="text-slate-600">{a.text}</span>
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

function GlassCard({
  icon, title, subtitle, tone, stub, linky,
}: {
  icon: React.ReactNode
  title: string
  subtitle: string
  tone: "blue" | "sky" | "rose"
  stub?: boolean
  linky?: boolean
}) {
  const toneBg = {
    blue: "bg-blue-100 text-blue-900",
    sky: "bg-sky-100 text-sky-900",
    rose: "bg-rose-100 text-rose-900",
  }[tone]
  return (
    <div
      className={cn(
        "group rounded-2xl border border-white/70 bg-white/60 backdrop-blur-xl p-4 flex items-start gap-3 shadow-[0_10px_30px_-20px_rgba(35,64,217,0.2)]",
        stub && "opacity-80",
      )}
    >
      <div className={cn("rounded-xl p-2 shrink-0", toneBg)}>{icon}</div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-slate-900">{title}</div>
        <div className="text-xs text-slate-500">{subtitle}</div>
      </div>
      {linky && <ArrowUpRight className="h-4 w-4 text-slate-400" />}
      {stub && <Badge variant="outline" className="text-[10px] font-normal">stub</Badge>}
    </div>
  )
}

function PillarGlass({
  tone, icon, name, pulse, secondary, stub,
}: {
  tone: "blue" | "sky" | "cyan" | "emerald" | "slate"
  icon: React.ReactNode
  name: string
  pulse: string
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
    <div
      className={cn(
        "rounded-2xl border border-white/70 bg-white/60 backdrop-blur-xl p-4 flex flex-col gap-3 shadow-[0_10px_30px_-20px_rgba(35,64,217,0.2)]",
        stub && "opacity-80",
      )}
    >
      <div className="flex items-center justify-between">
        <div className={cn("rounded-xl p-1.5", toneBg)}>{icon}</div>
        {stub && <Badge variant="outline" className="text-[10px] font-normal">soon</Badge>}
      </div>
      <div>
        <div className="text-[11px] text-slate-500 uppercase tracking-wider">{name}</div>
        <div className="mt-0.5 font-semibold text-base text-slate-900 leading-tight">{pulse}</div>
        <div className="text-xs text-slate-500 mt-1 leading-snug">{secondary}</div>
      </div>
    </div>
  )
}
