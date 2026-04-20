import Link from "next/link"
import { Shrikhand } from "next/font/google"
import {
  AlertCircle,
  Bell,
  CalendarDays,
  ChevronRight,
  Grid3x3,
  LineChart,
  Mail,
  Mic2,
  Search,
  Settings,
  Sparkles,
  Users,
  Wallet,
} from "lucide-react"
import { cn } from "@/lib/utils"

const shrikhand = Shrikhand({ subsets: ["latin"], weight: "400" })

const FESTIVAL = {
  name: "Swear Jar Jamboree",
  start: new Date("2026-07-09T19:00:00-04:00"),
  end: new Date("2026-07-12T23:00:00-04:00"),
  phaseLabel: "Submissions open",
}

function daysUntil(date: Date) {
  const ms = date.getTime() - Date.now()
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)))
}

// Next 7 days — mock agenda
const WEEK = [
  { dow: "Mon", date: 20, events: [] },
  { dow: "Tue", date: 21, events: [{ label: "Judging sprint", tone: "blue" }] },
  { dow: "Wed", date: 22, events: [{ label: "Venue walkthrough", tone: "amber" }] },
  { dow: "Thu", date: 23, events: [{ label: "Volunteer email", tone: "sky" }], today: true },
  { dow: "Fri", date: 24, events: [{ label: "Budget check", tone: "emerald" }] },
  { dow: "Sat", date: 25, events: [] },
  { dow: "Sun", date: 26, events: [{ label: "Team sync", tone: "violet" }] },
]

const AGENDA = [
  {
    id: 1,
    barColor: "bg-amber-400",
    title: "Venue walkthrough",
    subtitle: "Philly Improv Theater",
    time: "10:00 – 11:30",
    duration: "90 min",
    kind: "production" as const,
  },
  {
    id: 2,
    barColor: "bg-sky-400",
    title: "Volunteer kickoff email",
    subtitle: "Draft · ready to send",
    time: "14:00",
    duration: "send",
    kind: "comms" as const,
  },
  {
    id: 3,
    barColor: "bg-blue-500",
    title: "Judging sprint",
    subtitle: "75 acts remaining",
    time: "17:00 – 19:00",
    duration: "2 hr",
    kind: "talent" as const,
  },
]

