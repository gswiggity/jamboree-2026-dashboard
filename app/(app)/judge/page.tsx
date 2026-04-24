import Link from "next/link"
import { redirect } from "next/navigation"
import { ArrowLeft, CheckCircle2, Inbox, Mic2 } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { SUBMISSION_TYPES, TYPE_LABELS, type SubmissionType } from "@/lib/csv"
import { toEmbedUrl, looksLikeUrl } from "@/lib/video"
import { cn } from "@/lib/utils"
import { JudgingCockpit, type TeamJudgment } from "./judging-cockpit"

type Search = {
  type?: string
  id?: string
  filter?: string
}

function isType(v: string | undefined): v is SubmissionType {
  return v === "act" || v === "volunteer" || v === "workshop"
}

function firstVideoEmbed(data: Record<string, unknown>): string | null {
  for (const value of Object.values(data)) {
    const s = typeof value === "string" ? value.trim() : ""
    if (!s || !looksLikeUrl(s)) continue
    const embed = toEmbedUrl(s)
    if (embed) {
      const sep = embed.includes("?") ? "&" : "?"
      return `${embed}${sep}autoplay=1&mute=1&muted=1`
    }
  }
  return null
}

export default async function JudgePage({
  searchParams,
}: {
  searchParams: Promise<Search>
}) {
  const sp = await searchParams
  const type: SubmissionType = isType(sp.type) ? sp.type : "act"
  const filter = sp.filter === "all" ? "all" : "unjudged"

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Queue: all submissions of this type, newest first.
  const { data: queue } = await supabase
    .from("submissions")
    .select("id")
    .eq("type", type)
    .order("submitted_at", { ascending: false, nullsFirst: false })

  const queueIds = (queue ?? []).map((r) => r.id)

  // My judgments across the full queue — drives the unjudged filter and progress.
  const { data: myJudgments } = queueIds.length
    ? await supabase
        .from("judgments")
        .select("submission_id, verdict")
        .eq("user_id", user!.id)
        .in("submission_id", queueIds)
    : { data: [] }

  const verdictBySubmission = new Map<string, string | null>()
  for (const j of myJudgments ?? []) {
    verdictBySubmission.set(j.submission_id, j.verdict)
  }
  const judgedCount = [...verdictBySubmission.values()].filter(
    (v) => v !== null,
  ).length
  const total = queueIds.length
  const remaining = total - judgedCount

  const orderedIds = filter === "all"
    ? queueIds
    : queueIds.filter((id) => verdictBySubmission.get(id) == null)

  // Empty state — no submissions at all.
  if (total === 0) {
    return <EmptyQueue type={type} reason="none" />
  }

  // Pick current id: explicit ?id= wins, otherwise first in filtered queue.
  let currentId = sp.id ?? orderedIds[0]

  // If they landed on ?id= pointing at an already-judged one while in unjudged
  // filter, allow it (they can re-vote). Otherwise redirect to the first
  // unjudged if we ran out of queue.
  if (!currentId) {
    return <EmptyQueue type={type} reason="caught-up" total={total} />
  }

  // Sanity check — requested id must belong to the queue type.
  if (!queueIds.includes(currentId)) {
    redirect(`/judge?type=${type}`)
  }

  // Prev/next walk the *currently-active* queue (respecting the filter). If
  // the current submission isn't in that queue — e.g. user arrived on a
  // judged one while Skip-judged is ON — fall back to finding neighbors in
  // queue order that *are* in the active queue.
  const orderedSet = new Set(orderedIds)
  let prevId: string | null = null
  let nextId: string | null = null
  let navPosition = 0
  const navTotal = orderedIds.length

  const navIdx = orderedIds.indexOf(currentId)
  if (navIdx >= 0) {
    prevId = navIdx > 0 ? orderedIds[navIdx - 1] : null
    nextId = navIdx < orderedIds.length - 1 ? orderedIds[navIdx + 1] : null
    navPosition = navIdx + 1
  } else {
    const fullIdx = queueIds.indexOf(currentId)
    for (let i = fullIdx - 1; i >= 0; i--) {
      if (orderedSet.has(queueIds[i])) {
        prevId = queueIds[i]
        break
      }
    }
    for (let i = fullIdx + 1; i < queueIds.length; i++) {
      if (orderedSet.has(queueIds[i])) {
        nextId = queueIds[i]
        break
      }
    }
  }

  // Fetch everything we need for the current submission.
  const [
    { data: submission },
    { data: myJudgment },
    { data: teamJudgments },
  ] = await Promise.all([
    supabase
      .from("submissions")
      .select("id, type, name, email, submitted_at, data")
      .eq("id", currentId)
      .single(),
    supabase
      .from("judgments")
      .select("verdict, notes")
      .eq("user_id", user!.id)
      .eq("submission_id", currentId)
      .maybeSingle(),
    supabase
      .from("judgments")
      .select("user_id, verdict, notes, updated_at, profiles(email, full_name)")
      .eq("submission_id", currentId)
      .neq("user_id", user!.id),
  ])

  if (!submission) redirect(`/judge?type=${type}`)

  const data = (submission.data as Record<string, unknown>) ?? {}
  const videoEmbed = firstVideoEmbed(data)

  // Surface a handful of key CSV fields prominently, drop the rest into "more".
  const PREFERRED_KEYS_ACT = [
    "Group Name",
    "GroupAct Type",
    "Location",
    "Primary Contact 11",
    "Primary Contact",
    "Price",
    "Duration",
    "How did you hear about us?",
  ]
  const PREFERRED_KEYS_GENERIC = ["Role", "Availability", "Experience"]
  const preferredKeys = type === "act" ? PREFERRED_KEYS_ACT : PREFERRED_KEYS_GENERIC
  const allEntries = Object.entries(data).filter(
    ([, v]) => v !== null && v !== undefined && String(v).trim() !== "",
  )
  const highlighted: [string, string][] = []
  const other: [string, string][] = []
  for (const [k, v] of allEntries) {
    const str = String(v)
    ;(preferredKeys.includes(k) ? highlighted : other).push([k, str])
  }

  const team: TeamJudgment[] = (teamJudgments ?? []).map((j) => {
    const profile = Array.isArray(j.profiles) ? j.profiles[0] : j.profiles
    return {
      userId: j.user_id,
      name: profile?.full_name ?? profile?.email ?? "Teammate",
      verdict: (j.verdict as "yes" | "no" | "maybe" | null) ?? null,
      notes: j.notes ?? "",
      updatedAt: j.updated_at,
    }
  })

  return (
    <JudgingCockpit
      submission={{
        id: submission.id,
        name: submission.name ?? "(no name)",
        email: submission.email ?? null,
        submittedAt: submission.submitted_at,
      }}
      type={type}
      typeLabel={TYPE_LABELS[type]}
      videoEmbed={videoEmbed}
      highlighted={highlighted}
      other={other}
      myVerdict={(myJudgment?.verdict as "yes" | "no" | "maybe" | null) ?? null}
      myNotes={myJudgment?.notes ?? ""}
      teamJudgments={team}
      progress={{
        judged: judgedCount,
        total,
        remaining,
        position: navPosition,
        navTotal,
        offQueue: navIdx < 0,
      }}
      prevId={prevId}
      nextId={nextId}
      filter={filter}
    />
  )
}

