"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import type { SubmissionType } from "@/lib/csv"

type Verdict = "yes" | "no" | "maybe"

export type JudgeActionResult =
  | { ok: true; nextId: string | null }
  | { ok: false; error: string }

/**
 * Cast a verdict on a submission from the judging cockpit and return the next
 * unjudged submission id in the same type queue (or null if the queue is empty).
 *
 * Keeps the existing saveJudgment semantics on submissions/[id] — this variant
 * is queue-aware so the client can auto-advance without re-rendering the server
 * tree twice.
 */
export async function castVerdictAndAdvance(
  submissionId: string,
  verdict: Verdict | null,
  notes: string,
  type: SubmissionType,
): Promise<JudgeActionResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "Not authenticated." }

  const { error: upsertErr } = await supabase.from("judgments").upsert(
    {
      user_id: user.id,
      submission_id: submissionId,
      verdict,
      notes,
    },
    { onConflict: "user_id,submission_id" },
  )
  if (upsertErr) return { ok: false, error: upsertErr.message }

  // Find the next unjudged submission in the queue after the one we just voted on.
  const { data: queue, error: queueErr } = await supabase
    .from("submissions")
    .select("id")
    .eq("type", type)
    .is("deleted_at", null)
    .order("submitted_at", { ascending: false, nullsFirst: false })

  if (queueErr) {
    // Save succeeded, surface next as null so the client shows "all done".
    return { ok: true, nextId: null }
  }

  const ids = (queue ?? []).map((r) => r.id)
  const { data: myJ } = ids.length
    ? await supabase
        .from("judgments")
        .select("submission_id, verdict")
        .eq("user_id", user.id)
        .in("submission_id", ids)
    : { data: [] as { submission_id: string; verdict: string | null }[] }

  const judgedIds = new Set(
    (myJ ?? []).filter((j) => j.verdict !== null).map((j) => j.submission_id),
  )
  const unjudged = ids.filter((id) => !judgedIds.has(id))

  // Prefer the next unjudged id _after_ the current one in queue order.
  const currentIdx = ids.indexOf(submissionId)
  let nextId: string | null = null
  if (currentIdx >= 0) {
    for (let i = currentIdx + 1; i < ids.length; i++) {
      if (!judgedIds.has(ids[i])) {
        nextId = ids[i]
        break
      }
    }
  }
  // Fallback: wrap to the first remaining unjudged anywhere in the queue.
  if (!nextId && unjudged.length > 0) nextId = unjudged[0]

  revalidatePath("/dashboard")
  revalidatePath("/submissions")
  revalidatePath(`/submissions/${submissionId}`)
  revalidatePath("/analysis")

  return { ok: true, nextId }
}

/**
 * Save notes without changing verdict. Used by the "Save notes" button inside
 * the cockpit when the verdict is already cast.
 */
export async function saveNotesOnly(
  submissionId: string,
  notes: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "Not authenticated." }

  // Preserve existing verdict if any.
  const { data: existing } = await supabase
    .from("judgments")
    .select("verdict")
    .eq("user_id", user.id)
    .eq("submission_id", submissionId)
    .maybeSingle()

  const { error } = await supabase.from("judgments").upsert(
    {
      user_id: user.id,
      submission_id: submissionId,
      verdict: existing?.verdict ?? null,
      notes,
    },
    { onConflict: "user_id,submission_id" },
  )
  if (error) return { ok: false, error: error.message }
  revalidatePath(`/submissions/${submissionId}`)
  return { ok: true }
}
