// Shared types for the Marketing attribution pillar. Kept out of
// `actions.ts` because `"use server"` files only allow async exports.

export const CAMPAIGN_KINDS = [
  "social",
  "email",
  "print",
  "press",
  "referral",
  "paid_ads",
  "other",
] as const

export type CampaignKind = (typeof CAMPAIGN_KINDS)[number]

export const CAMPAIGN_KIND_LABELS: Record<CampaignKind, string> = {
  social: "Social",
  email: "Email",
  print: "Print",
  press: "Press",
  referral: "Referral",
  paid_ads: "Paid ads",
  other: "Other",
}

export const CAMPAIGN_KIND_HELP: Record<CampaignKind, string> = {
  social: "Instagram, TikTok, Facebook, Reels, etc.",
  email: "Newsletters, direct email blasts",
  print: "Flyers, posters, stickers, signage",
  press: "Podcast mentions, interviews, write-ups",
  referral: "Word-of-mouth, performer networks",
  paid_ads: "Paid placements (Meta / Google / etc.)",
  other: "Everything else",
}

export type MarketingCampaignRow = {
  id: string
  name: string
  kind: CampaignKind
  cost_cents: number
  started_on: string | null // YYYY-MM-DD
  ended_on: string | null // YYYY-MM-DD
  notes: string
  archived_at: string | null
}

/**
 * Slim shape used for cross-page attribution summaries. Enough to total
 * revenue and count tickets without needing the full ticket_sales row.
 */
export type AttributedSale = {
  campaign_id: string
  quantity: number
  unit_price_cents: number
}
