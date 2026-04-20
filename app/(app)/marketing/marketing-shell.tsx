"use client"

import { useMemo, useState } from "react"
import {
  Archive,
  Calendar,
  Megaphone,
  Pencil,
  Plus,
  Ticket,
  TrendingUp,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  createCampaign,
  deleteCampaign,
  setCampaignArchived,
  updateCampaign,
} from "./actions"
import { CampaignDialog } from "./campaign-dialog"
import {
  CAMPAIGN_KIND_LABELS,
  type AttributedSale,
  type MarketingCampaignRow,
} from "./types"

type ShellProps = {
  campaigns: MarketingCampaignRow[]
  attributedSales: AttributedSale[]
}

type CampaignStats = {
  tickets: number
  revenue: number
}

export function MarketingShell({ campaigns, attributedSales }: ShellProps) {
  const [editing, setEditing] = useState<MarketingCampaignRow | null>(null)
  const [creating, setCreating] = useState(false)

  // campaign_id → rolled-up sales stats
  const statsByCampaign = useMemo(() => {
    const m = new Map<string, CampaignStats>()
    for (const s of attributedSales) {
      const entry = m.get(s.campaign_id) ?? { tickets: 0, revenue: 0 }
      entry.tickets += s.quantity
      entry.revenue += s.quantity * s.unit_price_cents
      m.set(s.campaign_id, entry)
    }
    return m
  }, [attributedSales])

  // Top-line totals. Spend is across active campaigns only (archived
  // campaigns tend to be from old events and would skew "am I overspending
  // this year" at a glance). Attributed stats use every sale with a
  // campaign_id, even if the campaign is archived.
  const totals = useMemo(() => {
    let spend = 0
    for (const c of campaigns) {
      if (c.archived_at) continue
      spend += c.cost_cents
    }
    let attributedTickets = 0
    let attributedRevenue = 0
    for (const s of attributedSales) {
      attributedTickets += s.quantity
      attributedRevenue += s.quantity * s.unit_price_cents
    }
    const roi =
      spend === 0 ? null : (attributedRevenue - spend) / spend // e.g. 1.5 == +150%
    return {
      spend,
      attributedTickets,
      attributedRevenue,
      roi,
    }
  }, [campaigns, attributedSales])

  const activeCampaigns = useMemo(
    () => campaigns.filter((c) => !c.archived_at),
    [campaigns],
  )
  const archivedCampaigns = useMemo(
    () => campaigns.filter((c) => c.archived_at),
    [campaigns],
  )

  return (
    <div className="space-y-5">
      <StatsBar totals={totals} />

      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-700">
          Active
          <span className="ml-2 text-slate-400 font-normal tabular-nums">
            {activeCampaigns.length}
          </span>
        </h2>
        <Button type="button" size="sm" onClick={() => setCreating(true)}>
          <Plus className="h-3.5 w-3.5 mr-1" />
          Add campaign
        </Button>
      </div>

      {activeCampaigns.length === 0 ? (
        <EmptyState
          title="No campaigns yet."
          body="Track a campaign — a poster run, an Instagram post, an email blast — and attribute ticket sales to it to see what's working."
        />
      ) : (
        <ul className="space-y-2">
          {activeCampaigns.map((c) => (
            <CampaignCard
              key={c.id}
              campaign={c}
              stats={statsByCampaign.get(c.id)}
              onEdit={() => setEditing(c)}
            />
          ))}
        </ul>
      )}

      {archivedCampaigns.length > 0 && (
        <details className="rounded-2xl border border-slate-200/70 bg-white/40">
          <summary className="cursor-pointer select-none px-4 py-2.5 text-sm font-medium text-slate-600 hover:text-slate-900">
            Archived
            <span className="ml-2 text-slate-400 font-normal tabular-nums">
              {archivedCampaigns.length}
            </span>
          </summary>
          <ul className="space-y-2 p-2 pt-0">
            {archivedCampaigns.map((c) => (
              <CampaignCard
                key={c.id}
                campaign={c}
                stats={statsByCampaign.get(c.id)}
                onEdit={() => setEditing(c)}
              />
            ))}
          </ul>
        </details>
      )}

      <CampaignDialog
        mode={creating ? "create" : editing ? "edit" : "closed"}
        initial={editing}
        isArchived={editing?.archived_at !== null && editing !== null}
        onClose={() => {
          setCreating(false)
          setEditing(null)
        }}
        onSubmit={async (input) => {
          if (creating) return createCampaign(input)
          if (editing) return updateCampaign(editing.id, input)
          return { ok: false as const, error: "No campaign open." }
        }}
        onArchiveToggle={
          editing
            ? async () =>
                setCampaignArchived(editing.id, editing.archived_at === null)
            : undefined
        }
        onDelete={
          editing ? async () => deleteCampaign(editing.id) : undefined
        }
      />
    </div>
  )
}

// ——————————————————————————————————————————————————————————
// Stats bar
// ——————————————————————————————————————————————————————————

function StatsBar({
  totals,
}: {
  totals: {
    spend: number
    attributedTickets: number
    attributedRevenue: number
    roi: number | null
  }
}) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
      <Stat label="Spend (active)" value={formatMoney(totals.spend)} />
      <Stat
        label="Tickets attributed"
        value={totals.attributedTickets}
        sub={totals.attributedTickets === 1 ? "sale" : "sales"}
      />
      <Stat
        label="Revenue attributed"
        value={formatMoney(totals.attributedRevenue)}
        tone="good"
      />
      <Stat
        label="ROI"
        value={totals.roi === null ? "—" : formatRoi(totals.roi)}
        sub={
          totals.roi === null
            ? "No spend logged"
            : totals.roi >= 0
              ? "net positive"
              : "underwater"
        }
        tone={
          totals.roi === null
            ? "neutral"
            : totals.roi >= 1
              ? "good"
              : totals.roi >= 0
                ? "warn"
                : "alert"
        }
      />
    </div>
  )
}

