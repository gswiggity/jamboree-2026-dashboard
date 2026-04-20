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
import type { RoleRow, ShiftRow } from "./types"

type Mode = "create" | "edit" | "closed"

type ShiftInput = {
  role_key: string
  day: string
  start_time: string
  end_time: string
  required_count: number
  location: string
  notes: string
}

type SubmitResult = { ok: true; data: unknown } | { ok: false; error: string }

const EMPTY: ShiftInput = {
  role_key: "",
  day: "",
  start_time: "18:00",
  end_time: "22:00",
  required_count: 1,
  location: "",
  notes: "",
}

export function ShiftDialog({
  mode,
  initial,
  roles,
  onClose,
  onSubmit,
  onDelete,
}: {
  mode: Mode
  initial: ShiftRow | null
  roles: RoleRow[]
  onClose: () => void
  onSubmit: (input: ShiftInput) => Promise<SubmitResult>
  onDelete?: () => Promise<SubmitResult>
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  const [form, setForm] = useState<ShiftInput>(EMPTY)
  const [lastKey, setLastKey] = useState<string>("") // "mode:id" fingerprint

  // Snap the form to the active shift without useEffect (project forbids
  // set-state-in-effect). Runs during render on identity change.
  const key =
    mode === "closed"
      ? ""
      : mode === "create"
        ? "create"
        : `edit:${initial?.id ?? ""}`
  if (key && key !== lastKey) {
    setLastKey(key)
    if (mode === "create") {
      setForm({
        ...EMPTY,
        role_key: roles[0]?.key ?? "",
      })
    } else if (mode === "edit" && initial) {
      setForm({
        role_key: initial.role_key,
        day: initial.day,
        // Postgres returns "HH:mm:ss"; the HTML input expects "HH:mm".
        start_time: initial.start_time.slice(0, 5),
        end_time: initial.end_time.slice(0, 5),
        required_count: initial.required_count,
        location: initial.location,
        notes: initial.notes,
      })
    }
  }

  function patch(part: Partial<ShiftInput>) {
    setForm((f) => ({ ...f, ...part }))
  }

  function handleSubmit() {
    startTransition(async () => {
      const res = await onSubmit(form)
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success(mode === "create" ? "Shift added." : "Shift saved.")
      onClose()
      router.refresh()
    })
  }

  function handleDelete() {
    if (!onDelete) return
    if (
      !confirm(
        "Delete this shift? Any assignments on it will be removed too.",
      )
    )
      return
    startTransition(async () => {
      const res = await onDelete()
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success("Shift deleted.")
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
            {mode === "create" ? "Add shift" : "Edit shift"}
          </DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            handleSubmit()
          }}
          className="space-y-4"
        >
          <Field label="Role" htmlFor="shift-role">
            <select
              id="shift-role"
              value={form.role_key}
              onChange={(e) => patch({ role_key: e.target.value })}
              disabled={pending || roles.length === 0}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-2 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {roles.length === 0 && <option value="">No roles yet</option>}
              {roles.map((r) => (
                <option key={r.key} value={r.key}>
                  {r.label}
                </option>
              ))}
            </select>
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Field label="Day" htmlFor="shift-day" className="sm:col-span-1">
              <Input
                id="shift-day"
                type="date"
                value={form.day}
                onChange={(e) => patch({ day: e.target.value })}
                disabled={pending}
              />
            </Field>
            <Field label="Start" htmlFor="shift-start">
              <Input
                id="shift-start"
                type="time"
                value={form.start_time}
                onChange={(e) => patch({ start_time: e.target.value })}
                disabled={pending}
              />
            </Field>
            <Field label="End" htmlFor="shift-end">
              <Input
                id="shift-end"
                type="time"
                value={form.end_time}
                onChange={(e) => patch({ end_time: e.target.value })}
                disabled={pending}
              />
            </Field>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Field label="Volunteers needed" htmlFor="shift-count">
              <Input
                id="shift-count"
                type="number"
                min={1}
                value={form.required_count}
                onChange={(e) =>
                  patch({
                    required_count: Math.max(
                      1,
                      parseInt(e.target.value, 10) || 1,
                    ),
                  })
                }
                disabled={pending}
              />
            </Field>
            <Field
              label="Location"
              htmlFor="shift-location"
              className="sm:col-span-2"
              optional
            >
              <Input
                id="shift-location"
                value={form.location}
                onChange={(e) => patch({ location: e.target.value })}
                placeholder="e.g. Lobby, green room…"
                disabled={pending}
              />
            </Field>
          </div>

          <Field label="Notes" htmlFor="shift-notes" optional>
            <Textarea
              id="shift-notes"
              value={form.notes}
              onChange={(e) => patch({ notes: e.target.value })}
              rows={3}
              placeholder="Any context for whoever picks this up…"
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
                  ? "Add shift"
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
