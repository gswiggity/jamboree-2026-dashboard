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
  Users,
  Wallet,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

const shrikhand = Shrikhand({ subsets: ["latin"], weight: "400" })
const serif = Instrument_Serif({ subsets: ["latin"], weight: "400", style: ["normal", "italic"] })

const FESTIVAL = {
  name: "Swear Jar Jamboree",
  tagline: "Indie Comedy + Improv Festival",
  location: "Philadelphia, PA",
  start: new Date("2026-07-09T19:00:00-04:00"),
  end: new Date("2026-07-12T23:00:00-04:00"),
  phaseLabel: "Submissions open",
  phaseNext: "Judging",
  editor: "Curated by Gabs, Alex & Jordan",
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

function romanNumeral(n: number) {
  return ["I", "II", "III", "IV", "V"][n - 1] ?? String(n)
}

export default function AiryEditorialPage() {
  const days = daysUntil(FESTIVAL.start)
  const month = FESTIVAL.start.toLocaleDateString("en-US", { month: "long" })
  const issueLabel = new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" }).toUpperCase()

  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-b from-sky-100 via-white to-sky-50 text-slate-800">
      <div className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 h-[520px] w-[900px] rounded-full bg-gradient-to-br from-sky-200/50 via-blue-200/30 to-white/0 blur-3xl" />
      <div className="pointer-events-none absolute top-[50%] -left-40 h-[360px] w-[360px] rounded-full bg-blue-300/15 blur-3xl" />
      <div className="pointer-events-none absolute top-[25%] -right-40 h-[360px] w-[360px] rounded-full bg-cyan-200/25 blur-3xl" />

      {/* MASTHEAD */}
      <header className="relative border-b border-slate-900/10">
        <div className="mx-auto max-w-6xl px-6 py-5 flex items-center justify-between text-[11px] tracking-[0.24em] uppercase text-slate-700 font-semibold">
          <div>No. 01 · {issueLabel}</div>
          <div className={cn("text-3xl normal-case tracking-tight text-[#1e3aa8] leading-none", shrikhand.className)}>
            Jamboree
          </div>
          <div className="hidden sm:block">gabandgoof@gmail.com</div>
        </div>
        <div className="mx-auto max-w-6xl px-6 pb-4 flex items-center justify-between text-xs text-slate-600">
          <nav className="flex flex-wrap items-center gap-4">
            {["Dashboard", "Submissions", "Judge", "Upload", "Analysis", "Settings"].map((label, i) => (
              <span key={label} className={cn(i === 0 ? "text-slate-900 font-semibold underline underline-offset-4 decoration-2 decoration-[#2340d9]" : "hover:text-slate-900")}>
                {label}
              </span>
            ))}
          </nav>
          <div className="italic text-slate-600">{FESTIVAL.editor}</div>
        </div>
      </header>

      <div className="relative mx-auto max-w-6xl px-6">
        <div className="mt-4 rounded-md border border-dashed border-slate-300/50 bg-white/40 backdrop-blur px-3 py-1.5 text-[11px] text-slate-600 inline-flex">
          Preview · airy · <span className="px-1 font-medium">editorial</span> · <Link href="/preview" className="underline underline-offset-2 ml-1">all variants</Link>
        </div>

        {/* HERO — asymmetric split, big serif left + countdown column right */}
        <section className="pt-12 pb-16 grid gap-10 lg:grid-cols-[1.35fr_1fr] items-end">
          <div>
            <p className="text-[11px] tracking-[0.32em] text-blue-900 uppercase font-semibold mb-6">
              {FESTIVAL.tagline} · {FESTIVAL.location}
            </p>
            <h1 className={cn("text-[5.5rem] md:text-[9rem] leading-[0.88] tracking-tight text-blue-950", serif.className)}>
              Swear Jar
            </h1>
            <h1 className={cn("text-[5.5rem] md:text-[9rem] leading-[0.88] tracking-tight italic text-[#2340d9] -mt-3", serif.className)}>
              Jamboree
            </h1>
            <div className="mt-8 flex items-center gap-3 text-[11px] uppercase tracking-[0.22em] text-slate-700 font-semibold">
              <span className="h-px w-8 bg-slate-400" />
              {month} {FESTIVAL.start.getDate()}–{FESTIVAL.end.getDate()}, {FESTIVAL.start.getFullYear()}
              <span className="h-px w-8 bg-slate-400" />
            </div>
          </div>

          <aside className="relative lg:pl-10 lg:border-l lg:border-slate-900/10">
            <div className="text-[11px] uppercase tracking-[0.28em] font-semibold text-slate-600 mb-3">
              Time until kickoff
            </div>
            <div className="flex items-baseline gap-3">
              <span className="font-mono text-[7rem] tabular-nums font-semibold text-blue-950 leading-none">
                {days}
              </span>
              <span className={cn("text-3xl italic text-slate-700", serif.className)}>days</span>
            </div>
            <div className="mt-5 flex items-center gap-2.5">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-70" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
              </span>
              <div>
                <div className="text-sm font-semibold text-slate-900">{FESTIVAL.phaseLabel}</div>
                <div className="text-xs text-slate-600">next → {FESTIVAL.phaseNext}</div>
              </div>
            </div>
            <p className={cn("mt-6 text-lg italic text-slate-700 leading-snug border-t border-slate-900/10 pt-5", serif.className)}>
              “The team has {MOCK.unjudged} decisions sitting between them and the lineup.”
            </p>
          </aside>
        </section>

        <Rule n={1} label="Attention" />

        {/* NEEDS ATTENTION — as a two-column editorial feature */}
        <section className="py-10 grid gap-6 md:grid-cols-3">
          <FeatureCard
            roman="I"
            tone="blue"
            icon={<Mic2 className="h-4 w-4" />}
            kicker="Judging"
            title={`${MOCK.unjudged} submissions wait for a verdict.`}
            body="Enter judging mode to clear the queue with keyboard shortcuts and auto-advance."
            cta="Start judging"
          />
          <FeatureCard
            roman="II"
            tone="sky"
            icon={<Mail className="h-4 w-4" />}
            kicker="Comms"
            title="Volunteer kickoff email is still a draft."
            body="Scheduled to send in three days — review tone, swap in names, and approve."
            cta="Open draft"
            stub
          />
          <FeatureCard
            roman="III"
            tone="rose"
            icon={<AlertCircle className="h-4 w-4" />}
            kicker="Financials"
            title="Venue deposit of $500 is due by May 1."
            body="Wire it before the end of the month to hold the date with the Philly Improv Theater."
            cta="Mark paid"
            stub
          />
        </section>

        <PullQuote>
          “Running a festival is mostly answering the next twelve questions before anyone asks them.”
        </PullQuote>

        <Rule n={2} label="Pillars" />

        {/* PILLARS — editorial table */}
        <section className="py-10">
          <p className={cn("text-lg text-slate-700 italic max-w-2xl mb-8", serif.className)}>
            The festival runs on five pillars. Each with its own rhythm, its own deadline, its own way of going quietly wrong.
          </p>
          <div className="grid gap-px bg-slate-900/10 border border-slate-900/10 rounded-2xl overflow-hidden">
            <PillarRow n={1} tone="blue" icon={<Sparkles className="h-4 w-4" />} name="Talent" value={`${MOCK.totalSubmissions} submissions`} detail={`${MOCK.acts} acts · ${MOCK.volunteers} volunteers · ${MOCK.workshops} workshops`} progressLabel={`${MOCK.totalJudged} / ${MOCK.acts} judged`} progress={MOCK.totalJudged / MOCK.acts} />
            <PillarRow n={2} tone="sky" icon={<Mail className="h-4 w-4" />} name="Comms" value="2 drafts" detail="Next scheduled send in 3 days" progressLabel="—" progress={0} stub />
            <PillarRow n={3} tone="cyan" icon={<CalendarDays className="h-4 w-4" />} name="Production" value="4 shows planned" detail="Venues booked, slots unconfirmed" progressLabel="0 of 4 fully booked" progress={0} stub />
            <PillarRow n={4} tone="emerald" icon={<Wallet className="h-4 w-4" />} name="Financials" value="$2,400 / $8,000" detail="Budget running warm on production" progressLabel="30% of budget used" progress={0.3} stub />
            <PillarRow n={5} tone="slate" icon={<Users className="h-4 w-4" />} name="Ops" value="8 team members" detail="2 invites awaiting acceptance" progressLabel="6 of 8 active" progress={6 / 8} />
          </div>
        </section>

        <Rule n={3} label="Dispatches" />

        {/* ACTIVITY — editorial newsfeed */}
        <section className="py-10 pb-24 grid gap-10 md:grid-cols-[1fr_1.2fr]">
          <div>
            <p className="text-[11px] uppercase tracking-[0.28em] font-semibold text-slate-600 mb-4">
              Byline · Recent decisions
            </p>
            <p className={cn("text-2xl italic text-slate-700 leading-snug", serif.className)}>
              Small verdicts, cast one at a time, ultimately decide what a festival looks like.
            </p>
          </div>
          <ol className="space-y-5">
            {RECENT_ACTIVITY.map((a, i) => (
              <li key={a.id} className="group flex items-start gap-4 border-b border-slate-900/10 pb-5 last:border-0">
                <div className={cn("font-mono text-xs text-slate-500 tabular-nums mt-1 w-6 shrink-0", serif.className)}>
                  {String(i + 1).padStart(2, "0")}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={cn("h-2 w-2 rounded-full", verdictDot(a.tone))} />
                    <span className="text-xs uppercase tracking-[0.2em] font-semibold text-slate-700">{verdictLabel(a.tone)}</span>
                  </div>
                  <div className="text-base text-slate-900 leading-snug">
                    <span className="font-semibold">{a.actor}</span>{" "}
                    <span className={cn("italic", serif.className)}>{a.text}</span>
                  </div>
                  <div className="text-xs text-slate-600 mt-1">{a.when}</div>
                </div>
                <ArrowUpRight className="h-4 w-4 text-slate-400 mt-1 opacity-0 group-hover:opacity-100 transition" />
              </li>
            ))}
          </ol>
        </section>

        {/* COLOPHON */}
        <footer className="border-t border-slate-900/10 py-8 flex flex-wrap items-center justify-between gap-4 text-[11px] uppercase tracking-[0.24em] text-slate-600 font-semibold">
          <div>Issue 01 · {issueLabel} · Philadelphia</div>
          <div className={cn("normal-case tracking-normal text-slate-900 text-xl", shrikhand.className)}>
            Jamboree
          </div>
          <div>{FESTIVAL.editor}</div>
        </footer>
      </div>
    </div>
  )
}

