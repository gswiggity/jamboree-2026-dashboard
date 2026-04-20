import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { Card, CardContent } from "@/components/ui/card"
import { DraftsShell } from "./drafts-shell"
import { ScheduleCanvas } from "./schedule-canvas"

type SearchParams = { [key: string]: string | string[] | undefined }

export default async function ProductionPage({
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

  const { data: draftsRaw } = await supabase
    .from("programming_drafts")
    .select(
      "id, name, is_published, published_at, updated_at, created_at, created_by, venues, venue_colors, window_start_time, window_end_time",
    )
    .order("is_published", { ascending: false })
    .order("updated_at", { ascending: false })

  const drafts = (draftsRaw ?? []).map((d) => ({
    ...d,
    venue_colors:
      d.venue_colors && typeof d.venue_colors === "object" && !Array.isArray(d.venue_colors)
        ? (d.venue_colors as Record<string, string>)
        : {},
  }))

  const requested = typeof params.draft === "string" ? params.draft : null
  const selectedDraft =
    drafts.find((d) => d.id === requested) ??
    drafts[0] ??
    null

  const visibleDraft = isAdmin ? selectedDraft : drafts.find((d) => d.is_published) ?? null

  const { data: blocks } = visibleDraft
    ? await supabase
        .from("show_blocks")
        .select("id, draft_id, day, start_time, end_time, title, location, notes")
        .eq("draft_id", visibleDraft.id)
        .order("day", { ascending: true })
        .order("start_time", { ascending: true })
    : { data: [] }

  const blockIds = (blocks ?? []).map((b) => b.id)
  const { data: tagRows } = blockIds.length > 0
    ? await supabase
        .from("show_block_submissions")
        .select("block_id, submission_id")
        .in("block_id", blockIds)
    : { data: [] }

  const { data: eligibleSubs } = visibleDraft
    ? await supabase
        .from("submissions")
        .select("id, type, name, email, data")
        .in("type", ["act", "workshop"])
        .order("name", { ascending: true })
    : { data: [] }

  const { data: commentRows } = blockIds.length > 0
    ? await supabase
        .from("show_block_comments")
        .select("id, block_id, user_id, body, created_at")
        .in("block_id", blockIds)
        .order("created_at", { ascending: true })
    : { data: [] }

  const authorIds = Array.from(
    new Set((commentRows ?? []).map((c) => c.user_id)),
  )
  const { data: authors } = authorIds.length > 0
    ? await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", authorIds)
    : { data: [] }

  const authorById = new Map(
    (authors ?? []).map((a) => [a.id, { name: a.full_name, email: a.email }]),
  )

  const tagsByBlock = new Map<string, string[]>()
  for (const t of tagRows ?? []) {
    const arr = tagsByBlock.get(t.block_id) ?? []
    arr.push(t.submission_id)
    tagsByBlock.set(t.block_id, arr)
  }
  const tagsByBlockObj: Record<string, string[]> = {}
  for (const [k, v] of tagsByBlock) tagsByBlockObj[k] = v

  const commentsByBlock: Record<
    string,
    { id: string; user_id: string; body: string; created_at: string; author_name: string | null; author_email: string }[]
  > = {}
  for (const c of commentRows ?? []) {
    const author = authorById.get(c.user_id)
    const arr = commentsByBlock[c.block_id] ?? []
    arr.push({
      id: c.id,
      user_id: c.user_id,
      body: c.body,
      created_at: c.created_at,
      author_name: author?.name ?? null,
      author_email: author?.email ?? "",
    })
    commentsByBlock[c.block_id] = arr
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Production</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {isAdmin
            ? "Build show blocks, save versions, and publish when you're ready."
            : "The current published program. Comment on any block to discuss."}
        </p>
      </div>

      {isAdmin ? (
        <DraftsShell
          drafts={drafts}
          selectedDraft={visibleDraft}
          blocks={blocks ?? []}
          eligibleSubmissions={(eligibleSubs ?? []).map((s) => ({
            id: s.id,
            type: s.type,
            name: s.name,
            email: s.email,
            data:
              s.data && typeof s.data === "object" && !Array.isArray(s.data)
                ? (s.data as Record<string, unknown>)
                : null,
          }))}
          tagsByBlock={tagsByBlockObj}
          commentsByBlock={commentsByBlock}
          currentUserId={user.id}
        />
      ) : visibleDraft ? (
        <ScheduleCanvas
          draftId={visibleDraft.id}
          isPublished={visibleDraft.is_published}
          viewerRole="member"
          blocks={blocks ?? []}
          venues={visibleDraft.venues}
          venueColors={visibleDraft.venue_colors}
          windowStartTime={visibleDraft.window_start_time}
          windowEndTime={visibleDraft.window_end_time}
          eligibleSubmissions={(eligibleSubs ?? []).map((s) => ({
            id: s.id,
            type: s.type,
            name: s.name,
            email: s.email,
            data:
              s.data && typeof s.data === "object" && !Array.isArray(s.data)
                ? (s.data as Record<string, unknown>)
                : null,
          }))}
          tagsByBlock={tagsByBlockObj}
          commentsByBlock={commentsByBlock}
          currentUserId={user.id}
        />
      ) : (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No production schedule has been published yet.
          </CardContent>
        </Card>
      )}
    </div>
  )
}
