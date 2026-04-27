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

function refreshLineup() {
  revalidatePath("/lineup")
}

/* ---------------- columns ---------------- */

export async function createColumn(
  title: string,
): Promise<ActionResult<{ id: string }>> {
  const { supabase, user } = await requireUser()
  if (!user) return { ok: false, error: "Not authenticated." }

  const cleaned = title.trim()
  if (!cleaned) return { ok: false, error: "Column title can't be empty." }

  const { data: maxRow } = await supabase
    .from("lineup_columns")
    .select("position")
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle()
  const nextPosition = (maxRow?.position ?? -1) + 1

  const { data, error } = await supabase
    .from("lineup_columns")
    .insert({ title: cleaned, position: nextPosition })
    .select("id")
    .single()

  if (error || !data) {
    return { ok: false, error: error?.message ?? "Failed to create column." }
  }
  refreshLineup()
  return { ok: true, data: { id: data.id } }
}

export async function renameColumn(
  id: string,
  title: string,
): Promise<ActionResult> {
  const { supabase, user } = await requireUser()
  if (!user) return { ok: false, error: "Not authenticated." }

  const cleaned = title.trim()
  if (!cleaned) return { ok: false, error: "Column title can't be empty." }

  const { error } = await supabase
    .from("lineup_columns")
    .update({ title: cleaned })
    .eq("id", id)

  if (error) return { ok: false, error: error.message }
  refreshLineup()
  return { ok: true, data: null }
}

export async function deleteColumn(id: string): Promise<ActionResult> {
  const { supabase, user } = await requireUser()
  if (!user) return { ok: false, error: "Not authenticated." }

  // ON DELETE SET NULL on lineup_cards.column_id sends cards back to Unsorted.
  const { error } = await supabase.from("lineup_columns").delete().eq("id", id)
  if (error) return { ok: false, error: error.message }
  refreshLineup()
  return { ok: true, data: null }
}

/** Reorder columns. `orderedIds` is the full list left-to-right. */
export async function reorderColumns(
  orderedIds: string[],
): Promise<ActionResult> {
  const { supabase, user } = await requireUser()
  if (!user) return { ok: false, error: "Not authenticated." }

  // Update each row to its new position. Small N (~10), so per-row updates are fine.
  for (let i = 0; i < orderedIds.length; i++) {
    const { error } = await supabase
      .from("lineup_columns")
      .update({ position: i })
      .eq("id", orderedIds[i])
    if (error) return { ok: false, error: error.message }
  }
  refreshLineup()
  return { ok: true, data: null }
}

/* ---------------- cards ---------------- */

/**
 * Move a card. `columnId === null` puts it in the Unsorted pile.
 * `affectedOrder` is the full ordered list of card ids in the destination
 * column AFTER the move (top-to-bottom). The source column also needs
 * resequencing if it's different — caller passes both.
 */
export async function moveCard(input: {
  cardId: string
  columnId: string | null
  destOrder: string[]
  sourceColumnId?: string | null
  sourceOrder?: string[]
}): Promise<ActionResult> {
  const { supabase, user } = await requireUser()
  if (!user) return { ok: false, error: "Not authenticated." }

  // 1. Set the card's new column.
  const { error: moveErr } = await supabase
    .from("lineup_cards")
    .update({ column_id: input.columnId })
    .eq("id", input.cardId)
  if (moveErr) return { ok: false, error: moveErr.message }

  // 2. Resequence the destination column.
  for (let i = 0; i < input.destOrder.length; i++) {
    const { error } = await supabase
      .from("lineup_cards")
      .update({ position: i })
      .eq("id", input.destOrder[i])
    if (error) return { ok: false, error: error.message }
  }

  // 3. Resequence the source column if cross-column move.
  if (
    input.sourceOrder &&
    input.sourceColumnId !== undefined &&
    input.sourceColumnId !== input.columnId
  ) {
    for (let i = 0; i < input.sourceOrder.length; i++) {
      const { error } = await supabase
        .from("lineup_cards")
        .update({ position: i })
        .eq("id", input.sourceOrder[i])
      if (error) return { ok: false, error: error.message }
    }
  }

  refreshLineup()
  return { ok: true, data: null }
}

export async function setCardSetLength(
  cardId: string,
  minutes: number | null,
): Promise<ActionResult> {
  const { supabase, user } = await requireUser()
  if (!user) return { ok: false, error: "Not authenticated." }

  let value: number | null = null
  if (minutes !== null && minutes !== undefined) {
    if (!Number.isFinite(minutes) || minutes < 0) {
      return { ok: false, error: "Set length must be ≥ 0." }
    }
    value = Math.round(minutes)
  }

  const { error } = await supabase
    .from("lineup_cards")
    .update({ set_length_minutes: value })
    .eq("id", cardId)

  if (error) return { ok: false, error: error.message }
  refreshLineup()
  return { ok: true, data: null }
}

export async function setCardTags(
  cardId: string,
  tags: string[],
): Promise<ActionResult> {
  const { supabase, user } = await requireUser()
  if (!user) return { ok: false, error: "Not authenticated." }

  const cleaned = Array.from(
    new Set(
      tags
        .map((t) => t.trim().toLowerCase())
        .filter((t) => t.length > 0 && t.length <= 32),
    ),
  )

  const { error } = await supabase
    .from("lineup_cards")
    .update({ tags: cleaned })
    .eq("id", cardId)

  if (error) return { ok: false, error: error.message }
  refreshLineup()
  return { ok: true, data: null }
}
