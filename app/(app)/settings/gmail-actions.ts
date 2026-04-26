"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"

type Result = { ok: true } | { ok: false; error: string }

export async function disconnectGmail(): Promise<Result> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "Not authenticated." }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()
  if (profile?.role !== "admin") return { ok: false, error: "Admin only." }

  const { error } = await supabase
    .from("gmail_integration")
    .update({
      account_email: null,
      refresh_token: null,
      scopes: null,
      connected_at: null,
      connected_by: null,
      last_used_at: null,
    })
    .eq("id", true)
  if (error) return { ok: false, error: error.message }

  revalidatePath("/settings")
  revalidatePath("/submissions")
  return { ok: true }
}
