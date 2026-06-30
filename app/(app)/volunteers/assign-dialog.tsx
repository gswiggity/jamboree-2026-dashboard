"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { AlertTriangle, Check, Search, Star, Users } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { fitForShift } from "@/lib/volunteer-availability"
import type {
  Fit,
  FitStatus,
  VolunteerAvailability,
} from "@/lib/volunteer-availability"
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

// Sort order: best fit first. Assigned-but-conflicting people still surface
// near the top so you can see and resolve them.
const STATUS_RANK: Record<FitStatus, number> = {
  available: 0,
  time: 1,
  unknown: 2,
  day: 3,
}

export function AssignDialog({
  shift,
  rolesByKey,
  volunteers,
  availability,
  currentAssignments,
  onClose,
  onSubmit,
}: {
  shift: ShiftRow | null
  rolesByKey: Map<string, RoleRow>
  volunteers: VolunteerRow[]
  availability: Record<string, VolunteerAvailability>
  currentAssignments: string[]
  onClose: () => void
  onSubmit: (volunteerIds: string[]) => Promise<SubmitResult>
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [query, setQuery] = useState("")
  const [availableOnly, setAvailableOnly] = useState(false)
  const [lastShiftId, setLastShiftId] = useState<string | null>(null)

  // Snap selection to the active shift when it changes. We don't bother
  // re-syncing if the server's currentAssignments change under us — closing
  // + reopening the dialog is the explicit refresh.
  if (shift && shift.id !== lastShiftId) {
    setLastShiftId(shift.id)
    setSelected(new Set(currentAssignments))
    setQuery("")
    setAvailableOnly(false)
  }

  const role = shift ? rolesByKey.get(shift.role_key) : undefined
  const required = shift?.required_count ?? 0
  const overfilled = selected.size > required

  // Pair each volunteer with their fit for this shift, then filter + sort so
  // the best matches lead. Selected people are always kept visible.
  const ranked = useMemo(() => {
    if (!shift) return []
    const q = query.trim().toLowerCase()
    const withFit = volunteers.map((v) => {
      const av = availability[v.id]
      const fit: Fit | null = av ? fitForShift(av, shift) : null
      return { v, fit }
    })
    const matched = withFit.filter(({ v, fit }) => {
      if (q) {
        const hay = `${v.name ?? ""} ${v.email ?? ""}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      if (availableOnly && !selected.has(v.id)) {
        if (!fit || fit.status !== "available") return false
      }
      return true
    })
    return matched.sort((a, b) => {
      const ra = a.fit ? STATUS_RANK[a.fit.status] : STATUS_RANK.unknown
      const rb = b.fit ? STATUS_RANK[b.fit.status] : STATUS_RANK.unknown
      if (ra !== rb) return ra - rb
      // Within a fit tier, role-interested first.
      const ia = a.fit?.roleInterested ? 0 : 1
      const ib = b.fit?.roleInterested ? 0 : 1
      if (ia !== ib) return ia - ib
      return (a.v.name ?? a.v.email ?? "").localeCompare(b.v.name ?? b.v.email ?? "")
    })
  }, [volunteers, availability, shift, query, availableOnly, selected])

  const availableCount = useMemo(
    () =>
      ranked.filter(({ fit }) => fit?.status === "available").length,
    [ranked],
  )

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

            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search volunteers by name or email…"
                  disabled={pending}
                  className="pl-8"
                />
              </div>
              <button
                type="button"
                onClick={() => setAvailableOnly((p) => !p)}
                disabled={pending}
                className={cn(
                  "shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium tabular-nums transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50 focus-visible:ring-offset-2",
                  availableOnly
                    ? "bg-emerald-600 border-emerald-600 text-white"
                    : "bg-white/70 border-slate-200 text-slate-600 hover:bg-white",
                )}
                title="Show only volunteers free at this day & time"
              >
                Available {availableCount}
              </button>
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
            ) : ranked.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 bg-white/40 p-6 text-center">
                <p className="text-sm text-slate-700">
                  {availableOnly
                    ? "No unassigned volunteers are free at this day & time."
                    : (
                      <>
                        No volunteers match{" "}
                        <span className="font-mono">&ldquo;{query}&rdquo;</span>.
                      </>
                    )}
                </p>
              </div>
            ) : (
              <ul className="max-h-72 overflow-auto divide-y divide-slate-200/60 rounded-xl border border-slate-200/70 bg-white/60">
                {ranked.map(({ v, fit }) => {
                  const checked = selected.has(v.id)
                  const name = v.name ?? v.email?.split("@")[0] ?? "Unknown"
                  const note = availability[v.id]?.note
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
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-medium text-slate-900 truncate">
                              {name}
                            </span>
                            {fit?.roleInterested && (
                              <Star
                                className="h-3 w-3 shrink-0 fill-amber-400 text-amber-400"
                                aria-label="Interested in this role"
                              />
                            )}
                          </div>
                          {note ? (
                            <div className="text-[11px] text-slate-500 truncate" title={note}>
                              {note}
                            </div>
                          ) : (
                            v.email && (
                              <div className="text-xs text-slate-500 truncate">
                                {v.email}
                              </div>
                            )
                          )}
                        </div>
                        <FitBadge fit={fit} />
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

// Small badge summarizing how a volunteer's sign-up availability lines up with
// the shift's day and time-of-day.
function FitBadge({ fit }: { fit: Fit | null }) {
  if (!fit || fit.status === "unknown") {
    return (
      <span className="shrink-0 rounded-full bg-slate-100 text-slate-500 px-2 py-0.5 text-[10px] font-medium">
        No info
      </span>
    )
  }
  const meta: Record<
    Exclude<FitStatus, "unknown">,
    { label: string; cls: string; icon?: boolean }
  > = {
    available: {
      label: "Available",
      cls: "bg-emerald-100 text-emerald-800",
    },
    time: {
      label: "Other time",
      cls: "bg-amber-100 text-amber-900",
      icon: true,
    },
    day: {
      label: "Not this day",
      cls: "bg-rose-100 text-rose-800",
      icon: true,
    },
  }
  const m = meta[fit.status]
  return (
    <span
      className={cn(
        "shrink-0 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium",
        m.cls,
      )}
    >
      {m.icon && <AlertTriangle className="h-2.5 w-2.5" />}
      {m.label}
    </span>
  )
}
