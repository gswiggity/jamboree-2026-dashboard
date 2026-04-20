"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { CAMPAIGN_KINDS, type CampaignKind } from "./types"

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

// ————————————————————————————————————————————————————————————
// Campaigns (catalog)
// ————————————————————————————————————————————————————————————

type CampaignInput = {
  name: string
  kind: CampaignKind
  cost_cents: number
  started_on: string | null // YYYY-MM-DD
  ended_on: string | null // YYYY-MM-DD
  notes: string
}

function validateCampaign(input: CampaignInput): string | null {
  if (!input.name.trim()) return "Name can't be empty."
  if (!CAMPAIGN_KINDS.includes(input.kind)) return "Pick a kind."
  if (!Number.isFinite(input.cost_cents) || input.cost_cents < 0) {
    return "Cost must be zero or positive."
  }
  if (
    input.started_on &&
    input.ended_on &&
    input.ended_on < input.started_on
  ) {
    return "End date can't come before the start date."
  }
  return null
}

export async function createCampaign(
  input: CampaignInput,
): Promise<ActionResult<{ id: string }>> {
  const { supabase, user } = await requireUser()
  if (!user) return { ok: false, error: "Not authenticated." }

  const err = validateCampaign(input)
  if (err) return { ok: false, error: err }

  const { data, error } = await supabase
    .from("marketing_campaigns")
    .insert({
      name: input.name.trim(),
      kind: input.kind,
      cost_cents: input.cost_cents,
      started_on: input.started_on,
      ended_on: input.ended_on,
      notes: input.notes.trim(),
      created_by: user.id,
    })
    .select("id")
    .single()

  if (error || !data) {
    return { ok: false, error: error?.message ?? "Failed to create campaign." }
  }

  revalidatePath("/marketing")
  revalidatePath("/tickets")
  return { ok: true, data: { id: data.id } }
}

export async function updateCampaign(
  id: string,
  input: CampaignInput,
): Promise<ActionResult> {
  const { supabase, user } = await requireUser()
  if (!user) return { ok: false, error: "Not authenticated." }

  const err = validateCampaign(input)
  if (err) return { ok: false, error: err }

  const { error } = await supabase
    .from("marketing_campaigns")
    .update({
      name: input.name.trim(),
      kind: input.kind,
      cost_cents: input.cost_cents,
      started_on: input.started_on,
      ended_on: input.ended_on,
      notes: input.notes.trim(),
    })
    .eq("id", id)

  if (error) return { ok: false, error: error.message }
  revalidatePath("/marketing")
  revalidatePath("/tickets")
  return { ok: true, data: null }
}

/**
 * Archive or unarchive a campaign. Archived campaigns stay in the DB so
 * attributed sales keep their reference, but drop off the default view.
 */
export async function setCampaignArchived(
  id: string,
  archived: boolean,
): Promise<ActionResult> {
  const { supabase, user } = await requireUser()
  if (!user) return { ok: false, error: "Not authenticated." }

  const { error } = await supabase
    .from("marketing_campaigns")
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq("id", id)

  if (error) return { ok: false, error: error.message }
  revalidatePath("/marketing")
  revalidatePath("/tickets")
  return { ok: true, data: null }
}

/**
 * Hard delete a campaign. Only allowed when nothing references it —
 * otherwise archive it instead. (The FK on ticket_sales is ON DELETE
 * SET NULL, so a delete wouldn't destroy sales, but it *would* silently
 * erase attribution history — better to make the user confirm via
 * archive.)
 */
export async function deleteCampaign(id: string): Promise<ActionResult> {
  const { supabase, user } = await requireUser()
  if (!user) return { ok: false, error: "Not authenticated." }

  const { count, error: countError } = await supabase
    .from("ticket_sales")
    .select("id", { count: "exact", head: true })
    .eq("campaign_id", id)
  if (countError) return { ok: false, error: countError.message }

  if ((count ?? 0) > 0) {
    return {
      ok: false,
      error:
        "This campaign has sales attributed to it. Archive it instead to keep the attribution trail.",
    }
  }

  const { error } = await supabase
    .from("marketing_campaigns")
    .delete()
    .eq("id", id)
  if (error) return { ok: false, error: error.message }

  revalidatePath("/marketing")
  revalidatePath("/tickets")
  return { ok: true, data: null }
}