function EmptyQueue({
  type,
  reason,
  total,
}: {
  type: SubmissionType
  reason: "none" | "caught-up"
  total?: number
}) {
  return (
    <div className="space-y-8">
      <JudgeHeader type={type} />
      <div className="mx-auto max-w-xl rounded-3xl border border-white/70 bg-white/70 backdrop-blur-xl p-10 shadow-[0_16px_44px_-20px_rgba(30,58,138,0.25)] text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-100 text-blue-900">
          {reason === "none" ? (
            <Inbox className="h-5 w-5" />
          ) : (
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
          )}
        </div>
        <h2 className="font-[family-name:var(--font-serif)] text-3xl text-blue-950">
          {reason === "none"
            ? `No ${TYPE_LABELS[type].toLowerCase()} yet`
            : "All caught up"}
        </h2>
        <p className="mt-3 text-sm text-slate-700">
          {reason === "none"
            ? "Import a CSV from Squarespace in Settings to start a judging queue."
            : `You've voted on all ${total} ${TYPE_LABELS[type].toLowerCase()}. Nice.`}
        </p>
        <div className="mt-6 flex items-center justify-center gap-2">
          {reason === "none" ? (
            <Link
              href="/settings"
              className="inline-flex items-center gap-1.5 rounded-full bg-blue-950 text-white text-sm font-semibold px-4 py-2 hover:bg-blue-900"
            >
              Go to Settings →
            </Link>
          ) : (
            <>
              <Link
                href={`/judge?type=${type}&filter=all`}
                className="inline-flex items-center gap-1.5 rounded-full bg-blue-950 text-white text-sm font-semibold px-4 py-2 hover:bg-blue-900"
              >
                Review judged
              </Link>
              <Link
                href="/submissions"
                className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 bg-white/80 text-slate-800 text-sm font-semibold px-4 py-2 hover:bg-slate-100"
              >
                Back to submissions
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function JudgeHeader({ type }: { type: SubmissionType }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <Link
          href="/dashboard"
          className="text-sm text-slate-600 hover:text-slate-900 inline-flex items-center gap-1"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Dashboard
        </Link>
        <span className="text-slate-300">·</span>
        <div className="flex items-center gap-2">
          <Mic2 className="h-4 w-4 text-blue-900" />
          <span className="font-[family-name:var(--font-serif)] text-2xl text-blue-950">
            Judging{" "}
            <span className="italic text-[#2340d9]">
              {TYPE_LABELS[type].toLowerCase()}
            </span>
          </span>
        </div>
      </div>
      <div className="flex items-center gap-1 text-xs">
        {SUBMISSION_TYPES.map((t) => (
          <Link
            key={t}
            href={`/judge?type=${t}`}
            className={cn(
              "px-3 py-1.5 rounded-full font-medium transition",
              t === type
                ? "bg-blue-950 text-white"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/60",
            )}
          >
            {TYPE_LABELS[t]}
          </Link>
        ))}
      </div>
    </div>
  )
}
