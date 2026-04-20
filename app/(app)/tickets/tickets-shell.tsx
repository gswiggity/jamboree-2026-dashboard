"use client"

import { useMemo, useState } from "react"
import {
  Archive,
  Calendar,
  Pencil,
  Plus,
  Ticket,
  Users,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  createTicketSale,
  createTicketType,
  deleteTicketSale,
  deleteTicketType,
  setTicketTypeArchived,
  updateTicketSale,
  updateTicketType,
} from "./actions"
import { TypeDialog } from "./type-dialog"
import { SaleDialog } from "./sale-dialog"
import {
  CHANNEL_LABELS,
  type TicketChannel,
  type TicketSaleRow,
  type TicketTypeRow,
} from "./types"

type ShellProps = {
  types: TicketTypeRow[]
  sales: TicketSaleRow[]
}

export function TicketsShell({ types, sales }: ShellProps) {
  const [editingType, setEditingType] = useState<TicketTypeRow | null>(null)
  const [creatingType, setCreatingType] = useState(false)
  const [editingSale, setEditingSale] = useState<TicketSaleRow | null>(null)
  const [creatingSaleTypeId, setCreatingSaleTypeId] = useState<string | null>(
    null,
  )
  const [creatingSaleOpen, setCreatingSaleOpen] = useState(false)

  const typesById = useMemo(() => new Map(types.map((t) => [t.id, t])), [types])

  // type_id → aggregate stats from sales
  const statsByType = useMemo(() => {
    const m = new Map<
      string,
      { sold: number; revenue: number; byChannel: Map<TicketChannel, number> }
    >()
    for (const s of sales) {
      const entry = m.get(s.type_id) ?? {
        sold: 0,
        revenue: 0,
        byChannel: new Map<TicketChannel, number>(),
      }
      entry.sold += s.quantity
      entry.revenue += s.quantity * s.unit_price_cents
      entry.byChannel.set(
        s.channel,
        (entry.byChannel.get(s.channel) ?? 0) + s.quantity,
      )
      m.set(s.type_id, entry)
    }
    return m
  }, [sales])

  // Top-line totals.
  const totals = useMemo(() => {
    let sold = 0
    let revenue = 0
    for (const s of sales) {
      sold += s.quantity
      revenue += s.quantity * s.unit_price_cents
    }
    // Capacity across active (non-archived) types that have a capacity set.
    let capacity = 0
    let soldAgainstCapped = 0
    for (const t of types) {
      if (t.archived_at) continue
      if (t.capacity !== null) {
        capacity += t.capacity
        soldAgainstCapped += statsByType.get(t.id)?.sold ?? 0
      }
    }
    const avg = sold > 0 ? Math.round(revenue / sold) : 0
    return {
      sold,
      revenue,
      capacity,
      soldAgainstCapped,
      avg,
    }
  }, [sales, types, statsByType])

  const activeTypes = useMemo(
    () => types.filter((t) => !t.archived_at),
    [types],
  )
  const archivedTypes = useMemo(
    () => types.filter((t) => t.archived_at),
    [types],
  )

  // Open a sale dialog pre-filled to a type.
  function openCreateSale(typeId: string | null = null) {
    setCreatingSaleTypeId(typeId)
    setCreatingSaleOpen(true)
  }

  return (
    <div className="space-y-5">
      <StatsBar totals={totals} />

      <Tabs defaultValue="types" className="gap-5">
        <TabsList>
          <TabsTrigger value="types">Types</TabsTrigger>
          <TabsTrigger value="sales">Sales log</TabsTrigger>
        </TabsList>

        <TabsContent value="types" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-700">
              Active
              <span className="ml-2 text-slate-400 font-normal tabular-nums">
                {activeTypes.length}
              </span>
            </h2>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => openCreateSale()}
                disabled={activeTypes.length === 0}
                title={
                  activeTypes.length === 0
                    ? "Create a ticket type first."
                    : "Log a sale"
                }
              >
                <Ticket className="h-3.5 w-3.5 mr-1" />
                Log sale
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => setCreatingType(true)}
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                Add type
              </Button>
            </div>
          </div>

          {activeTypes.length === 0 ? (
            <EmptyState
              title="No ticket types yet."
              body="Add your first ticket type — a single-night show, a weekend pass, whatever you're selling."
            />
          ) : (
            <ul className="space-y-2">
              {activeTypes.map((t) => (
                <TypeCard
                  key={t.id}
                  type={t}
                  stats={statsByType.get(t.id)}
                  onEdit={() => setEditingType(t)}
                  onLogSale={() => openCreateSale(t.id)}
                />
              ))}
            </ul>
          )}

          {archivedTypes.length > 0 && (
            <details className="rounded-2xl border border-slate-200/70 bg-white/40">
              <summary className="cursor-pointer select-none px-4 py-2.5 text-sm font-medium text-slate-600 hover:text-slate-900">
                Archived
                <span className="ml-2 text-slate-400 font-normal tabular-nums">
                  {archivedTypes.length}
                </span>
              </summary>
              <ul className="space-y-2 p-2 pt-0">
                {archivedTypes.map((t) => (
                  <TypeCard
                    key={t.id}
                    type={t}
                    stats={statsByType.get(t.id)}
                    onEdit={() => setEditingType(t)}
                    onLogSale={() => openCreateSale(t.id)}
                  />
                ))}
              </ul>
            </details>
          )}
        </TabsContent>

        <TabsContent value="sales" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-700">
              Recent sales
              <span className="ml-2 text-slate-400 font-normal tabular-nums">
                {sales.length}
              </span>
            </h2>
            <Button
              type="button"
              size="sm"
              onClick={() => openCreateSale()}
              disabled={activeTypes.length === 0}
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              Log sale
            </Button>
          </div>

          {sales.length === 0 ? (
            <EmptyState
              title="No sales yet."
              body={
                activeTypes.length === 0
                  ? "Create a ticket type first, then log your first sale."
                  : "Log sales as they happen — door, online, comps, whatever."
              }
            />
          ) : (
            <SalesLog
              sales={sales}
              typesById={typesById}
              onEdit={setEditingSale}
            />
          )}
        </TabsContent>
      </Tabs>

      <TypeDialog
        mode={creatingType ? "create" : editingType ? "edit" : "closed"}
        initial={editingType}
        onClose={() => {
          setCreatingType(false)
          setEditingType(null)
        }}
        onSubmit={async (input) => {
          if (creatingType) return createTicketType(input)
          if (editingType) return updateTicketType(editingType.id, input)
          return { ok: false as const, error: "No type open." }
        }}
        onArchiveToggle={
          editingType
            ? async () =>
                setTicketTypeArchived(
                  editingType.id,
                  editingType.archived_at === null,
                )
            : undefined
        }
        isArchived={editingType?.archived_at !== null && editingType !== null}
        onDelete={
          editingType
            ? async () => deleteTicketType(editingType.id)
            : undefined
        }
      />

      <SaleDialog
        mode={
          editingSale ? "edit" : creatingSaleOpen ? "create" : "closed"
        }
        initial={editingSale}
        defaultTypeId={creatingSaleTypeId}
        types={types}
        onClose={() => {
          setCreatingSaleOpen(false)
          setCreatingSaleTypeId(null)
          setEditingSale(null)
        }}
        onSubmit={async (input) => {
          if (editingSale) return updateTicketSale(editingSale.id, input)
          return createTicketSale(input)
        }}
        onDelete={
          editingSale
            ? async () => deleteTicketSale(editingSale.id)
            : undefined
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
    sold: number
    revenue: number
    capacity: number
    soldAgainstCapped: number
    avg: number
  }
}) {
  const capacityPct =
    totals.capacity === 0 ? 0 : totals.soldAgainstCapped / totals.capacity
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
      <Stat label="Tickets sold" value={totals.sold} />
      <Stat
        label="Revenue"
        value={formatMoney(totals.revenue)}
        tone="good"
      />
      <Stat
        label="Capacity"
        value={
          totals.capacity === 0
            ? "—"
            : `${totals.soldAgainstCapped}/${totals.capacity}`
        }
        sub={
          totals.capacity === 0
            ? "No caps set"
            : `${Math.round(capacityPct * 100)}%`
        }
        tone={
          totals.capacity === 0
            ? "neutral"
            : capacityPct >= 0.9
              ? "alert"
              : capacityPct >= 0.66
                ? "warn"
                : "good"
        }
      />
      <Stat
        label="Avg price"
        value={totals.sold === 0 ? "—" : formatMoney(totals.avg)}
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
// Types tab
// ——————————————————————————————————————————————————————————

function TypeCard({
  type,
  stats,
  onEdit,
  onLogSale,
}: {
  type: TicketTypeRow
  stats?: { sold: number; revenue: number; byChannel: Map<TicketChannel, number> }
  onEdit: () => void
  onLogSale: () => void
}) {
  const sold = stats?.sold ?? 0
  const revenue = stats?.revenue ?? 0
  const hasCapacity = type.capacity !== null
  const pct = hasCapacity && type.capacity! > 0 ? sold / type.capacity! : 0

  const tone = !hasCapacity
    ? "neutral"
    : pct >= 0.9
      ? "alert"
      : pct >= 0.66
        ? "warn"
        : "good"

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
        type.archived_at && "opacity-70",
      )}
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-sm font-semibold text-slate-900">
              {type.name}
            </span>
            <span className="text-xs font-medium text-slate-600 tabular-nums">
              {formatMoney(type.price_cents)}
            </span>
            {type.archived_at && (
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] uppercase tracking-wider text-slate-600">
                <Archive className="h-2.5 w-2.5" />
                Archived
              </span>
            )}
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium tabular-nums",
                toneChip,
              )}
            >
              <Users className="h-3 w-3" />
              {hasCapacity ? `${sold}/${type.capacity}` : `${sold} sold`}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-slate-600">
            {type.on_date && (
              <span className="inline-flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {formatDay(type.on_date)}
                {type.start_time && (
                  <> · {formatTime(type.start_time)}</>
                )}
              </span>
            )}
            <span className="inline-flex items-center gap-1 tabular-nums">
              {formatMoney(revenue)} collected
            </span>
          </div>
          {stats && stats.byChannel.size > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {Array.from(stats.byChannel.entries())
                .sort((a, b) => b[1] - a[1])
                .map(([channel, count]) => (
                  <span
                    key={channel}
                    className="inline-flex items-center gap-1 rounded-full bg-blue-50 border border-blue-100 px-2 py-0.5 text-[11px] font-medium text-blue-900 tabular-nums"
                  >
                    {CHANNEL_LABELS[channel]} · {count}
                  </span>
                ))}
            </div>
          )}
          {type.notes && (
            <p className="text-xs text-slate-500 mt-1.5 whitespace-pre-wrap">
              {type.notes}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1 shrink-0">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={onLogSale}
            disabled={!!type.archived_at}
          >
            <Ticket className="h-3.5 w-3.5 mr-1" />
            Log sale
          </Button>
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
// Sales log
// ——————————————————————————————————————————————————————————

function SalesLog({
  sales,
  typesById,
  onEdit,
}: {
  sales: TicketSaleRow[]
  typesById: Map<string, TicketTypeRow>
  onEdit: (sale: TicketSaleRow) => void
}) {
  return (
    <ul className="divide-y divide-slate-200/60 rounded-2xl border border-slate-200/70 overflow-hidden bg-white/60 text-sm">
      {sales.map((s) => {
        const type = typesById.get(s.type_id)
        const total = s.quantity * s.unit_price_cents
        return (
          <li key={s.id}>
            <button
              type="button"
              onClick={() => onEdit(s)}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-slate-50/80 transition"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="font-medium text-slate-900">
                    {type?.name ?? "(deleted type)"}
                  </span>
                  <span className="text-xs tabular-nums text-slate-600">
                    × {s.quantity} @ {formatMoney(s.unit_price_cents)}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700">
                    {CHANNEL_LABELS[s.channel]}
                  </span>
                </div>
                <div className="text-[11px] text-slate-500 flex flex-wrap gap-x-2 mt-0.5">
                  <span>{formatDateTime(s.sold_at)}</span>
                  {s.buyer_name && <span>· {s.buyer_name}</span>}
                  {s.buyer_email && (
                    <span className="truncate max-w-[32ch]">
                      · {s.buyer_email}
                    </span>
                  )}
                  {s.reference && (
                    <span className="font-mono">· {s.reference}</span>
                  )}
                </div>
              </div>
              <div className="shrink-0 text-right">
                <div className="text-sm font-semibold tabular-nums text-slate-900">
                  {formatMoney(total)}
                </div>
              </div>
            </button>
          </li>
        )
      })}
    </ul>
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

function formatDay(day: string): string {
  const [y, m, d] = day.split("-").map((n) => parseInt(n, 10))
  if (!y || !m || !d) return day
  const date = new Date(y, m - 1, d)
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  })
}

function formatTime(t: string): string {
  const [hStr, mStr] = t.split(":")
  const h = parseInt(hStr, 10)
  const m = parseInt(mStr ?? "0", 10)
  if (!Number.isFinite(h) || !Number.isFinite(m)) return t
  const ampm = h >= 12 ? "PM" : "AM"
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h
  const mm = m.toString().padStart(2, "0")
  return `${h12}:${mm} ${ampm}`
}

function formatDateTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}
