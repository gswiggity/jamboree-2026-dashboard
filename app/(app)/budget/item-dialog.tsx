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
import type {
  BudgetCategoryRow,
  BudgetItemRow,
  BudgetKind,
} from "./types"

type Mode = "create" | "edit" | "closed"

type ItemInput = {
  category_key: string
  description: string
  planned_cents: number
  actual_cents: number | null
  incurred_at: string | null
  notes: string
}

type SubmitResult = { ok: true; data: unknown } | { ok: false; error: string }

type FormState = {
  category_key: string
  description: string
  planned: string // dollar-string input
  actual: string // dollar-string input; empty = null
  incurred_at: string // YYYY-MM-DD; empty = null
  notes: string
}

const EMPTY: FormState = {
  category_key: "",
  description: "",
  planned: "",
  actual: "",
  incurred_at: "",
  notes: "",
}

function dollarsToCents(input: string): number | null {
  const trimmed = input.trim()
  if (!trimmed) return null
  // Strip $ and commas; accept "1,234.56" or "1234.5" or ".50".
  const cleaned = trimmed.replace(/[$,\s]/g, "")
  const n = Number(cleaned)
  if (!Number.isFinite(n) || n < 0) return null
  return Math.round(n * 100)
}

function centsToDollars(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return ""
  return (cents / 100).toFixed(2)
}

export function ItemDialog({
  mode,
  initial,
  defaultCategoryKey,
  categories,
  kind,
  onClose,
  onSubmit,
  onDelete,
}: {
  mode: Mode
  initial: BudgetItemRow | null
  defaultCategoryKey: string | null
  categories: BudgetCategoryRow[]
  kind: BudgetKind | null
  onClose: () => void
  onSubmit: (input: ItemInput) => Promise<SubmitResult>
  onDelete?: () => Promise<SubmitResult>
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  const [form, setForm] = useState<FormState>(EMPTY)
  const [lastKey, setLastKey] = useState<string>("")

  // "snap state during render" — fingerprints the active dialog target.
  const key =
    mode === "closed"
      ? ""
      : mode === "create"
        ? `create:${kind ?? ""}:${defaultCategoryKey ?? ""}`
        : `edit:${initial?.id ?? ""}`
  if (key && key !== lastKey) {
    setLastKey(key)
    if (mode === "create") {
      setForm({
        ...EMPTY,
        category_key: defaultCategoryKey ?? categories[0]?.key ?? "",
      })
    } else if (mode === "edit" && initial) {
      setForm({
        category_key: initial.category_key,
        description: initial.description,
        planned: centsToDollars(initial.planned_cents),
        actual: centsToDollars(initial.actual_cents),
        incurred_at: initial.incurred_at ?? "",
        notes: initial.notes,
      })
    }
  }

  function patch(part: Partial<FormState>) {
    setForm((f) => ({ ...f, ...part }))
  }

  function handleSubmit() {
    const planned_cents = dollarsToCents(form.planned)
    if (planned_cents === null) {
      toast.error("Planned amount must be a number (0 or more).")
      return
    }
    const actual_cents =
      form.actual.trim() === "" ? null : dollarsToCents(form.actual)
    if (actual_cents === null && form.actual.trim() !== "") {
      toast.error("Actual amount must be a number (0 or more).")
      return
    }

    const payload: ItemInput = {
      category_key: form.category_key,
      description: form.description,
      planned_cents,
      actual_cents,
      incurred_at: form.incurred_at || null,
      notes: form.notes,
    }

    startTransition(async () => {
      const res = await onSubmit(payload)
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success(mode === "create" ? "Line added." : "Line saved.")
      onClose()
      router.refresh()
    })
  }

  function handleDelete() {
    if (!onDelete) return
    if (!confirm("Delete this budget line? This can't be undone.")) return
    startTransition(async () => {
      const res = await onDelete()
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success("Line deleted.")
      onClose()
      router.refresh()
    })
  }

  const kindLabel = kind === "income" ? "income" : kind === "expense" ? "expense" : "budget"

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
            {mode === "create" ? `Add ${kindLabel} line` : `Edit ${kindLabel} line`}
          </DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            handleSubmit()
          }}
          className="space-y-4"
        >
          <Field label="Category" htmlFor="item-category">
            <select
              id="item-category"
              value={form.category_key}
              onChange={(e) => patch({ category_key: e.target.value })}
              disabled={pending || categories.length === 0}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-2 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {categories.length === 0 && (
                <option value="">No categories yet</option>
              )}
              {categories.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Description" htmlFor="item-description">
            <Input
              id="item-description"
              value={form.description}
              onChange={(e) => patch({ description: e.target.value })}
              placeholder={
                kind === "income"
                  ? "e.g. Friday night tickets"
                  : "e.g. Venue deposit"
              }
              disabled={pending}
              autoFocus
            />
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Planned" htmlFor="item-planned">
              <MoneyInput
                id="item-planned"
                value={form.planned}
                onChange={(v) => patch({ planned: v })}
                disabled={pending}
                placeholder="0.00"
              />
            </Field>
            <Field label="Actual" htmlFor="item-actual" optional>
              <MoneyInput
                id="item-actual"
                value={form.actual}
                onChange={(v) => patch({ actual: v })}
                disabled={pending}
                placeholder="0.00"
              />
            </Field>
          </div>

          <Field label="Incurred on" htmlFor="item-date" optional>
            <Input
              id="item-date"
              type="date"
              value={form.incurred_at}
              onChange={(e) => patch({ incurred_at: e.target.value })}
              disabled={pending}
            />
          </Field>

          <Field label="Notes" htmlFor="item-notes" optional>
            <Textarea
              id="item-notes"
              value={form.notes}
              onChange={(e) => patch({ notes: e.target.value })}
              rows={3}
              placeholder="Vendor, invoice number, anything to remember…"
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
                  ? "Add line"
                  : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function MoneyInput({
  id,
  value,
  onChange,
  placeholder,
  disabled,
}: {
  id: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
}) {
  return (
    <div className="relative">
      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-slate-500 pointer-events-none">
        $
      </span>
      <Input
        id={id}
        type="text"
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className="pl-6 tabular-nums"
      />
    </div>
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
