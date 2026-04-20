import { createClient } from "@/lib/supabase/server"
import { TicketsShell } from "./tickets-shell"
import type {
  CampaignOption,
  TicketChannel,
  TicketSaleRow,
  TicketTypeRow,
} from "./types"
import { CHANNELS } from "./types"

export default async function TicketsPage() {
  const supabase = await createClient()

  const [{ data: types }, { data: sales }, { data: campaigns }] =
    await Promise.all([
      supabase
        .from("ticket_types")
        .select(
          "id, name, price_cents, capacity, on_date, start_time, sort_order, archived_at, notes",
        )
        .order("archived_at", { ascending: true, nullsFirst: true })
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true }),
      supabase
        .from("ticket_sales")
        .select(
          "id, type_id, quantity, unit_price_cents, channel, sold_at, buyer_name, buyer_email, reference, campaign_id, notes",
        )
        .order("sold_at", { ascending: false }),
      supabase
        .from("marketing_campaigns")
        .select("id, name, archived_at")
        .order("archived_at", { ascending: true, nullsFirst: true })
        .order("name", { ascending: true }),
    ])

  const typeRows: TicketTypeRow[] = (types ?? []).map((t) => ({
    id: t.id,
    name: t.name,
    price_cents: t.price_cents,
    capacity: t.capacity,
    on_date: t.on_date,
    start_time: t.start_time,
    sort_order: t.sort_order,
    archived_at: t.archived_at,
    notes: t.notes,
  }))

  const saleRows: TicketSaleRow[] = (sales ?? []).map((s) => ({
    id: s.id,
    type_id: s.type_id,
    quantity: s.quantity,
    unit_price_cents: s.unit_price_cents,
    channel: (CHANNELS as readonly string[]).includes(s.channel)
      ? (s.channel as TicketChannel)
      : "other",
    sold_at: s.sold_at,
    buyer_name: s.buyer_name,
    buyer_email: s.buyer_email,
    reference: s.reference,
    campaign_id: s.campaign_id,
    notes: s.notes,
  }))

  const campaignOptions: CampaignOption[] = (campaigns ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    archived_at: c.archived_at,
  }))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Tickets</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Track who&apos;s coming and how much money is landing per show.
        </p>
      </div>

      <TicketsShell
        types={typeRows}
        sales={saleRows}
        campaigns={campaignOptions}
      />
    </div>
  )
}