export default function CockpitDashboardPage() {
  const days = daysUntil(FESTIVAL.start)

  return (
    <div className="min-h-screen relative bg-slate-950 text-slate-100">
      {/* Ambient glows */}
      <div className="pointer-events-none absolute top-0 left-1/3 h-[500px] w-[700px] rounded-full bg-blue-700/25 blur-[120px]" />
      <div className="pointer-events-none absolute top-1/3 -right-20 h-[420px] w-[420px] rounded-full bg-cyan-600/15 blur-[100px]" />
      <div className="pointer-events-none absolute bottom-0 left-0 h-[420px] w-[520px] rounded-full bg-indigo-700/15 blur-[100px]" />

      <div className="relative flex min-h-screen">
        {/* Icon sidebar */}
        <aside className="hidden md:flex flex-col items-center gap-2 py-6 px-3 border-r border-white/5 bg-black/20 backdrop-blur">
          <div className={cn("h-10 w-10 rounded-xl bg-[#2340d9] flex items-center justify-center mb-4 text-xl text-white", shrikhand.className)}>
            J
          </div>
          <SidebarIcon icon={<Grid3x3 className="h-4 w-4" />} active />
          <SidebarIcon icon={<Mic2 className="h-4 w-4" />} />
          <SidebarIcon icon={<CalendarDays className="h-4 w-4" />} />
          <SidebarIcon icon={<Mail className="h-4 w-4" />} />
          <SidebarIcon icon={<LineChart className="h-4 w-4" />} />
          <div className="flex-1" />
          <SidebarIcon icon={<Settings className="h-4 w-4" />} />
        </aside>

        <div className="flex-1 min-w-0">
          {/* Top bar */}
          <header className="flex items-center gap-4 px-6 py-5 border-b border-white/5">
            <div className="flex-1 max-w-md relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
              <input
                placeholder="Search submissions, people, drafts…"
                className="w-full bg-white/5 border border-white/10 rounded-full pl-9 pr-4 py-2 text-sm placeholder:text-slate-500 focus:outline-none focus:border-white/20"
              />
            </div>
            <button className="h-9 w-9 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-slate-300 hover:bg-white/10">
              <Bell className="h-4 w-4" />
            </button>
            <div className="h-9 w-9 rounded-full bg-gradient-to-br from-blue-400 to-cyan-300 flex items-center justify-center text-sm font-semibold text-blue-950">
              G
            </div>
          </header>

          {/* Body */}
          <div className="px-6 py-8 grid gap-8 grid-cols-1 lg:grid-cols-[1fr_360px]">
            {/* Left column */}
            <div className="space-y-8 min-w-0">
              <div>
                <div className="text-xs text-slate-500 mb-1">
                  Preview · variant C (cockpit) ·{" "}
                  <Link href="/preview" className="underline underline-offset-2 text-slate-400">all variants</Link>
                </div>
                <h1 className="text-4xl md:text-5xl font-semibold tracking-tight text-white">
                  Morning, Gabs.
                </h1>
                <p className="mt-1 text-slate-400">
                  <span className="text-slate-200">{days} days</span> to{" "}
                  <span className={cn("text-[#8ba9ff]", shrikhand.className)}>
                    Swear Jar Jamboree
                  </span>{" "}
                  · {FESTIVAL.phaseLabel.toLowerCase()}
                </p>
              </div>

              {/* Week strip */}
              <section>
                <div className="flex items-baseline justify-between mb-3">
                  <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    This week
                  </h2>
                  <Link href="#" className="text-xs text-slate-500 hover:text-slate-300">
                    Full calendar →
                  </Link>
                </div>
                <div className="grid grid-cols-7 gap-2">
                  {WEEK.map((d) => (
                    <div
                      key={d.dow}
                      className={cn(
                        "rounded-2xl border p-3 min-h-[110px] flex flex-col",
                        d.today
                          ? "border-blue-400/50 bg-blue-500/15 shadow-[0_0_40px_-10px_rgba(96,165,250,0.4)]"
                          : "border-white/10 bg-white/5 backdrop-blur",
                      )}
                    >
                      <div className={cn("text-[10px] uppercase tracking-wider", d.today ? "text-blue-200" : "text-slate-500")}>
                        {d.dow}
                      </div>
                      <div className={cn("text-xl font-semibold", d.today ? "text-white" : "text-slate-200")}>
                        {d.date}
                      </div>
                      <div className="mt-auto space-y-1">
                        {d.events.map((e, i) => (
                          <div key={i} className="flex items-center gap-1.5 text-[10px] text-slate-300">
                            <span
                              className={cn(
                                "h-1.5 w-1.5 rounded-full",
                                e.tone === "blue" && "bg-blue-400",
                                e.tone === "amber" && "bg-amber-400",
                                e.tone === "sky" && "bg-sky-400",
                                e.tone === "emerald" && "bg-emerald-400",
                                e.tone === "violet" && "bg-violet-400",
                              )}
                            />
                            <span className="truncate">{e.label}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* Pillars */}
              <section>
                <div className="flex items-baseline justify-between mb-3">
                  <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Festival pillars
                  </h2>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <PillarDark
                    accent="from-blue-500 to-cyan-400"
                    icon={<Sparkles className="h-4 w-4" />}
                    name="Talent"
                    pulse="142 submissions"
                    secondary="12 of 87 acts judged"
                    progress={14}
                  />
                  <PillarDark
                    accent="from-sky-400 to-blue-400"
                    icon={<Mail className="h-4 w-4" />}
                    name="Comms"
                    pulse="2 drafts"
                    secondary="Next send in 3 days"
                    stub
                  />
                  <PillarDark
                    accent="from-cyan-400 to-teal-400"
                    icon={<CalendarDays className="h-4 w-4" />}
                    name="Production"
                    pulse="4 shows planned"
                    secondary="0 of 4 fully booked"
                    progress={0}
                    stub
                  />
                  <PillarDark
                    accent="from-emerald-400 to-lime-400"
                    icon={<Wallet className="h-4 w-4" />}
                    name="Financials"
                    pulse="$2.4k / $8k"
                    secondary="30% of budget used"
                    progress={30}
                    stub
                  />
                  <PillarDark
                    accent="from-slate-400 to-slate-300"
                    icon={<Users className="h-4 w-4" />}
                    name="Ops"
                    pulse="8 team members"
                    secondary="2 invites pending"
                  />
                  <PillarDark
                    accent="from-rose-400 to-amber-400"
                    icon={<AlertCircle className="h-4 w-4" />}
                    name="Risk"
                    pulse="1 alert"
                    secondary="Venue deposit due May 1"
                    stub
                  />
                </div>
              </section>
            </div>

            {/* Right column — today's agenda */}
            <div className="space-y-6 min-w-0">
              <section>
                <div className="flex items-baseline justify-between mb-3">
                  <div>
                    <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      Today
                    </h2>
                    <div className="text-sm text-slate-300">Thursday, April 23</div>
                  </div>
                  <Link href="#" className="text-xs text-slate-500 hover:text-slate-300">
                    Open →
                  </Link>
                </div>
                <div className="space-y-3">
                  {AGENDA.map((item) => (
                    <AgendaCard key={item.id} item={item} />
                  ))}
                </div>
              </section>

              <section>
                <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                  Recent activity
                </h2>
                <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur">
                  <ul className="divide-y divide-white/5 text-sm">
                    {[
                      { who: "Gabs", what: "verdict yes · Harold Team B", when: "2h" },
                      { who: "Alex", what: "verdict maybe · Office Hours", when: "5h" },
                      { who: "Jordan", what: "verdict yes · Longform", when: "1d" },
                      { who: "Gabs", what: "imported 12 acts", when: "2d" },
                    ].map((a, i) => (
                      <li key={i} className="px-4 py-3 flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-medium text-slate-200">{a.who}</div>
                          <div className="text-xs text-slate-500 truncate">{a.what}</div>
                        </div>
                        <div className="text-xs text-slate-500 shrink-0">{a.when}</div>
                      </li>
                    ))}
                  </ul>
                </div>
              </section>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function SidebarIcon({ icon, active }: { icon: React.ReactNode; active?: boolean }) {
  return (
    <div
      className={cn(
        "h-10 w-10 rounded-xl flex items-center justify-center transition-colors",
        active
          ? "bg-white/10 text-white"
          : "text-slate-500 hover:text-slate-200 hover:bg-white/5",
      )}
    >
      {icon}
    </div>
  )
}

function PillarDark({
  accent, icon, name, pulse, secondary, progress, stub,
}: {
  accent: string
  icon: React.ReactNode
  name: string
  pulse: string
  secondary: string
  progress?: number
  stub?: boolean
}) {
  return (
    <div className="group relative rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur p-4 overflow-hidden hover:bg-white/[0.06] transition-colors">
      <div className={cn("absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r", accent)} />
      <div className="flex items-start justify-between gap-2">
        <div className="rounded-xl bg-white/10 p-1.5 text-white">{icon}</div>
        {stub && (
          <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">
            stub
          </span>
        )}
      </div>
      <div className="mt-3">
        <div className="text-[11px] text-slate-500 uppercase tracking-wider">{name}</div>
        <div className="mt-0.5 font-semibold text-base text-white leading-tight">{pulse}</div>
        <div className="text-xs text-slate-400 mt-1 leading-snug">{secondary}</div>
      </div>
      {typeof progress === "number" && (
        <div className="mt-3 h-1 rounded-full bg-white/10 overflow-hidden">
          <div
            className={cn("h-full rounded-full bg-gradient-to-r", accent)}
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </div>
  )
}

function AgendaCard({
  item,
}: {
  item: {
    id: number
    barColor: string
    title: string
    subtitle: string
    time: string
    duration: string
    kind: "production" | "comms" | "talent"
  }
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur overflow-hidden">
      <div className={cn("h-1 w-full", item.barColor)} />
      <div className="px-4 py-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="font-medium text-white truncate">{item.title}</div>
            <div className="text-xs text-slate-400 truncate">{item.subtitle}</div>
          </div>
          <div className="text-xs text-slate-500 shrink-0 text-right">
            <div>{item.time}</div>
            <div>{item.duration}</div>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
          <span className="rounded-full bg-white/5 border border-white/10 px-2 py-0.5 capitalize">
            {item.kind}
          </span>
          <ChevronRight className="h-3 w-3 ml-auto" />
        </div>
      </div>
    </div>
  )
}
