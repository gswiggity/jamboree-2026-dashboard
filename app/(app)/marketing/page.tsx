import { createClient } from "@/lib/supabase/server"
import { PageHeader } from "@/components/ui/page-header"
import { MarketingShell } from "./marketing-shell"
import {
  CAMPAIGN_KINDS,
  type AttributedSale,
  type CampaignKind,
  type MarketingCampaignRow,
} from "./types"

export default async function MarketingPage() {
  const supabase = await createClient()

  const [{ data: campaigns }, { data: sales }] = await Promise.all([
    supabase
      .from("marketing_campaigns")
      .select(
        "id, name, kind, cost_cents, started_on, ended_on, notes, archived_at",
      )
      .order("archived_at", { ascending: true, nullsFirst: true })
      .order("started_on", { ascending: false, nullsFirst: false })
      .order("name", { ascending: true }),
    // Only need the bits that feed per-campaign aggregation.
    supabase
      .from("ticket_sales")
      .select("campaign_id, quantity, unit_price_cents")
      .not("campaign_id", "is", null),
  ])

  const campaignRows: MarketingCampaignRow[] = (campaigns ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    kind: (CAMPAIGN_KINDS as readonly string[]).includes(c.kind)
      ? (c.kind as CampaignKind)
      : "other",
    cost_cents: c.cost_cents,
    started_on: c.started_on,
    ended_on: c.ended_on,
    notes: c.notes,
    archived_at: c.archived_at,
  }))

  const attributedSales: AttributedSale[] = (sales ?? [])
    .filter((s): s is typeof s & { campaign_id: string } => !!s.campaign_id)
    .map((s) => ({
      campaign_id: s.campaign_id,
      quantity: s.quantity,
      unit_price_cents: s.unit_price_cents,
    }))

  return (
    <div className="space-y-6">
      <PageHeader
        kicker="Marketing"
        title="Audience"
        accent="growth"
        description="Track what you're spending on promotion and which campaigns actually move tickets."
      />

      <MarketingShell campaigns={campaignRows} attributedSales={attributedSales} />
    </div>
  )
}
