"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"

type Result<T = unknown> = { ok: true; data: T } | { ok: false; error: string }

export async function setUserRole(
  userId: string,
  role: "admin" | "member",
): Promise<Result> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "Not authenticated." }

  const { data: caller } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()
  if (caller?.role !== "admin") return { ok: false, error: "Admin only." }

  if (user.id === userId && role === "member") {
    return { ok: false, error: "Can't demote yourself." }
  }

  const { error } = await supabase
    .from("profiles")
    .update({ role })
    .eq("id", userId)
  if (error) return { ok: false, error: error.message }

  revalidatePath("/settings")
  return { ok: true, data: null }
}

export async function setVerdictsPublished(
  published: boolean,
): Promise<Result> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "Not authenticated." }

  const { error } = await supabase
    .from("profiles")
    .update({ verdicts_published: published })
    .eq("id", user.id)
  if (error) return { ok: false, error: error.message }

  revalidatePath("/settings")
  revalidatePath("/submissions")
  return { ok: true, data: null }
}
