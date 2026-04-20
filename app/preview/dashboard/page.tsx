import Link from "next/link"
import { Shrikhand } from "next/font/google"
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const shrikhand = Shrikhand({ subsets: ["latin"], weight: "400" })

// Public preview route — hardcoded mock data, no auth, no DB.
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

const RECENT_IMPORTS = [
  { id: 1, type: "act", file_name: "Jamboree-Acts-2026-04-18.csv", uploaded_at: "2026-04-18", new_rows: 12, updated_rows: 3 },
  { id: 2, type: "volunteer", file_name: "Volunteers-Apr.csv", uploaded_at: "2026-04-15", new_rows: 8, updated_rows: 0 },
  { id: 3, type: "workshop", file_name: "Workshop-Proposals.csv", uploaded_at: "2026-04-10", new_rows: 5, updated_rows: 1 },
]

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

export default function PreviewDashboardPage() {
  const days = daysUntil(FESTIVAL.start)

  return (
    <div className="min-h-screen bg-background">
      {/* Mock nav — mirrors Swear Jar site: black bar, cobalt wordmark */}
      <header className="border-b border-black bg-black sticky top-0 z-40">
        <div className="mx-auto max-w-6xl px-4 h-14 flex items-center gap-6">
          <span className={cn("text-xl text-[#3b5cff] tracking-wide", shrikhand.className)}>
            Jamboree
          </span>
          <nav className="flex items-center gap-1 text-sm">
            {["Dashboard", "Submissions", "Judge", "Upload", "Analysis", "Programming", "Settings"].map(
              (label, i) => (
                <span
                  key={label}
                  className={cn(
                    "px-3 py-1.5 rounded-md",
                    i === 0
                      ? "bg-white/10 text-white"
                      : "text-white/60",
                  )}
                >
                  {label}
                </span>
              ),
            )}
          </nav>
          <div className="ml-auto text-sm text-white/60 hidden sm:inline">
            gabandgoof@gmail.com
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-8 space-y-10">
        {/* Preview banner */}
        <div className="rounded-md border border-dashed bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          Preview mode · mock data · <Link href="/dashboard" className="underline underline-offset-2">open real dashboard</Link>
        </div>

        {/* HERO — navy → cobalt gradient, retro script wordmark, cloud blobs */}
        <section className="relative overflow-hidden rounded-2xl border border-blue-950/40 bg-gradient-to-br from-[#0d1a8a] via-[#2340d9] to-[#3b5cff] px-6 md:px-8 py-10 md:py-12 text-white shadow-lg shadow-blue-900/20">
          {/* Soft cloud-like highlights evoking the logo */}
          <div className="pointer-events-none absolute -right-16 -top-20 h-72 w-72 rounded-full bg-cyan-300/25 blur-3xl" />
          <div className="pointer-events-none absolute -left-24 bottom-0 h-64 w-64 rounded-full bg-sky-300/20 blur-3xl" />
          <div className="pointer-events-none absolute right-1/3 top-10 h-40 w-40 rounded-full bg-white/5 blur-2xl" />
          <div className="relative flex flex-wrap items-end justify-between gap-8">
            <div className="space-y-2">
              <p className="text-[11px] tracking-[0.2em] text-cyan-200/90 uppercase font-medium">
                {FESTIVAL.tagline}
              </p>
              <h1
                className={cn(
                  "text-5xl md:text-7xl tracking-tight text-white drop-shadow-[0_2px_0_rgba(8,20,80,0.5)]",
                  shrikhand.className,
                )}
              >
                {FESTIVAL.name}
              </h1>
              <p className="text-sm text-blue-100/80 pt-1">
                {formatDateRange(FESTIVAL.start, FESTIVAL.end)}
              </p>
              <div className="pt-4 flex flex-wrap items-center gap-2 text-sm">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 backdrop-blur border border-white/25 px-3 py-1 text-white">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-300 opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-cyan-300" />
                  </span>
                  {FESTIVAL.phaseLabel}
                </span>
                <span className="text-xs text-blue-100/70">
                  next phase: {FESTIVAL.phaseNext}
                </span>
              </div>
            </div>
            <div className="text-right">
              <div className="font-mono text-6xl md:text-8xl font-semibold tabular-nums leading-none text-white drop-shadow-[0_2px_0_rgba(8,20,80,0.5)]">
                {days}
              </div>
              <div className="mt-2 text-xs md:text-sm text-cyan-200/90 uppercase tracking-[0.2em]">
                days to kickoff
              </div>
            </div>
          </div>
        </section>

        {/* NEEDS YOUR ATTENTION */}
        <section>
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Needs your attention
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Link
              href="#"
              className="group rounded-lg border bg-card hover:bg-accent/50 transition-colors p-4 flex items-start gap-3"
            >
              <div className="rounded-md bg-blue-100 p-2 text-blue-900 shrink-0">
                <Mic2 className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium">{MOCK.unjudged} unjudged submissions</div>
                <div className="text-xs text-muted-foreground">Enter judging mode →</div>
              </div>
              <ArrowUpRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </Link>

            <div className="rounded-lg border bg-card p-4 flex items-start gap-3 opacity-80">
              <div className="rounded-md bg-sky-100 p-2 text-sky-900 shrink-0">
                <Mail className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium">Volunteer kickoff email</div>
                <div className="text-xs text-muted-foreground">Draft · scheduled in 3 days</div>
              </div>
              <Badge variant="outline" className="text-[10px] font-normal">stub</Badge>
            </div>

            <div className="rounded-lg border bg-card p-4 flex items-start gap-3 opacity-80">
              <div className="rounded-md bg-rose-100 p-2 text-rose-900 shrink-0">
                <AlertCircle className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium">Venue deposit due</div>
                <div className="text-xs text-muted-foreground">$500 · by May 1</div>
              </div>
              <Badge variant="outline" className="text-[10px] font-normal">stub</Badge>
            </div>
          </div>
        </section>

        {/* PILLARS */}
        <section>
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Festival pillars
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <PillarCard
              icon={<Sparkles className="h-4 w-4" />}
              name="Talent"
              pulse={`${MOCK.totalSubmissions} submissions`}
              secondary={`${MOCK.acts} acts · ${MOCK.volunteers} volunteers · ${MOCK.workshops} workshops`}
              tone="blue"
            />
            <PillarCard
              icon={<Mail className="h-4 w-4" />}
              name="Comms"
              pulse="2 drafts"
              secondary="Next send in 3d"
              tone="sky"
              stub
            />
            <PillarCard
              icon={<CalendarDays className="h-4 w-4" />}
              name="Production"
              pulse="4 shows planned"
              secondary="0 fully booked"
              tone="cyan"
              stub
            />
            <PillarCard
              icon={<Wallet className="h-4 w-4" />}
              name="Financials"
              pulse="$2.4k / $8k"
              secondary="30% of budget used"
              tone="emerald"
              stub
            />
            <PillarCard
              icon={<Users className="h-4 w-4" />}
              name="Ops"
              pulse="8 team members"
              secondary="2 invites pending"
              tone="slate"
            />
          </div>
        </section>

        {/* ACTIVITY */}
        <section className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Recent imports</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="divide-y text-sm">
                {RECENT_IMPORTS.map((imp) => (
                  <li key={imp.id} className="py-3 flex items-center justify-between gap-4">
                    <div className="min-w-0 flex items-start gap-2.5">
                      <UploadIcon className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                      <div className="min-w-0">
                        <div className="font-medium truncate">{imp.file_name}</div>
                        <div className="text-xs text-muted-foreground">
                          {imp.type} · {imp.uploaded_at}
                        </div>
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground whitespace-nowrap">
                      +{imp.new_rows} new, {imp.updated_rows} updated
                    </div>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Team activity</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="divide-y text-sm">
                {RECENT_ACTIVITY.map((a) => (
                  <li key={a.id} className="py-3 flex items-start gap-2.5">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0 flex items-start justify-between gap-2">
                      <div className="truncate">
                        <span className="font-medium">{a.actor}</span>{" "}
                        <span className="text-muted-foreground">{a.text}</span>
                      </div>
                      <div className="text-xs text-muted-foreground whitespace-nowrap">{a.when}</div>
                    </div>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </section>

        <div className="pt-6 flex justify-center">
          <Button variant="outline" size="sm" render={<Link href="/dashboard" />}>
            Open real dashboard →
          </Button>
        </div>
      </div>
    </div>
  )
}

function PillarCard({
  icon, name, pulse, secondary, tone, stub,
}: {
  icon: React.ReactNode
  name: string
  pulse: string
  secondary: string
  tone: "blue" | "sky" | "cyan" | "emerald" | "slate"
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
        "rounded-lg border bg-card p-4 flex flex-col gap-3",
        stub && "opacity-75",
      )}
    >
      <div className="flex items-center justify-between">
        <div className={cn("rounded-md p-1.5", toneBg)}>{icon}</div>
        {stub && (
          <Badge variant="outline" className="text-[10px] font-normal">coming soon</Badge>
        )}
      </div>
      <div>
        <div className="text-[11px] text-muted-foreground uppercase tracking-wider">{name}</div>
        <div className="mt-0.5 font-semibold text-base leading-tight">{pulse}</div>
        <div className="text-xs text-muted-foreground mt-1 leading-snug">{secondary}</div>
      </div>
    </div>
  )
}