function verdictDot(tone: string) {
  return { yes: "bg-emerald-500", no: "bg-rose-400", maybe: "bg-amber-400", neutral: "bg-slate-400" }[tone] ?? "bg-slate-400"
}

function verdictLabel(tone: string) {
  return { yes: "Verdict · Yes", no: "Verdict · No", maybe: "Verdict · Maybe", neutral: "Import" }[tone] ?? "Update"
}

function Rule({ n, label }: { n: number; label: string }) {
  return (
    <div className="flex items-center gap-4 py-2">
      <div className={cn("font-mono text-xs text-slate-600 tabular-nums w-8", serif.className)}>
        {String(n).padStart(2, "0")}.
      </div>
      <div className="text-[11px] uppercase tracking-[0.32em] font-semibold text-slate-900">{label}</div>
      <div className="flex-1 h-px bg-slate-900/10" />
      <div className={cn("text-xs italic text-slate-500", serif.className)}>{romanNumeral(n)}</div>
    </div>
  )
}

function FeatureCard({ roman, tone, icon, kicker, title, body, cta, stub }: {
  roman: string
  tone: "blue" | "sky" | "rose"
  icon: React.ReactNode
  kicker: string
  title: string
  body: string
  cta: string
  stub?: boolean
}) {
  const toneBg = { blue: "bg-blue-100 text-blue-900", sky: "bg-sky-100 text-sky-900", rose: "bg-rose-100 text-rose-900" }[tone]
  return (
    <article className={cn("flex flex-col gap-3", stub && "opacity-95")}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={cn("rounded-xl p-1.5", toneBg)}>{icon}</div>
          <span className="text-[11px] uppercase tracking-[0.28em] font-semibold text-slate-600">{kicker} · {roman}</span>
        </div>
        {stub && <Badge variant="outline" className="text-[10px] font-medium border-slate-300/70 text-slate-600">stub</Badge>}
      </div>
      <h3 className={cn("text-2xl text-blue-950 leading-[1.1]", serif.className)}>{title}</h3>
      <p className="text-sm text-slate-700 leading-relaxed">{body}</p>
      <div className="mt-1 inline-flex items-center gap-1.5 text-sm font-semibold text-[#2340d9] hover:underline underline-offset-4">
        {cta} <ArrowRight className="h-3.5 w-3.5" />
      </div>
    </article>
  )
}

