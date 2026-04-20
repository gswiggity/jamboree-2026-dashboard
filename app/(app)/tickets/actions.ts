"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { CHANNELS, type TicketChannel } from "./types"

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
// Types (catalog)
// ————————————————————————————————————————————————————————————

type TypeInput = {
  name: string
  price_cents: number
  capacity: number | null
  on_date: string | null // YYYY-MM-DD
  start_time: string | null // HH:mm
  sort_order?: number
  notes: string
}

function validateType(input: TypeInput): string | null {
  if (!input.name.trim()) return "Name can't be empty."
  if (!Number.isFinite(input.price_cents) || input.price_cents < 0) {
    return "Price must be zero or positive."
  }
  if (
    input.capacity !== null &&
    (!Number.isFinite(input.capacity) || input.capacity < 1)
  ) {
    return "Capacity must be at least 1 (leave blank for unlimited)."
  }
  return null
}

export async function createTicketType(
  input: TypeInput,
): Promise<ActionResult<{ id: string }>> {
  const { supabase, user } = await requireUser()
  if (!user) return { ok: false, error: "Not authenticated." }

  const err = validateType(input)
  if (err) return { ok: false, error: err }

  const { data, error } = await supabase
    .from("ticket_types")
    .insert({
      name: input.name.trim(),
      price_cents: input.price_cents,
      capacity: input.capacity,
      on_date: input.on_date,
      start_time: input.start_time,
      sort_order: input.sort_order ?? 100,
      notes: input.notes.trim(),
      created_by: user.id,
    })
    .select("id")
    .single()

  if (error || !data) {
    return { ok: false, error: error?.message ?? "Failed to create type." }
  }

  revalidatePath("/tickets")
  revalidatePath("/dashboard")
  return { ok: true, data: { id: data.id } }
}

export async function updateTicketType(
  id: string,
  input: TypeInput,
): Promise<ActionResult> {
  const { supabase, user } = await requireUser()
  if (!user) return { ok: false, error: "Not authenticated." }

  const err = validateType(input)
  if (err) return { ok: false, error: err }

  const { error } = await supabase
    .from("ticket_types")
    .update({
      name: input.name.trim(),
      price_cents: input.price_cents,
      capacity: input.capacity,
      on_date: input.on_date,
      start_time: input.start_time,
      sort_order: input.sort_order ?? 100,
      notes: input.notes.trim(),
    })
    .eq("id", id)

  if (error) return { ok: false, error: error.message }
  revalidatePath("/tickets")
  revalidatePath("/dashboard")
  return { ok: true, data: null }
}

/**
 * Archive or unarchive a ticket type. Archived types stay in the DB so their
 * sales history is preserved, but drop off the default view.
 */
export async function setTicketTypeArchived(
  id: string,
  archived: boolean,
): Promise<ActionResult> {
  const { supabase, user } = await requireUser()
  if (!user) return { ok: false, error: "Not authenticated." }

  const { error } = await supabase
    .from("ticket_types")
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq("id", id)

  if (error) return { ok: false, error: error.message }
  revalidatePath("/tickets")
  return { ok: true, data: null }
}

/**
 * Hard delete a ticket type. Only allowed when no sales are attached —
 * otherwise archive it instead (sales are an audit trail).
 */
export async function deleteTicketType(id: string): Promise<ActionResult> {
  const { supabase, user } = await requireUser()
  if (!user) return { ok: false, error: "Not authenticated." }

  const { count, error: countError } = await supabase
    .from("ticket_sales")
    .select("id", { count: "exact", head: true })
    .eq("type_id", id)
  if (countError) return { ok: false, error: countError.message }

  if ((count ?? 0) > 0) {
    return {
      ok: false,
      error:
        "This type has sales logged against it. Archive it instead to keep the history.",
    }
  }

  const { error } = await supabase.from("ticket_types").delete().eq("id", id)
  if (error) return { ok: false, error: error.message }

  revalidatePath("/tickets")
  return { ok: true, data: null }
}

// ————————————————————————————————————————————————————————————
// Sales (log)
// ————————————————————————————————————————————————————————————

type SaleInput = {
  type_id: string
  quantity: number
  unit_price_cents: number
  channel: TicketChannel
  sold_at: string // ISO
  buyer_name: string
  buyer_email: string
  reference: string
  campaign_id: string | null
  notes: string
}

function validateSale(input: SaleInput): string | null {
  if (!input.type_id) return "Pick a ticket type."
  if (!Number.isFinite(input.quantity) || input.quantity < 1) {
    return "Quantity must be at least 1."
  }
  if (
    !Number.isFinite(input.unit_price_cents) ||
    input.unit_price_cents < 0
  ) {
    return "Unit price must be zero or positive."
  }
  if (!CHANNELS.includes(input.channel)) return "Pick a channel."
  if (!input.sold_at) return "Pick a sale date."
  return null
}

export async function createTicketSale(
  input: SaleInput,
): Promise<ActionResult<{ id: string }>> {
  const { supabase, user } = await requireUser()
  if (!user) return { ok: false, error: "Not authenticated." }

  const err = validateSale(input)
  if (err) return { ok: false, error: err }

  const { data, error } = await supabase
    .from("ticket_sales")
    .insert({
      type_id: input.type_id,
      quantity: input.quantity,
      unit_price_cents: input.unit_price_cents,
      channel: input.channel,
      sold_at: input.sold_at,
      buyer_name: input.buyer_name.trim(),
      buyer_email: input.buyer_email.trim().toLowerCase(),
      reference: input.reference.trim(),
      campaign_id: input.campaign_id,
      notes: input.notes.trim(),
      created_by: user.id,
    })
    .select("id")
    .single()

  if (error || !data) {
    return { ok: false, error: error?.message ?? "Failed to log sale." }
  }

  revalidatePath("/tickets")
  revalidatePath("/marketing")
  revalidatePath("/dashboard")
  return { ok: true, data: { id: data.id } }
}

export async function updateTicketSale(
  id: string,
  input: SaleInput,
): Promise<ActionResult> {
  const { supabase, user } = await requireUser()
  if (!user) return { ok: false, error: "Not authenticated." }

  const err = validateSale(input)
  if (err) return { ok: false, error: err }

  const { error } = await supabase
    .from("ticket_sales")
    .update({
      type_id: input.type_id,
      quantity: input.quantity,
      unit_price_cents: input.unit_price_cents,
      channel: input.channel,
      sold_at: input.sold_at,
      buyer_name: input.buyer_name.trim(),
      buyer_email: input.buyer_email.trim().toLowerCase(),
      reference: input.reference.trim(),
      campaign_id: input.campaign_id,
      notes: input.notes.trim(),
    })
    .eq("id", id)

  if (error) return { ok: false, error: error.message }
  revalidatePath("/tickets")
  revalidatePath("/marketing")
  revalidatePath("/dashboard")
  return { ok: true, data: null }
}

export async function deleteTicketSale(id: string): Promise<ActionResult> {
  const { supabase, user } = await requireUser()
  if (!user) return { ok: false, error: "Not authenticated." }

  const { error } = await supabase.from("ticket_sales").delete().eq("id", id)
  if (error) return { ok: false, error: error.message }

  revalidatePath("/tickets")
  revalidatePath("/marketing")
  revalidatePath("/dashboard")
  return { ok: true, data: null }
}
