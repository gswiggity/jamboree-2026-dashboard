"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Check, Search, Users } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import type { RoleRow, ShiftRow, VolunteerRow } from "./types"

type SubmitResult = { ok: true; data: unknown } | { ok: false; error: string }

export function AssignDialog({
  shift,
  rolesByKey,
  volunteers,
  currentAssignments,
  onClose,
  onSubmit,
}: {
  shift: ShiftRow | null
  rolesByKey: Map<string, RoleRow>
  volunteers: VolunteerRow[]
  currentAssignments: string[]
  onClose: () => void
  onSubmit: (volunteerIds: string[]) => Promise<SubmitResult>
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [query, setQuery] = useState("")
  const [lastShiftId, setLastShiftId] = useState<string | null>(null)

  // Snap selection to the active shift when it changes. We don't bother
  // re-syncing if the server's currentAssignments change under us — closing
  // + reopening the dialog is the explicit refresh.
  if (shift && shift.id !== lastShiftId) {
    setLastShiftId(shift.id)
    setSelected(new Set(currentAssignments))
    setQuery("")
  }

  const role = shift ? rolesByKey.get(shift.role_key) : undefined
  const required = shift?.required_count ?? 0
  const overfilled = selected.size > required

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return volunteers
    return volunteers.filter((v) => {
      const hay = `${v.name ?? ""} ${v.email ?? ""}`.toLowerCase()
      return hay.includes(q)
    })
  }, [volunteers, query])

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function handleSave() {
    startTransition(async () => {
      const res = await onSubmit(Array.from(selected))
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success("Assignments saved.")
      onClose()
      router.refresh()
    })
  }

  return (
    <Dialog
      open={shift !== null}
      onOpenChange={(v) => {
        if (!v && !pending) onClose()
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Assign volunteers</DialogTitle>
        </DialogHeader>
        {shift && (
          <div className="space-y-4">
            <div className="rounded-xl bg-slate-50/80 border border-slate-200/70 px-3 py-2 text-xs text-slate-700">
              <div className="font-medium text-slate-900">
                {role?.label ?? shift.role_key}
              </div>
              <div className="mt-0.5 text-slate-600">
                {shift.day} · {shift.start_time.slice(0, 5)}–
                {shift.end_time.slice(0, 5)}
                {shift.location && <> · {shift.location}</>}
              </div>
            </div>

            <div className="flex items-center justify-between text-xs">
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 font-medium tabular-nums",
                  overfilled
                    ? "bg-amber-100 text-amber-900"
                    : selected.size >= required
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-slate-100 text-slate-700",
                )}
              >
                <Users className="h-3 w-3" />
                {selected.size}/{required} selected
              </span>
              {overfilled && (
                <span className="text-amber-700 font-medium">
                  Over the required count — that&apos;s fine, just a heads up.
                </span>
              )}
            </div>

            <div className="relative">
              <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search volunteers by name or email…"
                disabled={pending}
                className="pl-8"
              />
            </div>

            {volunteers.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 bg-white/40 p-6 text-center">
                <p className="text-sm text-slate-700 font-medium">
                  No volunteers in the pool yet.
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Import a volunteer CSV on the Upload page to get started.
                </p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 bg-white/40 p-6 text-center">
                <p className="text-sm text-slate-700">
                  No volunteers match{" "}
                  <span className="font-mono">&ldquo;{query}&rdquo;</span>.
                </p>
              </div>
            ) : (
              <ul className="max-h-72 overflow-auto divide-y divide-slate-200/60 rounded-xl border border-slate-200/70 bg-white/60">
                {filtered.map((v) => {
                  const checked = selected.has(v.id)
                  const name = v.name ?? v.email?.split("@")[0] ?? "Unknown"
                  return (
                    <li key={v.id}>
                      <button
                        type="button"
                        onClick={() => toggle(v.id)}
                        disabled={pending}
                        className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-slate-50 transition"
                      >
                        <span
                          aria-hidden
                          className={cn(
                            "shrink-0 h-4 w-4 rounded-md border-2 flex items-center justify-center transition",
                            checked
                              ? "bg-blue-950 border-blue-950 text-white"
                              : "border-slate-300 text-transparent",
                          )}
                        >
                          <Check className="h-2.5 w-2.5" strokeWidth={3} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium text-slate-900 truncate">
                            {name}
                          </div>
                          {v.email && (
                            <div className="text-xs text-slate-500 truncate">
                              {v.email}
                            </div>
                          )}
                        </div>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={onClose}
                disabled={pending}
              >
                Cancel
              </Button>
              <Button type="button" onClick={handleSave} disabled={pending}>
                {pending ? "Saving…" : "Save assignments"}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
