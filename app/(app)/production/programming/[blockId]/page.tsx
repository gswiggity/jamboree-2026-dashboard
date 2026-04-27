import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { FESTIVAL_DAYS } from "../../festival"
import { BlockProgrammingShell } from "./shell"

type SearchParams = { draft?: string }

function formatTime(t: string): string {
  const [hh, mm] = t.split(":").map(Number)
  const period = hh < 12 ? "am" : "pm"
  const hh12 = hh === 0 ? 12 : hh > 12 ? hh - 12 : hh
  return mm === 0 ? `${hh12}${period}` : `${hh12}:${String(mm).padStart(2, "0")}${period}`
}

export default async function BlockProgrammingPage({
  params,
  searchParams,
}: {
  params: Promise<{ blockId: string }>
  searchParams: Promise<SearchParams>
}) {
  const { blockId } = await params
  const sp = await searchParams
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()
  const isAdmin = profile?.role === "admin"

  const { data: block, error: blockErr } = await supabase
    .from("show_blocks")
    .select(
      "id, draft_id, day, start_time, end_time, title, location, notes, theme, host, kind",
    )
    .eq("id", blockId)
    .single()
  if (blockErr || !block) notFound()
  const blockKind: "show" | "workshop" | "event" =
    block.kind === "workshop" || block.kind === "event" ? block.kind : "show"

  const { data: draft } = await supabase
    .from("programming_drafts")
    .select("id, name, is_published, venues")
    .eq("id", block.draft_id)
    .single()
  if (!draft) notFound()

  // Members may only view blocks of the published draft.
  if (!isAdmin && !draft.is_published) notFound()

  // Sibling blocks for prev/next navigation within the draft.
  const { data: siblings } = await supabase
    .from("show_blocks")
    .select("id, day, start_time")
    .eq("draft_id", block.draft_id)
    .order("day", { ascending: true })
    .order("start_time", { ascending: true })

  const ordered = siblings ?? []
  const idx = ordered.findIndex((s) => s.id === blockId)
  const prevId = idx > 0 ? ordered[idx - 1].id : null
  const nextId = idx >= 0 && idx < ordered.length - 1 ? ordered[idx + 1].id : null
  const indexLabel = idx >= 0 ? `${idx + 1} of ${ordered.length}` : null

  const { data: tagRows } = await supabase
    .from("show_block_submissions")
    .select("submission_id, position, duration_minutes")
    .eq("block_id", blockId)

  const submissionIds = (tagRows ?? []).map((t) => t.submission_id)

  // Candidate pool depends on the block kind. Shows pull approved acts (the
  // viewer's yes verdicts). Workshops show every workshop submission so the
  // user can pick exactly one. Events have no submissions at all.
  let candidateIds: string[] = []
  if (blockKind === "show") {
    const { data: myYes } = await supabase
      .from("judgments")
      .select("submission_id")
      .eq("user_id", user.id)
      .eq("verdict", "yes")
    candidateIds = (myYes ?? []).map((j) => j.submission_id)
  } else if (blockKind === "workshop") {
    const { data: workshops } = await supabase
      .from("submissions")
      .select("id")
      .eq("type", "workshop")
      .is("deleted_at", null)
    candidateIds = (workshops ?? []).map((w) => w.id)
  }
  const allSubIds = Array.from(new Set([...candidateIds, ...submissionIds]))

  const { data: subsRaw } = allSubIds.length > 0
    ? await supabase
        .from("submissions")
        .select("id, type, name, email, data, supplemental_video_url")
        .in("id", allSubIds)
        .is("deleted_at", null)
        .order("name", { ascending: true })
    : { data: [] }

  const allSubs = (subsRaw ?? []).map((s) => ({
    id: s.id,
    type: s.type,
    name: s.name,
    email: s.email,
    data:
      s.data && typeof s.data === "object" && !Array.isArray(s.data)
        ? (s.data as Record<string, unknown>)
        : null,
    supplemental_video_url: s.supplemental_video_url,
  }))

  // Fetch every team judgment for the union of acts shown on this page,
  // joined with author profiles for display.
  const { data: judgmentRows } = allSubIds.length > 0
    ? await supabase
        .from("judgments")
        .select(
          "submission_id, user_id, verdict, notes, profiles(full_name, email)",
        )
        .in("submission_id", allSubIds)
    : { data: [] }

  const judgmentsBySubmission: Record<
    string,
    {
      user_id: string
      verdict: "yes" | "no" | "maybe" | null
      notes: string | null
      author_name: string | null
      author_email: string | null
    }[]
  > = {}
  for (const j of judgmentRows ?? []) {
    const profile = Array.isArray(j.profiles) ? j.profiles[0] : j.profiles
    const verdict =
      j.verdict === "yes" || j.verdict === "no" || j.verdict === "maybe"
        ? j.verdict
        : null
    const arr = judgmentsBySubmission[j.submission_id] ?? []
    arr.push({
      user_id: j.user_id,
      verdict,
      notes: j.notes ?? null,
      author_name: profile?.full_name ?? null,
      author_email: profile?.email ?? null,
    })
    judgmentsBySubmission[j.submission_id] = arr
  }

  // Block discussion thread.
  const { data: commentRows } = await supabase
    .from("show_block_comments")
    .select("id, block_id, user_id, body, created_at")
    .eq("block_id", blockId)
    .order("created_at", { ascending: true })
  const commentAuthorIds = Array.from(
    new Set((commentRows ?? []).map((c) => c.user_id)),
  )
  const { data: commentAuthors } = commentAuthorIds.length > 0
    ? await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", commentAuthorIds)
    : { data: [] }
  const commentAuthorById = new Map(
    (commentAuthors ?? []).map((a) => [a.id, a]),
  )
  const blockComments = (commentRows ?? []).map((c) => {
    const a = commentAuthorById.get(c.user_id)
    return {
      id: c.id,
      user_id: c.user_id,
      body: c.body,
      created_at: c.created_at,
      author_name: a?.full_name ?? null,
      author_email: a?.email ?? "",
    }
  })

  const acts = (tagRows ?? [])
    .map((t) => {
      const sub = allSubs.find((s) => s.id === t.submission_id)
      return sub
        ? {
            submission: sub,
            position: t.position,
            duration_minutes: t.duration_minutes,
          }
        : null
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort((a, b) => {
      const pa = a.position ?? Number.MAX_SAFE_INTEGER
      const pb = b.position ?? Number.MAX_SAFE_INTEGER
      return pa - pb
    })

  const tagged = new Set(submissionIds)
  const candidateType = blockKind === "workshop" ? "workshop" : "act"
  const candidatePool = allSubs.filter(
    (s) => !tagged.has(s.id) && s.type === candidateType,
  )

  const dayLabel =
    FESTIVAL_DAYS.find((d) => d.date === block.day)?.long ?? block.day

  const backHref = `/production/programming${sp.draft ? `?draft=${sp.draft}` : ""}`
  const navHref = (id: string) =>
    `/production/programming/${id}${sp.draft ? `?draft=${sp.draft}` : ""}`

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2">
        <Link
          href={backHref}
          className="text-sm text-muted-foreground hover:text-foreground underline-offset-4 hover:underline"
        >
          ← Back to programming
        </Link>
        {(prevId || nextId || indexLabel) && (
          <div className="flex items-center gap-1">
            {prevId ? (
              <Link
                href={navHref(prevId)}
                className={buttonVariants({ variant: "outline", size: "sm" })}
                aria-label="Previous block"
              >
                <ChevronLeftIcon className="size-4" />
                <span className="sr-only sm:not-sr-only sm:ml-1">Prev</span>
              </Link>
            ) : (
              <span
                className={cn(
                  buttonVariants({ variant: "outline", size: "sm" }),
                  "pointer-events-none opacity-40",
                )}
                aria-disabled
              >
                <ChevronLeftIcon className="size-4" />
                <span className="sr-only sm:not-sr-only sm:ml-1">Prev</span>
              </span>
            )}
            {indexLabel && (
              <span className="text-xs text-muted-foreground px-2 tabular-nums">
                {indexLabel}
              </span>
            )}
            {nextId ? (
              <Link
                href={navHref(nextId)}
                className={buttonVariants({ variant: "outline", size: "sm" })}
                aria-label="Next block"
              >
                <span className="sr-only sm:not-sr-only sm:mr-1">Next</span>
                <ChevronRightIcon className="size-4" />
              </Link>
            ) : (
              <span
                className={cn(
                  buttonVariants({ variant: "outline", size: "sm" }),
                  "pointer-events-none opacity-40",
                )}
                aria-disabled
              >
                <span className="sr-only sm:not-sr-only sm:mr-1">Next</span>
                <ChevronRightIcon className="size-4" />
              </span>
            )}
          </div>
        )}
      </div>

      <div>
        <div className="text-xs text-muted-foreground tabular-nums">
          {dayLabel} · {formatTime(block.start_time)} – {formatTime(block.end_time)}
          {block.location ? ` · ${block.location}` : ""}
        </div>
        <h1 className="text-3xl font-semibold tracking-tight mt-1">
          {block.title ?? "Untitled block"}
        </h1>
      </div>

      {isAdmin ? (
        <BlockProgrammingShell
          key={block.id}
          blockId={block.id}
          initial={{
            title: block.title ?? "",
            theme: block.theme ?? "",
            host: block.host ?? "",
            kind: blockKind,
          }}
          acts={acts.map((a) => ({
            submission: a.submission,
            duration_minutes: a.duration_minutes,
          }))}
          candidates={candidatePool}
          judgmentsBySubmission={judgmentsBySubmission}
          comments={blockComments}
          currentUserId={user.id}
        />
      ) : (
        <ReadOnlyView block={block} acts={acts} kind={blockKind} />
      )}
    </div>
  )
}

function ReadOnlyView({
  block,
  acts,
  kind,
}: {
  block: {
    title: string | null
    theme: string | null
    host: string | null
    notes: string | null
  }
  acts: {
    submission: { id: string; name: string | null; data: Record<string, unknown> | null }
    duration_minutes: number | null
  }[]
  kind: "show" | "workshop" | "event"
}) {
  const lineupLabel =
    kind === "workshop" ? "Workshop" : kind === "event" ? "Programmed" : "Lineup"
  return (
    <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
      <Card>
        <CardHeader>
          <CardTitle>{lineupLabel}</CardTitle>
        </CardHeader>
        <CardContent>
          {acts.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {kind === "event"
                ? "Volunteer assignments will live here."
                : "Nothing programmed yet."}
            </p>
          ) : (
            <ol className="space-y-2 text-sm">
              {acts.map((a, i) => (
                <li
                  key={a.submission.id}
                  className="flex items-baseline gap-3 border-b last:border-b-0 pb-2 last:pb-0"
                >
                  <span className="text-muted-foreground tabular-nums w-6">
                    {i + 1}.
                  </span>
                  <span className="flex-1 font-medium">{a.submission.name ?? "Untitled"}</span>
                  {a.duration_minutes != null && (
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {a.duration_minutes} min
                    </span>
                  )}
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Details</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-2">
            <Detail label="Theme" value={block.theme} />
            <Detail label="Host" value={block.host} />
            <Detail label="Notes" value={block.notes} />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function Detail({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="whitespace-pre-wrap">{value ?? <span className="text-muted-foreground">—</span>}</div>
    </div>
  )
}
