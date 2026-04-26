"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"

type ActionResult = { ok: true } | { ok: false; error: string }

export async function saveJudgment(
  submissionId: string,
  verdict: "yes" | "no" | "maybe" | null,
  notes: string,
): Promise<ActionResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "Not authenticated." }

  const { error } = await supabase.from("judgments").upsert(
    {
      user_id: user.id,
      submission_id: submissionId,
      verdict,
      notes,
    },
    { onConflict: "user_id,submission_id" },
  )

  if (error) return { ok: false, error: error.message }

  revalidatePath(`/submissions/${submissionId}`)
  revalidatePath("/submissions")
  revalidatePath("/dashboard")
  revalidatePath("/analysis")
  return { ok: true }
}

export async function softDeleteSubmission(
  submissionId: string,
): Promise<ActionResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "Not authenticated." }

  const { error } = await supabase
    .from("submissions")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", submissionId)
  if (error) return { ok: false, error: error.message }

  revalidatePath("/submissions")
  revalidatePath(`/submissions/${submissionId}`)
  revalidatePath("/judge")
  revalidatePath("/performers")
  revalidatePath("/lineup")
  revalidatePath("/dashboard")
  revalidatePath("/production/programming")
  revalidatePath("/analysis")
  return { ok: true }
}

export async function restoreSubmission(
  submissionId: string,
): Promise<ActionResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "Not authenticated." }

  const { error } = await supabase
    .from("submissions")
    .update({ deleted_at: null })
    .eq("id", submissionId)
  if (error) return { ok: false, error: error.message }

  revalidatePath("/submissions")
  revalidatePath(`/submissions/${submissionId}`)
  revalidatePath("/judge")
  revalidatePath("/performers")
  revalidatePath("/lineup")
  revalidatePath("/dashboard")
  revalidatePath("/production/programming")
  revalidatePath("/analysis")
  return { ok: true }
}

export async function setSupplementalVideoUrl(
  submissionId: string,
  url: string | null,
): Promise<ActionResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "Not authenticated." }

  const trimmed = url?.trim() ?? ""
  let value: string | null = null
  if (trimmed.length > 0) {
    if (!/^https?:\/\/\S+$/i.test(trimmed)) {
      return { ok: false, error: "Enter an http(s) URL." }
    }
    value = trimmed
  }

  const { error } = await supabase
    .from("submissions")
    .update({ supplemental_video_url: value })
    .eq("id", submissionId)
  if (error) return { ok: false, error: error.message }

  revalidatePath(`/submissions/${submissionId}`)
  revalidatePath("/submissions")
  revalidatePath("/judge")
  revalidatePath("/production/programming")
  return { ok: true }
}
