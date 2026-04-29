"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"

type ActionResult<T = null> =
  | { ok: true; data: T }
  | { ok: false; error: string }

async function requireUser() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return { supabase, user }
}

const MAX_NOTE_LEN = 2000

export async function createNote(
  body: string,
): Promise<ActionResult<{ id: string }>> {
  const { supabase, user } = await requireUser()
  if (!user) return { ok: false, error: "Not authenticated." }

  const trimmed = body.trim()
  if (!trimmed) return { ok: false, error: "Note can't be empty." }
  if (trimmed.length > MAX_NOTE_LEN) {
    return { ok: false, error: `Notes max ${MAX_NOTE_LEN} characters.` }
  }

  const { data, error } = await supabase
    .from("notes")
    .insert({ body: trimmed, created_by: user.id })
    .select("id")
    .single()

  if (error || !data) {
    return { ok: false, error: error?.message ?? "Failed to add note." }
  }

  revalidatePath("/dashboard")
  return { ok: true, data: { id: data.id } }
}

export async function updateNote(
  id: string,
  body: string,
): Promise<ActionResult> {
  const { supabase, user } = await requireUser()
  if (!user) return { ok: false, error: "Not authenticated." }

  const trimmed = body.trim()
  if (!trimmed) return { ok: false, error: "Note can't be empty." }
  if (trimmed.length > MAX_NOTE_LEN) {
    return { ok: false, error: `Notes max ${MAX_NOTE_LEN} characters.` }
  }

  const { error } = await supabase
    .from("notes")
    .update({ body: trimmed })
    .eq("id", id)

  if (error) return { ok: false, error: error.message }
  revalidatePath("/dashboard")
  return { ok: true, data: null }
}

export async function setNotePinned(
  id: string,
  pinned: boolean,
): Promise<ActionResult> {
  const { supabase, user } = await requireUser()
  if (!user) return { ok: false, error: "Not authenticated." }

  const { error } = await supabase
    .from("notes")
    .update({ pinned })
    .eq("id", id)

  if (error) return { ok: false, error: error.message }
  revalidatePath("/dashboard")
  return { ok: true, data: null }
}

export async function deleteNote(id: string): Promise<ActionResult> {
  const { supabase, user } = await requireUser()
  if (!user) return { ok: false, error: "Not authenticated." }

  const { error } = await supabase.from("notes").delete().eq("id", id)
  if (error) return { ok: false, error: error.message }
  revalidatePath("/dashboard")
  return { ok: true, data: null }
}
