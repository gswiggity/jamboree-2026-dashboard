// Shared types for the Tickets pillar. Kept separate from `actions.ts`
// because `"use server"` files only allow async function exports.

export const CHANNELS = [
  "door",
  "eventbrite",
  "squarespace",
  "comp",
  "other",
] as const

export type TicketChannel = (typeof CHANNELS)[number]

export type TicketTypeRow = {
  id: string
  name: string
  price_cents: number
  capacity: number | null
  on_date: string | null // YYYY-MM-DD
  start_time: string | null // HH:mm:ss
  sort_order: number
  archived_at: string | null
  notes: string
}

export type TicketSaleRow = {
  id: string
  type_id: string
  quantity: number
  unit_price_cents: number
  channel: TicketChannel
  sold_at: string // ISO timestamp
  buyer_name: string
  buyer_email: string
  reference: string
  notes: string
}

export const CHANNEL_LABELS: Record<TicketChannel, string> = {
  door: "Door",
  eventbrite: "Eventbrite",
  squarespace: "Squarespace",
  comp: "Comp",
  other: "Other",
}
