import Link from "next/link"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import { ArrowRightIcon, ClockIcon, MapPinIcon, MicIcon, SparklesIcon, UsersIcon } from "lucide-react"
import { getActDisplayName } from "@/lib/solo-act"
import { FESTIVAL_DAYS } from "../festival"
import { DraftPicker } from "./draft-picker"
import { CopyLineupButton } from "./copy-lineup-button"

type SearchParams = { [key: string]: string | string[] | undefined }

function formatTime(t: string): string {
  const [hh, mm] = t.split(":").map(Number)
  const period = hh < 12 ? "am" : "pm"
  const hh12 = hh === 0 ? 12 : hh > 12 ? hh - 12 : hh
  return mm === 0 ? `${hh12}${period}` : `${hh12}:${String(mm).padStart(2, "0")}${period}`
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
]

function formatLongDate(date: string): string {
  // date is "YYYY-MM-DD"; render as "July 8, 2026"
  const [y, m, d] = date.split("-").map(Number)
  return `${MONTHS[m - 1]} ${d}, ${y}`
}

function blockKindLabel(kind: string | null | undefined): string {
  if (kind === "workshop") return "Workshop"
  if (kind === "event") return "Event"
  return "Show"
}

type LineupBlock = {
  start_time: string
  end_time: string
  title: string | null
  kind: string | null
  theme: string | null
  notes: string | null
  acts: { name: string | null }[]
}

function buildLineupText(
  days: { date: string; long: string; blocks: LineupBlock[] }[],
): string {
  const sections: string[] = []
  for (const day of days) {
    if (day.blocks.length === 0) continue
    const header = `${day.long} - ${formatLongDate(day.date)}`
    const lines: string[] = [header, ""]
    for (const b of day.blocks) {
      const time = `${formatTime(b.start_time)} - ${formatTime(b.end_time)}`
      const title = b.title ?? "Untitled block"
      const kind = blockKindLabel(b.kind)
      lines.push(`* ${time}: ${title} (${kind})`)
      const desc = (b.theme && b.theme.trim()) || (b.notes && b.notes.trim()) || null
      if (desc) lines.push(`   * ${desc}`)
      for (const a of b.acts) {
        const name = a.name?.trim() || "Untitled"
        lines.push(`      * ${name}`)
      }
    }
    sections.push(lines.join("\n"))
  }
  return sections.join("\n\n")
}

