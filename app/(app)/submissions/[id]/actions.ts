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
