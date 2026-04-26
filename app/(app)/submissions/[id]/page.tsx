import Link from "next/link"
import { notFound } from "next/navigation"
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import { JudgingForm } from "@/components/judging-form"
import { VideoLinkEditor } from "@/components/video-link-editor"
import { TYPE_LABELS, type SubmissionType } from "@/lib/csv"
import { cn } from "@/lib/utils"
import { looksLikeUrl, toEmbedUrl } from "@/lib/video"
import { ConversationsCard } from "./conversations-card"
import { TrashedBanner } from "./trashed-banner"

const VERDICT_BADGE: Record<string, string> = {
  yes: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200",
  no: "bg-rose-100 text-rose-900 dark:bg-rose-950 dark:text-rose-200",
  maybe: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
}

const VERDICT_LABEL: Record<string, string> = {
  yes: "Yes",
  no: "No",
  maybe: "Could be convinced",
}

type Search = {
  type?: string
  filter?: string
  actType?: string
  location?: string
}

function isType(v: string | undefined): v is SubmissionType {
  return v === "act" || v === "volunteer" || v === "workshop"
}

function normalizeKey(s: string): string {
  return s
    .toLowerCase()
    .replace(/[-_/.,!]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

export default async function SubmissionDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<Search>
}) {
  const { id } = await params
  const sp = await searchParams
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: submission, error } = await supabase
    .from("submissions")
    .select(
      "id, type, name, email, submitted_at, data, created_at, supplemental_video_url, deleted_at",
    )
    .eq("id", id)
    .single()

  if (error || !submission) notFound()

  const [{ data: myJudgment }, { data: teamJudgments }] = await Promise.all([
    supabase
      .from("judgments")
      .select("verdict, notes")
      .eq("user_id", user!.id)
      .eq("submission_id", id)
      .maybeSingle(),
    supabase
      .from("judgments")
      .select("user_id, verdict, notes, updated_at, profiles(email, full_name)")
      .eq("submission_id", id)
      .neq("user_id", user!.id),
  ])

  const dataEntries = Object.entries(
    (submission.data as Record<string, unknown>) ?? {},
  ).filter(([, v]) => v !== null && v !== undefined && String(v).trim() !== "")

  const supplementalVideoUrl = submission.supplemental_video_url ?? null
  const supplementalEmbed = supplementalVideoUrl
    ? toEmbedUrl(supplementalVideoUrl)
    : null
  const hasAutoDetectedVideo = !supplementalVideoUrl
    ? dataEntries.some(([, v]) => {
        const s = String(v).trim()
        return /^https?:\/\//i.test(s) && toEmbedUrl(s) !== null
      })
    : false

  let prevId: string | null = null
  let nextId: string | null = null
  let indexLabel: string | null = null
  const navType = isType(sp.type) ? sp.type : null

  if (navType) {
    const { data: list } = await supabase
      .from("submissions")
      .select("id, data")
      .eq("type", navType)
      .is("deleted_at", null)
      .order("submitted_at", { ascending: false, nullsFirst: false })

    let ordered = list ?? []

    if (navType === "act") {
      if (sp.actType && sp.actType !== "all") {
        ordered = ordered.filter((r) => {
          const d = r.data as Record<string, unknown> | null
          const v = typeof d?.["GroupAct Type"] === "string" ? (d!["GroupAct Type"] as string) : ""
          return normalizeKey(v) === sp.actType
        })
      }
      if (sp.location && sp.location !== "all") {
        ordered = ordered.filter((r) => {
          const d = r.data as Record<string, unknown> | null
          const v = typeof d?.["Location"] === "string" ? (d!["Location"] as string) : ""
          return normalizeKey(v) === sp.location
        })
      }
    }

    const filter = sp.filter
    if (filter && filter !== "all") {
      const listIds = ordered.map((r) => r.id)
      const { data: myJ } =
        listIds.length > 0
          ? await supabase
              .from("judgments")
              .select("submission_id, verdict")
              .eq("user_id", user!.id)
              .in("submission_id", listIds)
          : { data: [] }
      const myMap = new Map(
        (myJ ?? []).map((j) => [j.submission_id, j.verdict]),
      )
      ordered = ordered.filter((r) => {
        const v = myMap.get(r.id) ?? null
        if (filter === "unjudged") return !v
        return v === filter
      })
    }

    const idx = ordered.findIndex((r) => r.id === id)
    if (idx >= 0) {
      prevId = idx > 0 ? ordered[idx - 1].id : null
      nextId = idx < ordered.length - 1 ? ordered[idx + 1].id : null
      indexLabel = `${idx + 1} of ${ordered.length}`
    }
  }

  const makeNavHref = (targetId: string) => {
    const p = new URLSearchParams()
    if (sp.type) p.set("type", sp.type)
    if (sp.filter && sp.filter !== "all") p.set("filter", sp.filter)
    if (sp.actType && sp.actType !== "all") p.set("actType", sp.actType)
    if (sp.location && sp.location !== "all") p.set("location", sp.location)
    const qs = p.toString()
    return qs ? `/submissions/${targetId}?${qs}` : `/submissions/${targetId}`
  }

  const listHref = (() => {
    const p = new URLSearchParams()
    p.set("type", sp.type ?? submission.type)
    if (sp.filter && sp.filter !== "all") p.set("filter", sp.filter)
    if (sp.actType && sp.actType !== "all") p.set("actType", sp.actType)
    if (sp.location && sp.location !== "all") p.set("location", sp.location)
    return `/submissions?${p.toString()}`
  })()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2">
        <Link
          href={listHref}
          className="text-sm text-muted-foreground hover:text-foreground underline-offset-4 hover:underline"
        >
          ← Back to {TYPE_LABELS[submission.type as SubmissionType]}
        </Link>
        {(prevId || nextId || indexLabel) && (
          <div className="flex items-center gap-1">
            {prevId ? (
              <Link
                href={makeNavHref(prevId)}
                className={buttonVariants({ variant: "outline", size: "sm" })}
                aria-label="Previous submission"
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
                href={makeNavHref(nextId)}
                className={buttonVariants({ variant: "outline", size: "sm" })}
                aria-label="Next submission"
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

      {submission.deleted_at && (
        <TrashedBanner
          submissionId={submission.id}
          deletedAt={submission.deleted_at}
        />
      )}

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Badge variant="outline">
              {TYPE_LABELS[submission.type as SubmissionType]}
            </Badge>
            {submission.submitted_at && (
              <span className="text-xs text-muted-foreground">
                Submitted {new Date(submission.submitted_at).toLocaleString()}
              </span>
            )}
          </div>
          <h1 className="text-3xl font-semibold tracking-tight mt-2">
            {submission.name ?? "(no name)"}
          </h1>
          {submission.email && (
            <a
              href={`mailto:${submission.email}`}
              className="text-sm text-muted-foreground hover:text-foreground underline-offset-4 hover:underline"
            >
              {submission.email}
            </a>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Submission data</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-3 text-sm">
              {dataEntries.map(([key, value]) => {
                const str = String(value).trim()
                const isUrl = looksLikeUrl(str)
                const embed = isUrl ? toEmbedUrl(str) : null
                return (
                  <div
                    key={key}
                    className="grid grid-cols-1 sm:grid-cols-[220px_1fr] gap-1 sm:gap-4"
                  >
                    <dt className="text-muted-foreground font-medium">{key}</dt>
                    <dd className="min-w-0 space-y-2">
                      {isUrl ? (
                        <a
                          href={str}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-block text-primary hover:underline underline-offset-4 break-all"
                        >
                          {str}
                        </a>
                      ) : (
                        <p className="whitespace-pre-wrap break-words">{str}</p>
                      )}
                      {embed && (
                        <div className="aspect-video overflow-hidden rounded-md border bg-muted max-w-2xl">
                          <iframe
                            src={embed}
                            title={key}
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                            allowFullScreen
                            className="size-full"
                          />
                        </div>
                      )}
                    </dd>
                  </div>
                )
              })}
            </dl>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>
                Performance video{supplementalVideoUrl ? " (added)" : ""}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {supplementalVideoUrl && (
                <a
                  href={supplementalVideoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block text-sm text-primary hover:underline underline-offset-4 break-all"
                >
                  {supplementalVideoUrl}
                </a>
              )}
              {supplementalEmbed && (
                <div className="aspect-video overflow-hidden rounded-md border bg-muted">
                  <iframe
                    src={supplementalEmbed}
                    title="Performance video"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                    className="size-full"
                  />
                </div>
              )}
              <VideoLinkEditor
                submissionId={submission.id}
                supplementalUrl={supplementalVideoUrl}
                hasAutoDetectedVideo={hasAutoDetectedVideo}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Your judgment</CardTitle>
            </CardHeader>
            <CardContent>
              <JudgingForm
                submissionId={submission.id}
                initialVerdict={
                  (myJudgment?.verdict as "yes" | "no" | "maybe" | null) ?? null
                }
                initialNotes={myJudgment?.notes ?? ""}
              />
            </CardContent>
          </Card>

          <ConversationsCard submissionEmail={submission.email} />

          <Card>
            <CardHeader>
              <CardTitle>Team verdicts</CardTitle>
            </CardHeader>
            <CardContent>
              {(teamJudgments ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No teammates have judged yet.
                </p>
              ) : (
                <ul className="space-y-3 text-sm">
                  {teamJudgments!.map((j) => {
                    const profile = Array.isArray(j.profiles)
                      ? j.profiles[0]
                      : j.profiles
                    const who =
                      profile?.full_name ?? profile?.email ?? "Teammate"
                    return (
                      <li key={j.user_id} className="space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium">{who}</span>
                          {j.verdict ? (
                            <Badge
                              variant="secondary"
                              className={cn(VERDICT_BADGE[j.verdict])}
                            >
                              {VERDICT_LABEL[j.verdict]}
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              no verdict yet
                            </span>
                          )}
                        </div>
                        {j.notes && (
                          <p className="text-muted-foreground whitespace-pre-wrap">
                            {j.notes}
                          </p>
                        )}
                      </li>
                    )
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <div>
        <Link
          href={listHref}
          className={buttonVariants({ variant: "outline" })}
        >
          Back to list
        </Link>
      </div>
    </div>
  )
}