export default async function ProgrammingIndexPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const params = await searchParams
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()
  const isAdmin = profile?.role === "admin"

  const { data: drafts } = await supabase
    .from("programming_drafts")
    .select("id, name, is_published, updated_at")
    .order("is_published", { ascending: false })
    .order("updated_at", { ascending: false })

  const requested = typeof params.draft === "string" ? params.draft : null
  const selectableDrafts = isAdmin
    ? (drafts ?? [])
    : (drafts ?? []).filter((d) => d.is_published)
  const selected =
    selectableDrafts.find((d) => d.id === requested) ??
    selectableDrafts.find((d) => d.is_published) ??
    selectableDrafts[0] ??
    null

  if (!selected) {
    return (
      <div className="space-y-6">
        <Header copyText="" />
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No production drafts yet. Create one in <Link className="underline" href="/production">Schedule</Link>.
          </CardContent>
        </Card>
      </div>
    )
  }

  const { data: blocksRaw } = await supabase
    .from("show_blocks")
    .select(
      "id, draft_id, day, start_time, end_time, title, location, notes, theme, host, kind",
    )
    .eq("draft_id", selected.id)
    .order("day", { ascending: true })
    .order("start_time", { ascending: true })

  // Server-side rendered text payload for the Copy lineup button. We build
  // it after the joins below populate tagsByBlock — see buildLineupText.

  const blocks = blocksRaw ?? []

  const blockIds = blocks.map((b) => b.id)
  const { data: tagRows } = blockIds.length > 0
    ? await supabase
        .from("show_block_submissions")
        .select("block_id, submission_id, position, duration_minutes")
        .in("block_id", blockIds)
    : { data: [] }

  const subIds = Array.from(new Set((tagRows ?? []).map((t) => t.submission_id)))
  const { data: subs } = subIds.length > 0
    ? await supabase
        .from("submissions")
        .select("id, type, name, email, data")
        .in("id", subIds)
        .is("deleted_at", null)
    : { data: [] }
  const subById = new Map(
    (subs ?? []).map((s) => {
      const display =
        s.type === "act"
          ? getActDisplayName({
              name: s.name,
              data: (s.data as Record<string, unknown> | null) ?? null,
              email: s.email,
            })
          : { display: s.name ?? "Untitled", substituted: false, original: s.name }
      return [
        s.id,
        { id: s.id, type: s.type, name: display.display },
      ]
    }),
  )

  const tagsByBlock = new Map<
    string,
    { submission_id: string; position: number | null; duration_minutes: number | null; name: string | null; type: string | null }[]
  >()
  for (const t of tagRows ?? []) {
    const sub = subById.get(t.submission_id)
    const arr = tagsByBlock.get(t.block_id) ?? []
    arr.push({
      submission_id: t.submission_id,
      position: t.position,
      duration_minutes: t.duration_minutes,
      name: sub?.name ?? null,
      type: sub?.type ?? null,
    })
    tagsByBlock.set(t.block_id, arr)
  }
  for (const arr of tagsByBlock.values()) {
    arr.sort((a, b) => {
      const pa = a.position ?? Number.MAX_SAFE_INTEGER
      const pb = b.position ?? Number.MAX_SAFE_INTEGER
      return pa - pb
    })
  }

  // Group blocks by day for nicer rendering.
  const byDay = new Map<string, typeof blocks>()
  for (const b of blocks) {
    const arr = byDay.get(b.day) ?? []
    arr.push(b)
    byDay.set(b.day, arr)
  }

  // Build the copy-able plaintext lineup, in festival-day order.
  const lineupText = buildLineupText(
    FESTIVAL_DAYS.filter((d) => byDay.has(d.date)).map((d) => ({
      date: d.date,
      long: d.long,
      blocks: (byDay.get(d.date) ?? []).map((b) => ({
        start_time: b.start_time,
        end_time: b.end_time,
        title: b.title,
        kind: b.kind,
        theme: b.theme,
        notes: b.notes,
        acts: (tagsByBlock.get(b.id) ?? []).map((a) => ({ name: a.name })),
      })),
    })),
  )

  return (
    <div className="space-y-6">
      <Header copyText={lineupText} />

      {selectableDrafts.length > 1 && (
        <DraftPicker
          drafts={selectableDrafts.map((d) => ({
            id: d.id,
            name: d.name,
            is_published: d.is_published,
          }))}
          selectedId={selected.id}
        />
      )}

      {blocks.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No blocks in <span className="font-medium">{selected.name}</span> yet.
            Add blocks in <Link className="underline" href={`/production?draft=${selected.id}`}>Schedule</Link>,
            then come back to program them.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          {FESTIVAL_DAYS.filter((d) => byDay.has(d.date)).map((day) => {
            const dayBlocks = byDay.get(day.date)!
            return (
              <section key={day.date} className="space-y-3">
                <div className="flex items-baseline gap-2">
                  <h2 className="text-lg font-semibold tracking-tight">{day.long}</h2>
                  <span className="text-xs text-muted-foreground">
                    Jul {Number(day.date.slice(-2))}
                  </span>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {dayBlocks.map((b) => {
                    const acts = tagsByBlock.get(b.id) ?? []
                    const totalDuration = acts.reduce(
                      (acc, a) => acc + (a.duration_minutes ?? 0),
                      0,
                    )
                    return (
                      <Link
                        key={b.id}
                        href={`/production/programming/${b.id}?draft=${selected.id}`}
                        className="group block rounded-xl border bg-card p-4 transition hover:border-blue-300 hover:shadow-sm"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 text-xs">
                              <span className="text-muted-foreground tabular-nums">
                                {formatTime(b.start_time)} – {formatTime(b.end_time)}
                              </span>
                              <KindBadge kind={b.kind} />
                            </div>
                            <div className="font-medium truncate mt-0.5">
                              {b.title ?? "Untitled block"}
                            </div>
                          </div>
                          <ArrowRightIcon className="size-4 text-muted-foreground opacity-0 transition group-hover:opacity-100" />
                        </div>
                        <div className="mt-3 grid gap-1.5 text-xs text-muted-foreground">
                          {b.theme && (
                            <div className="flex items-center gap-1.5">
                              <SparklesIcon className="size-3" />
                              <span className="truncate">{b.theme}</span>
                            </div>
                          )}
                          {b.host && (
                            <div className="flex items-center gap-1.5">
                              <MicIcon className="size-3" />
                              <span className="truncate">Host: {b.host}</span>
                            </div>
                          )}
                          {b.location && (
                            <div className="flex items-center gap-1.5">
                              <MapPinIcon className="size-3" />
                              <span className="truncate">{b.location}</span>
                            </div>
                          )}
                          <div className="flex items-center gap-3 pt-1">
                            <span className="inline-flex items-center gap-1">
                              <UsersIcon className="size-3" />
                              {acts.length} {acts.length === 1 ? "act" : "acts"}
                            </span>
                            {totalDuration > 0 && (
                              <span className="inline-flex items-center gap-1 tabular-nums">
                                <ClockIcon className="size-3" />
                                {totalDuration} min programmed
                              </span>
                            )}
                          </div>
                        </div>
                        {acts.length > 0 && (
                          <div className="mt-3 flex flex-wrap gap-1">
                            {acts.slice(0, 5).map((a) => (
                              <Badge
                                key={a.submission_id}
                                variant="secondary"
                                className="font-normal"
                              >
                                {a.name ?? "Untitled"}
                              </Badge>
                            ))}
                            {acts.length > 5 && (
                              <Badge variant="outline" className="font-normal">
                                +{acts.length - 5}
                              </Badge>
                            )}
                          </div>
                        )}
                      </Link>
                    )
                  })}
                </div>
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}

function KindBadge({ kind }: { kind: string | null | undefined }) {
  const k = kind === "workshop" || kind === "event" ? kind : "show"
  const cls =
    k === "workshop"
      ? "bg-violet-100 text-violet-900"
      : k === "event"
        ? "bg-amber-100 text-amber-900"
        : "bg-slate-100 text-slate-700"
  const label = k === "workshop" ? "Workshop" : k === "event" ? "Event" : "Show"
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${cls}`}
    >
      {label}
    </span>
  )
}

function Header({ copyText }: { copyText: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-3">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Programming</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Match approved acts to each show block, set act lengths, and build the billing.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <CopyLineupButton text={copyText} />
        <Link
          href="/production"
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          Schedule view
        </Link>
      </div>
    </div>
  )
}
