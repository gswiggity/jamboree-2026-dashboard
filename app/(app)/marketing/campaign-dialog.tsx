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
import {
  CAMPAIGN_KINDS,
  CAMPAIGN_KIND_HELP,
  CAMPAIGN_KIND_LABELS,
  type CampaignKind,
  type MarketingCampaignRow,
} from "./types"

type Mode = "create" | "edit" | "closed"

type CampaignInput = {
  name: string
  kind: CampaignKind
  cost_cents: number
  started_on: string | null
  ended_on: string | null
  notes: string
}

type SubmitResult = { ok: true; data: unknown } | { ok: false; error: string }

type FormState = {
  name: string
  kind: CampaignKind
  cost: string // dollar-string
  started_on: string // YYYY-MM-DD or ""
  ended_on: string // YYYY-MM-DD or ""
  notes: string
}

const EMPTY: FormState = {
  name: "",
  kind: "social",
  cost: "",
  started_on: "",
  ended_on: "",
  notes: "",
}

function dollarsToCents(input: string): number | null {
  const trimmed = input.trim()
  if (!trimmed) return 0
  const cleaned = trimmed.replace(/[$,\s]/g, "")
  const n = Number(cleaned)
  if (!Number.isFinite(n) || n < 0) return null
  return Math.round(n * 100)
}

function centsToDollars(cents: number | null | undefined): string {
  if (cents === null || cents === undefined || cents === 0) return ""
  return (cents / 100).toFixed(2)
}

export function CampaignDialog({
  mode,
  initial,
  isArchived,
  onClose,
  onSubmit,
  onArchiveToggle,
  onDelete,
}: {
  mode: Mode
  initial: MarketingCampaignRow | null
  isArchived: boolean
  onClose: () => void
  onSubmit: (input: CampaignInput) => Promise<SubmitResult>
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
        kind: initial.kind,
        cost: centsToDollars(initial.cost_cents),
        started_on: initial.started_on ?? "",
        ended_on: initial.ended_on ?? "",
        notes: initial.notes,
      })
    }
  }

  function patch(part: Partial<FormState>) {
    setForm((f) => ({ ...f, ...part }))
  }

  function handleSubmit() {
    if (!form.name.trim()) {
      toast.error("Name can't be empty.")
      return
    }
    const cost_cents = dollarsToCents(form.cost)
    if (cost_cents === null) {
      toast.error("Cost must be a number (0 or more).")
      return
    }
    if (
      form.started_on &&
      form.ended_on &&
      form.ended_on < form.started_on
    ) {
      toast.error("End date can't come before the start date.")
      return
    }

    const payload: CampaignInput = {
      name: form.name,
      kind: form.kind,
      cost_cents,
      started_on: form.started_on || null,
      ended_on: form.ended_on || null,
      notes: form.notes,
    }

    startTransition(async () => {
      const res = await onSubmit(payload)
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success(mode === "create" ? "Campaign added." : "Campaign saved.")
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
      toast.success(isArchived ? "Campaign restored." : "Campaign archived.")
      onClose()
      router.refresh()
    })
  }

  function handleDelete() {
    if (!onDelete) return
    if (
      !confirm(
        "Delete this campaign? This is a hard delete and only works if no sales are attributed yet.",
      )
    )
      return
    startTransition(async () => {
      const res = await onDelete()
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success("Campaign deleted.")
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
            {mode === "create" ? "Add campaign" : "Edit campaign"}
          </DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            handleSubmit()
          }}
          className="space-y-4"
        >
          <Field label="Name" htmlFor="campaign-name">
            <Input
              id="campaign-name"
              value={form.name}
              onChange={(e) => patch({ name: e.target.value })}
              placeholder="e.g. Instagram pre-sale push, Podcast takeover"
              disabled={pending}
              autoFocus
            />
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Kind" htmlFor="campaign-kind">
              <select
                id="campaign-kind"
                value={form.kind}
                onChange={(e) =>
                  patch({ kind: e.target.value as CampaignKind })
                }
                disabled={pending}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-2 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {CAMPAIGN_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {CAMPAIGN_KIND_LABELS[k]}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-slate-500 pt-0.5">
                {CAMPAIGN_KIND_HELP[form.kind]}
              </p>
            </Field>
            <Field label="Cost" htmlFor="campaign-cost" optional>
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-slate-500 pointer-events-none">
                  $
                </span>
                <Input
                  id="campaign-cost"
                  type="text"
                  inputMode="decimal"
                  value={form.cost}
                  onChange={(e) => patch({ cost: e.target.value })}
                  placeholder="0.00"
                  disabled={pending}
                  className="pl-6 tabular-nums"
                />
              </div>
            </Field>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Started on" htmlFor="campaign-start" optional>
              <Input
                id="campaign-start"
                type="date"
                value={form.started_on}
                onChange={(e) => patch({ started_on: e.target.value })}
                disabled={pending}
              />
            </Field>
            <Field label="Ended on" htmlFor="campaign-end" optional>
              <Input
                id="campaign-end"
                type="date"
                value={form.ended_on}
                onChange={(e) => patch({ ended_on: e.target.value })}
                disabled={pending}
              />
            </Field>
          </div>

          <Field label="Notes" htmlFor="campaign-notes" optional>
            <Textarea
              id="campaign-notes"
              value={form.notes}
              onChange={(e) => patch({ notes: e.target.value })}
              rows={3}
              placeholder="Creative direction, reach, what you sent where…"
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
                  ? "Add campaign"
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
