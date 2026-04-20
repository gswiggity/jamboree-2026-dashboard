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

/** Normalize a "YYYY-MM-DD" date string (HTML date input). Empty → null. */
function normalizeDueDate(raw: string | null | undefined): string | null {
  if (!raw) return null
  const trimmed = raw.trim()
  return trimmed.length > 0 ? trimmed : null
}

function normalizeAssignee(raw: string | null | undefined): string | null {
  if (!raw) return null
  const trimmed = raw.trim()
  return trimmed.length > 0 ? trimmed : null
}

/** Create a new task. Title is required; everything else is optional. */
export async function createTask(input: {
  title: string
  description: string
  assigned_to: string | null
  due_date: string | null
}): Promise<ActionResult<{ id: string }>> {
  const { supabase, user } = await requireUser()
  if (!user) return { ok: false, error: "Not authenticated." }

  const title = input.title.trim()
  if (!title) return { ok: false, error: "Title can't be empty." }

  const { data, error } = await supabase
    .from("tasks")
    .insert({
      title,
      description: input.description.trim(),
      assigned_to: normalizeAssignee(input.assigned_to),
      due_date: normalizeDueDate(input.due_date),
      created_by: user.id,
    })
    .select("id")
    .single()

  if (error || !data) {
    return { ok: false, error: error?.message ?? "Failed to create task." }
  }

  revalidatePath("/tasks")
  revalidatePath("/dashboard")
  return { ok: true, data: { id: data.id } }
}

/** Update a task's editable fields. Completion state is separate (see toggle). */
export async function updateTask(
  id: string,
  patch: {
    title: string
    description: string
    assigned_to: string | null
    due_date: string | null
  },
): Promise<ActionResult> {
  const { supabase, user } = await requireUser()
  if (!user) return { ok: false, error: "Not authenticated." }

  const title = patch.title.trim()
  if (!title) return { ok: false, error: "Title can't be empty." }

  const { error } = await supabase
    .from("tasks")
    .update({
      title,
      description: patch.description.trim(),
      assigned_to: normalizeAssignee(patch.assigned_to),
      due_date: normalizeDueDate(patch.due_date),
    })
    .eq("id", id)

  if (error) return { ok: false, error: error.message }
  revalidatePath("/tasks")
  revalidatePath("/dashboard")
  return { ok: true, data: null }
}

/** Flip a task between open and done. Records who completed it + when. */
export async function setTaskComplete(
  id: string,
  done: boolean,
): Promise<ActionResult> {
  const { supabase, user } = await requireUser()
  if (!user) return { ok: false, error: "Not authenticated." }

  const { error } = await supabase
    .from("tasks")
    .update({
      completed_at: done ? new Date().toISOString() : null,
      completed_by: done ? user.id : null,
    })
    .eq("id", id)

  if (error) return { ok: false, error: error.message }
  revalidatePath("/tasks")
  revalidatePath("/dashboard")
  return { ok: true, data: null }
}

/** Reassign a task in-place — cheap enough to have its own action. */
export async function reassignTask(
  id: string,
  assignedTo: string | null,
): Promise<ActionResult> {
  const { supabase, user } = await requireUser()
  if (!user) return { ok: false, error: "Not authenticated." }

  const { error } = await supabase
    .from("tasks")
    .update({ assigned_to: normalizeAssignee(assignedTo) })
    .eq("id", id)

  if (error) return { ok: false, error: error.message }
  revalidatePath("/tasks")
  return { ok: true, data: null }
}

/** Hard-delete a task. */
export async function deleteTask(id: string): Promise<ActionResult> {
  const { supabase, user } = await requireUser()
  if (!user) return { ok: false, error: "Not authenticated." }

  const { error } = await supabase.from("tasks").delete().eq("id", id)
  if (error) return { ok: false, error: error.message }
  revalidatePath("/tasks")
  revalidatePath("/dashboard")
  return { ok: true, data: null }
}
