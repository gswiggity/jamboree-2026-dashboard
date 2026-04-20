"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  CHANNELS,
  CHANNEL_LABELS,
  type TicketChannel,
  type TicketSaleRow,
  type TicketTypeRow,
} from "./types"

type Mode = "create" | "edit" | "closed"

type SaleInput = {
  type_id: string
  quantity: number
  unit_price_cents: number
  channel: TicketChannel
  sold_at: string
  buyer_name: string
  buyer_email: string
  reference: string
  notes: string
}

type SubmitResult = { ok: true; data: unknown } | { ok: false; error: string }

type FormState = {
  type_id: string
  quantity: string
  unit_price: string
  channel: TicketChannel
  sold_at: string // datetime-local value "YYYY-MM-DDTHH:mm"
  buyer_name: string
  buyer_email: string
  reference: string
  notes: string
}

function dollarsToCents(input: string): number | null {
  const trimmed = input.trim()
  if (!trimmed) return null
  const cleaned = trimmed.replace(/[$,\s]/g, "")
  const n = Number(cleaned)
  if (!Number.isFinite(n) || n < 0) return null
  return Math.round(n * 100)
}

function centsToDollars(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return ""
  return (cents / 100).toFixed(2)
}

/**
 * datetime-local inputs want "YYYY-MM-DDTHH:mm" in LOCAL time.
 * Server returns ISO UTC. Convert both ways without shifting zones.
 */
function isoToLocalInput(iso: string | null): string {
  if (!iso) {
    const now = new Date()
    return toLocalInput(now)
  }
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  return toLocalInput(d)
}