function PullQuote({ children }: { children: React.ReactNode }) {
  return (
    <blockquote className="relative py-12 text-center">
      <span className={cn("absolute left-1/2 -translate-x-1/2 -top-2 text-6xl text-[#2340d9]/30 italic leading-none", serif.className)}>
        “
      </span>
      <p className={cn("text-3xl md:text-4xl italic text-blue-950 max-w-3xl mx-auto leading-[1.2]", serif.className)}>
        {children}
      </p>
    </blockquote>
  )
}

function PillarRow({ n, tone, icon, name, value, detail, progressLabel, progress, stub }: {
  n: number
  tone: "blue" | "sky" | "cyan" | "emerald" | "slate"
  icon: React.ReactNode
  name: string
  value: string
  detail: string
  progressLabel: string
  progress: number
  stub?: boolean
}) {
  const toneBg = {
    blue: "bg-blue-100 text-blue-900",
    sky: "bg-sky-100 text-sky-900",
    cyan: "bg-cyan-100 text-cyan-900",
    emerald: "bg-emerald-100 text-emerald-900",
    slate: "bg-slate-100 text-slate-900",
  }[tone]
  const toneBar = {
    blue: "bg-blue-500",
    sky: "bg-sky-500",
    cyan: "bg-cyan-500",
    emerald: "bg-emerald-500",
    slate: "bg-slate-500",
  }[tone]
  return (
    <div className={cn("bg-white/70 backdrop-blur px-5 py-5 grid gap-4 md:grid-cols-[40px_1fr_1.4fr_1fr] items-center", stub && "opacity-90")}>
      <div className="flex items-center gap-2">
        <span className={cn("font-mono text-xs text-slate-500 tabular-nums", serif.className)}>
          {String(n).padStart(2, "0")}
        </span>
      </div>
      <div className="flex items-center gap-3">
        <div className={cn("rounded-xl p-2 shrink-0", toneBg)}>{icon}</div>
        <div>
          <div className="text-[11px] uppercase tracking-[0.18em] font-semibold text-slate-600">{name}</div>
          <div className="font-semibold text-slate-900 leading-tight">{value}</div>
        </div>
      </div>
      <div className={cn("text-sm italic text-slate-700 leading-snug", serif.className)}>{detail}</div>
      <div>
        <div className="flex items-center justify-between text-[11px] text-slate-600 mb-1 font-medium">
          <span>{progressLabel}</span>
          {stub && <span className="italic">soon</span>}
        </div>
        <div className="h-1 rounded-full bg-slate-200/70 overflow-hidden">
          <div className={cn("h-full rounded-full transition-all", toneBar)} style={{ width: `${Math.max(2, progress * 100)}%` }} />
        </div>
      </div>
    </div>
  )
}
