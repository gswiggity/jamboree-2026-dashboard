"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { slugifyPhaseKey } from "@/lib/phases"

type ActionResult = { ok: true } | { ok: false; error: string }

async function requireUser() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { supabase, user: null }
  return { supabase, user }
}

function revalidateAll() {
  revalidatePath("/dashboard")
  revalidatePath("/settings")
}

/** Point the festival at a different phase. */
export async function updateFestivalPhase(phase: string): Promise<ActionResult> {
  if (!phase) return { ok: false, error: "Missing phase." }

  const { supabase, user } = await requireUser()
  if (!user) return { ok: false, error: "Not authenticated." }

  const { error } = await supabase
    .from("festival_settings")
    .update({ phase, updated_by: user.id })
    .eq("id", true)

  if (error) return { ok: false, error: error.message }
  revalidateAll()
  return { ok: true }
}

type PhaseInput = {
  key: string
  label: string
  short: string
  blurb: string
  sort_order: number
}

function normalizeInput(input: PhaseInput): { ok: true; row: PhaseInput } | ActionResult {
  const key = slugifyPhaseKey(input.key)
  if (!key) return { ok: false, error: "Key can't be empty." }
  const label = input.label.trim()
  if (!label) return { ok: false, error: "Label is required." }
  const short = input.short.trim()
  if (!short) return { ok: false, error: "Short name is required." }
  const blurb = input.blurb.trim()
  const sort_order = Number.isFinite(input.sort_order) ? Math.round(input.sort_order) : 0
  return { ok: true, row: { key, label, short, blurb, sort_order } }
}

/** Create a new phase. */
export async function createPhase(input: PhaseInput): Promise<ActionResult> {
  const normalized = normalizeInput(input)
  if (!("row" in normalized)) return normalized

  const { supabase, user } = await requireUser()
  if (!user) return { ok: false, error: "Not authenticated." }

  const { error } = await supabase.from("phases").insert(normalized.row)
  if (error) {
    // Duplicate key is the one user-facing error worth naming.
    if (error.code === "23505") {
      return { ok: false, error: `A phase with key "${normalized.row.key}" already exists.` }
    }
    return { ok: false, error: error.message }
  }
  revalidateAll()
  return { ok: true }
}

/**
 * Update an existing phase. Key is the identifier; if `input.key` differs
 * from the existing key, it's treated as a rename (FK ON UPDATE CASCADE
 * handles propagation).
 */
export async function updatePhase(
  originalKey: string,
  input: PhaseInput,
): Promise<ActionResult> {
  if (!originalKey) return { ok: false, error: "Missing original key." }
  const normalized = normalizeInput(input)
  if (!("row" in normalized)) return normalized

  const { supabase, user } = await requireUser()
  if (!user) return { ok: false, error: "Not authenticated." }

  const { error } = await supabase
    .from("phases")
    .update(normalized.row)
    .eq("key", originalKey)

  if (error) {
    if (error.code === "23505") {
      return { ok: false, error: `A phase with key "${normalized.row.key}" already exists.` }
    }
    return { ok: false, error: error.message }
  }
  revalidateAll()
  return { ok: true }
}

/** Delete a phase. FK RESTRICT prevents deleting the currently-active phase. */
export async function deletePhase(key: string): Promise<ActionResult> {
  if (!key) return { ok: false, error: "Missing phase key." }

  const { supabase, user } = await requireUser()
  if (!user) return { ok: false, error: "Not authenticated." }

  const { error } = await supabase.from("phases").delete().eq("key", key)
  if (error) {
    if (error.code === "23503") {
      return {
        ok: false,
        error: "Can't delete the currently-active phase. Switch to a different phase first.",
      }
    }
    return { ok: false, error: error.message }
  }
  revalidateAll()
  return { ok: true }
}
