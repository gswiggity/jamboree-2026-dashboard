"use client"

import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { Pencil, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { slugifyPhaseKey, type Phase } from "@/lib/phases"
import { createPhase, deletePhase, updatePhase } from "./phase-actions"

type PhaseForm = {
  key: string
  label: string
  short: string
  blurb: string
  sort_order: number
}

function toForm(p: Phase): PhaseForm {
  return {
    key: p.key,
    label: p.label,
    short: p.short,
    blurb: p.blurb,
    sort_order: p.sort_order,
  }
}

export function PhaseManager({
  phases,
  currentKey,
}: {
  phases: Phase[]
  currentKey: string
}) {
  const router = useRouter()
  const sorted = [...phases].sort((a, b) => a.sort_order - b.sort_order)
  const nextOrder =
    sorted.length === 0 ? 1 : (sorted[sorted.length - 1]?.sort_order ?? 0) + 1

  const [editing, setEditing] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [pending, startTransition] = useTransition()

  function handleSave(originalKey: string, form: PhaseForm) {
    startTransition(async () => {
      const res = await updatePhase(originalKey, form)
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success(`Phase “${form.label}” saved.`)
      setEditing(null)
      router.refresh()
    })
  }

  function handleCreate(form: PhaseForm) {
    startTransition(async () => {
      const res = await createPhase(form)
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success(`Phase “${form.label}” added.`)
      setAdding(false)
      router.refresh()
    })
  }

  function handleDelete(key: string, label: string) {
    if (
      !confirm(
        `Delete phase “${label}”? This can't be undone. (If the festival is currently on this phase, switch phases first.)`,
      )
    )
      return
    startTransition(async () => {
      const res = await deletePhase(key)
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success(`Phase “${label}” deleted.`)
      router.refresh()
    })
  }

  return (
    <div className="space-y-3">
      {sorted.length === 0 ? (
        <p className="text-sm text-slate-500 italic">
          No phases defined yet. Add one below to get the festival rolling.
        </p>
      ) : (
        <ul className="divide-y divide-slate-200/60 rounded-lg border border-slate-200/70 overflow-hidden bg-white/40">
          {sorted.map((p) => {
            const isCurrent = p.key === currentKey
            const isEditing = editing === p.key
            return (
              <li key={p.key} className="p-3">
                {isEditing ? (
                  <PhaseEditor
                    initial={toForm(p)}
                    submitLabel="Save changes"
                    pending={pending}
                    onCancel={() => setEditing(null)}
                    onSubmit={(form) => handleSave(p.key, form)}
                  />
                ) : (
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] uppercase tracking-[0.22em] font-semibold text-slate-500 tabular-nums">
                          Phase {p.sort_order}
                        </span>
                        <span className="font-medium text-slate-900 truncate">
                          {p.label}
                        </span>
                        {isCurrent && (
                          <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.18em] font-semibold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                            Active
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-600 mt-1">
                        <span className="font-mono text-slate-500">{p.key}</span>
                        {" · "}
                        short: <span className="font-medium text-slate-700">{p.short}</span>
                      </div>
                      {p.blurb && (
                        <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                          {p.blurb}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditing(p.key)}
                        disabled={pending}
                        className="h-8"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        <span className="sr-only md:not-sr-only md:ml-1">Edit</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(p.key, p.label)}
                        disabled={pending || isCurrent}
                        title={
                          isCurrent
                            ? "Switch to a different phase before deleting this one."
                            : undefined
                        }
                        className={cn(
                          "h-8",
                          !isCurrent && "text-rose-600 hover:text-rose-700 hover:bg-rose-50",
                        )}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span className="sr-only">Delete</span>
                      </Button>
                    </div>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {adding ? (
        <div className="rounded-lg border border-dashed border-slate-300 p-3 bg-white/40">
          <p className="text-[10px] uppercase tracking-[0.22em] font-semibold text-slate-500 mb-3">
            New phase
          </p>
          <PhaseEditor
            initial={{
              key: "",
              label: "",
              short: "",
              blurb: "",
              sort_order: nextOrder,
            }}
            submitLabel="Add phase"
            pending={pending}
            onCancel={() => setAdding(false)}
            onSubmit={handleCreate}
          />
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setAdding(true)}
        >
          <Plus className="h-3.5 w-3.5 mr-1" />
          Add phase
        </Button>
      )}
    </div>
  )
}

function PhaseEditor({
  initial,
  submitLabel,
  pending,
  onCancel,
  onSubmit,
}: {
  initial: PhaseForm
  submitLabel: string
  pending: boolean
  onCancel: () => void
  onSubmit: (form: PhaseForm) => void
}) {
  const [form, setForm] = useState<PhaseForm>(initial)
  const [keyManuallyEdited, setKeyManuallyEdited] = useState(initial.key.length > 0)

  function update<K extends keyof PhaseForm>(field: K, value: PhaseForm[K]) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  // If user is creating fresh and hasn't touched key, auto-slug it from the label.
  function handleLabelChange(value: string) {
    setForm((prev) => {
      const next = { ...prev, label: value }
      if (!keyManuallyEdited) {
        next.key = slugifyPhaseKey(value)
      }
      return next
    })
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit(form)
      }}
      className="space-y-3"
    >
      <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_80px] gap-3">
        <div className="space-y-1">
          <Label htmlFor="phase-label" className="text-xs text-slate-600">
            Label
          </Label>
          <Input
            id="phase-label"
            value={form.label}
            onChange={(e) => handleLabelChange(e.target.value)}
            placeholder="Submissions open"
            required
            disabled={pending}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="phase-short" className="text-xs text-slate-600">
            Short name
          </Label>
          <Input
            id="phase-short"
            value={form.short}
            onChange={(e) => update("short", e.target.value)}
            placeholder="Submissions"
            required
            disabled={pending}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="phase-order" className="text-xs text-slate-600">
            Order
          </Label>
          <Input
            id="phase-order"
            type="number"
            min={1}
            value={form.sort_order}
            onChange={(e) =>
              update("sort_order", Number.parseInt(e.target.value, 10) || 0)
            }
            className="tabular-nums"
            disabled={pending}
          />
        </div>
      </div>

      <div className="space-y-1">
        <Label htmlFor="phase-blurb" className="text-xs text-slate-600">
          Blurb
        </Label>
        <Textarea
          id="phase-blurb"
          value={form.blurb}
          onChange={(e) => update("blurb", e.target.value)}
          placeholder="One sentence describing what's happening in this phase."
          rows={2}
          disabled={pending}
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor="phase-key" className="text-xs text-slate-600">
          Key
          <span className="text-slate-400 font-normal ml-1.5">
            (slug used internally — lowercase, no spaces)
          </span>
        </Label>
        <Input
          id="phase-key"
          value={form.key}
          onChange={(e) => {
            setKeyManuallyEdited(true)
            update("key", slugifyPhaseKey(e.target.value))
          }}
          placeholder="submissions"
          required
          disabled={pending}
          className="font-mono text-sm"
        />
      </div>

      <div className="flex items-center gap-2">
        <Button type="submit" size="sm" disabled={pending}>
          {submitLabel}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onCancel}
          disabled={pending}
        >
          Cancel
        </Button>
      </div>
    </form>
  )
}