function Stat({
  label,
  value,
  sub,
  tone = "neutral",
}: {
  label: string
  value: number | string
  sub?: string
  tone?: "neutral" | "good" | "warn" | "alert"
}) {
  const toneClasses = {
    neutral: "text-slate-900",
    good: "text-emerald-700",
    warn: "text-amber-700",
    alert: "text-rose-700",
  }[tone]
  return (
    <div className="rounded-2xl border border-white/70 bg-white/65 backdrop-blur-xl px-4 py-3 shadow-[0_8px_28px_-18px_rgba(30,58,138,0.18)]">
      <div className="text-[10px] uppercase tracking-[0.18em] font-semibold text-slate-500">
        {label}
      </div>
      <div className="mt-1 flex items-baseline gap-1.5 flex-wrap">
        <span className={cn("text-2xl font-semibold tabular-nums", toneClasses)}>
          {value}
        </span>
        {sub && (
          <span className="text-xs font-medium text-slate-500 tabular-nums">
            {sub}
          </span>
        )}
      </div>
    </div>
  )
}

// ——————————————————————————————————————————————————————————
// Campaign card
// ——————————————————————————————————————————————————————————

function CampaignCard({
  campaign,
  stats,
  onEdit,
}: {
  campaign: MarketingCampaignRow
  stats?: CampaignStats
  onEdit: () => void
}) {
  const tickets = stats?.tickets ?? 0
  const revenue = stats?.revenue ?? 0
  const hasCost = campaign.cost_cents > 0
  // ROI: positive = making money back; we show as a fraction of cost.
  const roi = hasCost ? (revenue - campaign.cost_cents) / campaign.cost_cents : null

  const tone = !hasCost
    ? "neutral"
    : roi! >= 1
      ? "good"
      : roi! >= 0
        ? "warn"
        : "alert"

  const toneChip = {
    neutral: "bg-slate-100 text-slate-700",
    good: "bg-emerald-100 text-emerald-800",
    warn: "bg-amber-100 text-amber-900",
    alert: "bg-rose-100 text-rose-800",
  }[tone]

  return (
    <li
      className={cn(
        "rounded-2xl border border-white/70 bg-white/65 backdrop-blur-xl px-4 py-3 shadow-[0_8px_28px_-18px_rgba(30,58,138,0.18)]",
        campaign.archived_at && "opacity-70",
      )}
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-sm font-semibold text-slate-900">
              {campaign.name}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 border border-blue-100 px-2 py-0.5 text-[11px] font-medium text-blue-900">
              <Megaphone className="h-3 w-3" />
              {CAMPAIGN_KIND_LABELS[campaign.kind]}
            </span>
            {campaign.archived_at && (
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] uppercase tracking-wider text-slate-600">
                <Archive className="h-2.5 w-2.5" />
                Archived
              </span>
            )}
            {hasCost && (
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium tabular-nums",
                  toneChip,
                )}
              >
                <TrendingUp className="h-3 w-3" />
                {formatRoi(roi!)}
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-slate-600">
            <span className="inline-flex items-center gap-1 tabular-nums">
              Spend {formatMoney(campaign.cost_cents)}
            </span>
            <span className="inline-flex items-center gap-1 tabular-nums">
              <Ticket className="h-3 w-3" />
              {tickets} ticket{tickets === 1 ? "" : "s"}
            </span>
            <span className="inline-flex items-center gap-1 tabular-nums">
              {formatMoney(revenue)} attributed
            </span>
            {(campaign.started_on || campaign.ended_on) && (
              <span className="inline-flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {formatDateRange(campaign.started_on, campaign.ended_on)}
              </span>
            )}
          </div>
          {campaign.notes && (
            <p className="text-xs text-slate-500 mt-1.5 whitespace-pre-wrap">
              {campaign.notes}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1 shrink-0">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={onEdit}
            className="text-slate-600"
          >
            <Pencil className="h-3.5 w-3.5 mr-1" />
            Edit
          </Button>
        </div>
      </div>
    </li>
  )
}

// ——————————————————————————————————————————————————————————
// Helpers
// ——————————————————————————————————————————————————————————

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white/40 p-8 text-center">
      <p className="text-sm text-slate-700 font-medium">{title}</p>
      <p className="text-xs text-slate-500 mt-1">{body}</p>
    </div>
  )
}

function formatMoney(cents: number): string {
  const dollars = cents / 100
  const sign = dollars < 0 ? "-" : ""
  const abs = Math.abs(dollars)
  return `${sign}$${abs.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`
}

function formatRoi(roi: number): string {
  // roi is (revenue - cost) / cost. +1.0 == 100% return.
  const pct = Math.round(roi * 100)
  const sign = pct > 0 ? "+" : ""
  return `${sign}${pct}%`
}

function formatDay(day: string): string {
  const [y, m, d] = day.split("-").map((n) => parseInt(n, 10))
  if (!y || !m || !d) return day
  const date = new Date(y, m - 1, d)
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  })
}

function formatDateRange(start: string | null, end: string | null): string {
  if (start && end) return `${formatDay(start)} – ${formatDay(end)}`
  if (start) return `From ${formatDay(start)}`
  if (end) return `Until ${formatDay(end)}`
  return ""
}
