"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import type { BudgetKind } from "./types"

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

/** Turn a label like "Ticket Sales 2" into a slug "ticket-sales-2". */
function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48)
}

// ————————————————————————————————————————————————————————————
// Categories
// ————————————————————————————————————————————————————————————

export async function createBudgetCategory(input: {
  label: string
  kind: BudgetKind
  sort_order?: number
}): Promise<ActionResult<{ key: string }>> {
  const { supabase, user } = await requireUser()
  if (!user) return { ok: false, error: "Not authenticated." }

  const label = input.label.trim()
  if (!label) return { ok: false, error: "Label can't be empty." }
  const key = slugify(label)
  if (!key) {
    return {
      ok: false,
      error: "Label needs at least one letter or number.",
    }
  }

  const { error } = await supabase.from("budget_categories").insert({
    key,
    label,
    kind: input.kind,
    sort_order: input.sort_order ?? 100,
  })

  if (error) {
    if (error.code === "23505") {
      return { ok: false, error: `A category called "${label}" already exists.` }
    }
    return { ok: false, error: error.message }
  }

  revalidatePath("/budget")
  return { ok: true, data: { key } }
}

export async function updateBudgetCategory(
  key: string,
  patch: { label?: string; sort_order?: number; kind?: BudgetKind },
): Promise<ActionResult> {
  const { supabase, user } = await requireUser()
  if (!user) return { ok: false, error: "Not authenticated." }

  const update: { label?: string; sort_order?: number; kind?: BudgetKind } = {}
  if (patch.label !== undefined) {
    const label = patch.label.trim()
    if (!label) return { ok: false, error: "Label can't be empty." }
    update.label = label
  }
  if (patch.sort_order !== undefined) update.sort_order = patch.sort_order
  if (patch.kind !== undefined) update.kind = patch.kind

  if (Object.keys(update).length === 0) return { ok: true, data: null }

  const { error } = await supabase
    .from("budget_categories")
    .update(update)
    .eq("key", key)

  if (error) return { ok: false, error: error.message }
  revalidatePath("/budget")
  return { ok: true, data: null }
}

export async function deleteBudgetCategory(
  key: string,
): Promise<ActionResult> {
  const { supabase, user } = await requireUser()
  if (!user) return { ok: false, error: "Not authenticated." }

  const { error } = await supabase
    .from("budget_categories")
    .delete()
    .eq("key", key)

  if (error) {
    // 23503 = foreign_key_violation. Items still reference this category.
    if (error.code === "23503") {
      return {
        ok: false,
        error:
          "This category has items in it. Move or delete the items first.",
      }
    }
    return { ok: false, error: error.message }
  }

  revalidatePath("/budget")
  return { ok: true, data: null }
}

// ————————————————————————————————————————————————————————————
// Items
// ————————————————————————————————————————————————————————————

type ItemInput = {
  category_key: string
  description: string
  planned_cents: number
  actual_cents: number | null
  incurred_at: string | null // YYYY-MM-DD or null
  notes: string
}

function validateItem(input: ItemInput): string | null {
  if (!input.category_key) return "Pick a category."
  if (!input.description.trim()) return "Description can't be empty."
  if (!Number.isFinite(input.planned_cents) || input.planned_cents < 0) {
    return "Planned amount must be zero or positive."
  }
  if (
    input.actual_cents !== null &&
    (!Number.isFinite(input.actual_cents) || input.actual_cents < 0)
  ) {
    return "Actual amount must be zero or positive."
  }
  return null
}

export async function createBudgetItem(
  input: ItemInput,
): Promise<ActionResult<{ id: string }>> {
  const { supabase, user } = await requireUser()
  if (!user) return { ok: false, error: "Not authenticated." }

  const err = validateItem(input)
  if (err) return { ok: false, error: err }

  const { data, error } = await supabase
    .from("budget_items")
    .insert({
      category_key: input.category_key,
      description: input.description.trim(),
      planned_cents: input.planned_cents,
      actual_cents: input.actual_cents,
      incurred_at: input.incurred_at,
      notes: input.notes.trim(),
      created_by: user.id,
    })
    .select("id")
    .single()

  if (error || !data) {
    return { ok: false, error: error?.message ?? "Failed to create item." }
  }

  revalidatePath("/budget")
  revalidatePath("/dashboard")
  return { ok: true, data: { id: data.id } }
}

export async function updateBudgetItem(
  id: string,
  input: ItemInput,
): Promise<ActionResult> {
  const { supabase, user } = await requireUser()
  if (!user) return { ok: false, error: "Not authenticated." }

  const err = validateItem(input)
  if (err) return { ok: false, error: err }

  const { error } = await supabase
    .from("budget_items")
    .update({
      category_key: input.category_key,
      description: input.description.trim(),
      planned_cents: input.planned_cents,
      actual_cents: input.actual_cents,
      incurred_at: input.incurred_at,
      notes: input.notes.trim(),
    })
    .eq("id", id)

  if (error) return { ok: false, error: error.message }
  revalidatePath("/budget")
  revalidatePath("/dashboard")
  return { ok: true, data: null }
}

export async function deleteBudgetItem(id: string): Promise<ActionResult> {
  const { supabase, user } = await requireUser()
  if (!user) return { ok: false, error: "Not authenticated." }

  const { error } = await supabase.from("budget_items").delete().eq("id", id)

  if (error) return { ok: false, error: error.message }
  revalidatePath("/budget")
  revalidatePath("/dashboard")
  return { ok: true, data: null }
}
