"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"

type Result<T = null> = { ok: true; data: T } | { ok: false; error: string }

// Permissive RFC-ish email check. We're not a mail server — this is just to
// catch obvious typos before hitting the DB.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

async function requireAdmin(): Promise<
  | { ok: true; supabase: Awaited<ReturnType<typeof createClient>>; userId: string }
  | { ok: false; error: string }
> {
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

  return { ok: true, supabase, userId: user.id }
}

/** Add an email to the invite allowlist. Idempotent on duplicates. */
export async function addAllowedEmail(email: string): Promise<Result> {
  const guard = await requireAdmin()
  if (!guard.ok) return { ok: false, error: guard.error }
  const { supabase, userId } = guard

  const normalized = email.trim().toLowerCase()
  if (!normalized) return { ok: false, error: "Enter an email." }
  if (!EMAIL_PATTERN.test(normalized)) {
    return { ok: false, error: "That doesn't look like an email." }
  }

  const { error } = await supabase
    .from("allowed_emails")
    .insert({ email: normalized, invited_by: userId })

  if (error) {
    // 23505 = unique_violation. Treat as a soft success so the admin isn't
    // confused when re-adding an existing entry.
    if (error.code === "23505") {
      return { ok: false, error: `${normalized} is already on the list.` }
    }
    return { ok: false, error: error.message }
  }

  revalidatePath("/settings")
  return { ok: true, data: null }
}

/** Remove an email from the invite allowlist. */
export async function removeAllowedEmail(email: string): Promise<Result> {
  const guard = await requireAdmin()
  if (!guard.ok) return { ok: false, error: guard.error }
  const { supabase } = guard

  const normalized = email.trim().toLowerCase()
  if (!normalized) return { ok: false, error: "Missing email." }

  const { error } = await supabase
    .from("allowed_emails")
    .delete()
    .eq("email", normalized)

  if (error) return { ok: false, error: error.message }

  revalidatePath("/settings")
  return { ok: true, data: null }
}
