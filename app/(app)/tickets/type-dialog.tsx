"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Archive, ArchiveRestore, Trash2 } from "lucide-react"
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
import type { TicketTypeRow } from "./types"

type Mode = "create" | "edit" | "closed"

type TypeInput = {
  name: string
  price_cents: number
  capacity: number | null
  on_date: string | null
  start_time: string | null
  sort_order?: number
  notes: string
}

type SubmitResult = { ok: true; data: unknown } | { ok: false; error: string }

type FormState = {
  name: string
  price: string // dollar-string input
  capacity: string // integer string; empty = null
  on_date: string // YYYY-MM-DD or ""
  start_time: string // HH:mm or ""
  notes: string
}

const EMPTY: FormState = {
  name: "",
  price: "",
  capacity: "",
  on_date: "",
  start_time: "",
  notes: "",
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

export function TypeDialog({
  mode,
  initial,
  isArchived,
  onClose,
  onSubmit,
  onArchiveToggle,
  onDelete,
}: {
  mode: Mode
  initial: TicketTypeRow | null
  isArchived: boolean
  onClose: () => void
  onSubmit: (input: TypeInput) => Promise<SubmitResult>
  onArchiveToggle?: () => Promise<SubmitResult>
  onDelete?: () => Promise<SubmitResult>
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  const [form, setForm] = useState<FormState>(EMPTY)
  const [lastKey, setLastKey] = useState<string>("")

  const key =
    mode === "closed"
      ? ""
      : mode === "create"
        ? "create"
        : `edit:${initial?.id ?? ""}`
  if (key && key !== lastKey) {
    setLastKey(key)
    if (mode === "create") {
      setForm({ ...EMPTY })
    } else if (mode === "edit" && initial) {
      setForm({
        name: initial.name,
        price: centsToDollars(initial.price_cents),
        capacity: initial.capacity === null ? "" : String(initial.capacity),
        on_date: initial.on_date ?? "",
        start_time: initial.start_time ? initial.start_time.slice(0, 5) : "",
        notes: initial.notes,
      })
    }
  }

  function patch(part: Partial<FormState>) {
    setForm((f) => ({ ...f, ...part }))
  }

  function handleSubmit() {
    const price_cents = dollarsToCents(form.price)
    if (price_cents === null) {
      toast.error("Price must be a number (0 or more).")
      return
    }
    let capacity: number | null = null
    if (form.capacity.trim() !== "") {
      const n = parseInt(form.capacity, 10)
      if (!Number.isFinite(n) || n < 1) {
        toast.error("Capacity must be a whole number 1 or greater.")
        return
      }
      capacity = n
    }

    const payload: TypeInput = {
      name: form.name,
      price_cents,
      capacity,
      on_date: form.on_date || null,
      start_time: form.start_time || null,
      notes: form.notes,
    }

    startTransition(async () => {
      const res = await onSubmit(payload)
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success(mode === "create" ? "Type added." : "Type saved.")
      onClose()
      router.refresh()
    })
  }

  function handleArchiveToggle() {
    if (!onArchiveToggle) return
    startTransition(async () => {
      const res = await onArchiveToggle()
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success(isArchived ? "Type restored." : "Type archived.")
      onClose()
      router.refresh()
    })
  }

  function handleDelete() {
    if (!onDelete) return
    if (
      !confirm(
        "Delete this ticket type? This is a hard delete and only works if no sales exist yet.",
      )
    )
      return
    startTransition(async () => {
      const res = await onDelete()
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success("Type deleted.")
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
            {mode === "create" ? "Add ticket type" : "Edit ticket type"}
          </DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            handleSubmit()
          }}
          className="space-y-4"
        >
          <Field label="Name" htmlFor="type-name">
            <Input
              id="type-name"
              value={form.name}
              onChange={(e) => patch({ name: e.target.value })}
              placeholder="e.g. Friday Night GA, Weekend Pass, VIP"
              disabled={pending}
              autoFocus
            />
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Price" htmlFor="type-price">
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-slate-500 pointer-events-none">
                  $
                </span>
                <Input
                  id="type-price"
                  type="text"
                  inputMode="decimal"
                  value={form.price}
                  onChange={(e) => patch({ price: e.target.value })}
                  placeholder="0.00"
                  disabled={pending}
                  className="pl-6 tabular-nums"
                />
              </div>
            </Field>
            <Field label="Capacity" htmlFor="type-capacity" optional>
              <Input
                id="type-capacity"
                type="number"
                min={1}
                step={1}
                value={form.capacity}
                onChange={(e) => patch({ capacity: e.target.value })}
                placeholder="Unlimited"
                disabled={pending}
              />
            </Field>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Show date" htmlFor="type-date" optional>
              <Input
                id="type-date"
                type="date"
                value={form.on_date}
                onChange={(e) => patch({ on_date: e.target.value })}
                disabled={pending}
              />
            </Field>
            <Field label="Door time" htmlFor="type-start" optional>
              <Input
                id="type-start"
                type="time"
                value={form.start_time}
                onChange={(e) => patch({ start_time: e.target.value })}
                disabled={pending}
              />
            </Field>
          </div>

          <Field label="Notes" htmlFor="type-notes" optional>
            <Textarea
              id="type-notes"
              value={form.notes}
              onChange={(e) => patch({ notes: e.target.value })}
              rows={3}
              placeholder="Anything to remember — tier perks, age restrictions, etc."
              disabled={pending}
            />
          </Field>

          <DialogFooter className="gap-2 sm:gap-2">
            {mode === "edit" && (
              <div className="mr-auto flex gap-1">
                {onArchiveToggle && (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={handleArchiveToggle}
                    disabled={pending}
                    className="text-slate-600"
                  >
                    {isArchived ? (
                      <>
                        <ArchiveRestore className="h-3.5 w-3.5 mr-1" />
                        Restore
                      </>
                    ) : (
                      <>
                        <Archive className="h-3.5 w-3.5 mr-1" />
                        Archive
                      </>
                    )}
                  </Button>
                )}
                {onDelete && (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={handleDelete}
                    disabled={pending}
                    className="text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-1" />
                    Delete
                  </Button>
                )}
              </div>
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
                  ? "Add type"
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