function toLocalInput(d: Date): string {
  const pad = (n: number) => n.toString().padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`
}

function localInputToISO(value: string): string {
  // Treats the input as local time. Browser converts to UTC on toISOString().
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return new Date().toISOString()
  return d.toISOString()
}

const DEFAULT_FORM = (): FormState => ({
  type_id: "",
  quantity: "1",
  unit_price: "",
  channel: "other",
  sold_at: toLocalInput(new Date()),
  buyer_name: "",
  buyer_email: "",
  reference: "",
  notes: "",
})

export function SaleDialog({
  mode,
  initial,
  defaultTypeId,
  types,
  onClose,
  onSubmit,
  onDelete,
}: {
  mode: Mode
  initial: TicketSaleRow | null
  defaultTypeId: string | null
  types: TicketTypeRow[]
  onClose: () => void
  onSubmit: (input: SaleInput) => Promise<SubmitResult>
  onDelete?: () => Promise<SubmitResult>
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  const [form, setForm] = useState<FormState>(DEFAULT_FORM)
  const [lastKey, setLastKey] = useState<string>("")

  // Active types come first for sale creation; archived types should still
  // be visible when editing an existing sale that points at them.
  const activeTypes = types.filter((t) => !t.archived_at)
  const typesForSelect = (() => {
    if (mode === "edit" && initial) {
      const targetType = types.find((t) => t.id === initial.type_id)
      if (targetType && targetType.archived_at) {
        return [...activeTypes, targetType]
      }
    }
    return activeTypes
  })()

  const key =
    mode === "closed"
      ? ""
      : mode === "create"
        ? `create:${defaultTypeId ?? ""}`
        : `edit:${initial?.id ?? ""}`
  if (key && key !== lastKey) {
    setLastKey(key)
    if (mode === "create") {
      const initialType =
        (defaultTypeId && types.find((t) => t.id === defaultTypeId)) ||
        activeTypes[0]
      setForm({
        ...DEFAULT_FORM(),
        type_id: initialType?.id ?? "",
        unit_price: centsToDollars(initialType?.price_cents),
      })
    } else if (mode === "edit" && initial) {
      setForm({
        type_id: initial.type_id,
        quantity: String(initial.quantity),
        unit_price: centsToDollars(initial.unit_price_cents),
        channel: initial.channel,
        sold_at: isoToLocalInput(initial.sold_at),
        buyer_name: initial.buyer_name,
        buyer_email: initial.buyer_email,
        reference: initial.reference,
        notes: initial.notes,
      })
    }
  }

  function patch(part: Partial<FormState>) {
    setForm((f) => ({ ...f, ...part }))
  }

  function pickType(id: string) {
    const t = types.find((x) => x.id === id)
    setForm((f) => ({
      ...f,
      type_id: id,
      // Only overwrite the price if the user hasn't typed a custom one
      // — they may be logging a discount. Leaving blank field falls through.
      unit_price: f.unit_price ? f.unit_price : centsToDollars(t?.price_cents),
    }))
  }

  function handleSubmit() {
    const quantity = parseInt(form.quantity, 10)
    if (!Number.isFinite(quantity) || quantity < 1) {
      toast.error("Quantity must be at least 1.")
      return
    }
    const unit_price_cents = dollarsToCents(form.unit_price)
    if (unit_price_cents === null) {
      toast.error("Unit price must be a number (0 or more).")
      return
    }
    if (!form.type_id) {
      toast.error("Pick a ticket type.")
      return
    }

    const payload: SaleInput = {
      type_id: form.type_id,
      quantity,
      unit_price_cents,
      channel: form.channel,
      sold_at: localInputToISO(form.sold_at),
      buyer_name: form.buyer_name,
      buyer_email: form.buyer_email,
      reference: form.reference,
      notes: form.notes,
    }

    startTransition(async () => {
      const res = await onSubmit(payload)
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success(mode === "create" ? "Sale logged." : "Sale saved.")
      onClose()
      router.refresh()
    })
  }

  function handleDelete() {
    if (!onDelete) return
    if (!confirm("Delete this sale? This can't be undone.")) return
    startTransition(async () => {
      const res = await onDelete()
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success("Sale deleted.")
      onClose()
      router.refresh()
    })
  }

  return (
    <Dialog
      open={mode !== "closed"}
      onOpenChange={(v) => {
        if (!v && !pending) onClose()
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Log ticket sale" : "Edit ticket sale"}
          </DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            handleSubmit()
          }}
          className="space-y-4"
        >
          <Field label="Ticket type" htmlFor="sale-type">
            <select
              id="sale-type"
              value={form.type_id}
              onChange={(e) => pickType(e.target.value)}
              disabled={pending || typesForSelect.length === 0}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-2 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {typesForSelect.length === 0 && (
                <option value="">No ticket types yet</option>
              )}
              {typesForSelect.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                  {t.archived_at ? " (archived)" : ""}
                </option>
              ))}
            </select>
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Quantity" htmlFor="sale-qty">
              <Input
                id="sale-qty"
                type="number"
                min={1}
                step={1}
                value={form.quantity}
                onChange={(e) => patch({ quantity: e.target.value })}
                disabled={pending}
              />
            </Field>
            <Field label="Unit price" htmlFor="sale-price">
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-slate-500 pointer-events-none">
                  $
                </span>
                <Input
                  id="sale-price"
                  type="text"
                  inputMode="decimal"
                  value={form.unit_price}
                  onChange={(e) => patch({ unit_price: e.target.value })}
                  placeholder="0.00"
                  disabled={pending}
                  className="pl-6 tabular-nums"
                />
              </div>
            </Field>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Channel" htmlFor="sale-channel">
              <select
                id="sale-channel"
                value={form.channel}
                onChange={(e) =>
                  patch({ channel: e.target.value as TicketChannel })
                }
                disabled={pending}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-2 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {CHANNELS.map((c) => (
                  <option key={c} value={c}>
                    {CHANNEL_LABELS[c]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Sold at" htmlFor="sale-soldat">
              <Input
                id="sale-soldat"
                type="datetime-local"
                value={form.sold_at}
                onChange={(e) => patch({ sold_at: e.target.value })}
                disabled={pending}
              />
            </Field>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Buyer name" htmlFor="sale-buyer-name" optional>
              <Input
                id="sale-buyer-name"
                value={form.buyer_name}
                onChange={(e) => patch({ buyer_name: e.target.value })}
                placeholder="Anonymous"
                disabled={pending}
              />
            </Field>
            <Field label="Buyer email" htmlFor="sale-buyer-email" optional>
              <Input
                id="sale-buyer-email"
                type="email"
                value={form.buyer_email}
                onChange={(e) => patch({ buyer_email: e.target.value })}
                placeholder="name@example.com"
                disabled={pending}
              />
            </Field>
          </div>

          <Field label="Reference / order #" htmlFor="sale-ref" optional>
            <Input
              id="sale-ref"
              value={form.reference}
              onChange={(e) => patch({ reference: e.target.value })}
              placeholder="Eventbrite order ID, comp code, etc."
              disabled={pending}
            />
          </Field>

          <Field label="Notes" htmlFor="sale-notes" optional>
            <Textarea
              id="sale-notes"
              value={form.notes}
              onChange={(e) => patch({ notes: e.target.value })}
              rows={2}
              placeholder="Anything to remember…"
              disabled={pending}
            />
          </Field>

          <DialogFooter className="gap-2 sm:gap-2">
            {onDelete && mode === "edit" && (
              <Button
                type="button"
                variant="ghost"
                onClick={handleDelete}
                disabled={pending}
                className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 mr-auto"
              >
                <Trash2 className="h-3.5 w-3.5 mr-1" />
                Delete
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending
                ? "Saving…"
                : mode === "create"
                  ? "Log sale"
                  : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function Field({
  label,
  htmlFor,
  className,
  optional,
  children,
}: {
  label: string
  htmlFor: string
  className?: string
  optional?: boolean
  children: React.ReactNode
}) {
  return (
    <div className={`space-y-1 ${className ?? ""}`}>
      <Label
        htmlFor={htmlFor}
        className="text-[10px] uppercase tracking-[0.18em] font-semibold text-slate-500"
      >
        {label}
        {optional && (
          <span className="ml-1.5 normal-case tracking-normal font-normal text-slate-400">
            (optional)
          </span>
        )}
      </Label>
      {children}
    </div>
  )
}
