"use client"

import { useState, useTransition } from "react"
import { ChevronDown, Plus, RotateCcw, X } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import {
  ACT_STATUS_DOT,
  ACT_STATUS_LABEL,
  ACT_STATUS_ORDER,
  ACT_STATUS_TONE,
  ACT_STATUS_VERB,
  nextStatuses,
  type ActStatus,
} from "@/lib/act-status"
import {
  clearActStatus,
  setActStatus,
} from "@/app/(app)/submissions/[id]/actions"

// Interactive pipeline control for the ActProfile header. Shows the current
// status as a pill-trigger; opening it offers the legal forward moves, a
// "change to" reset row for corrections (programmed → team_yes etc.), and a
// remove-from-pipeline action. Optimistic with a toast + rollback on error.
export function ActStatusControl({
  submissionId,
  initialStatus,
}: {
  submissionId: string
  initialStatus: ActStatus | null
}) {
  const [status, setStatus] = useState<ActStatus | null>(initialStatus)
  const [saved, setSaved] = useState<ActStatus | null>(initialStatus)
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()

  // Pick up fresher server state when nothing is in flight.
  if (!pending && saved !== initialStatus) {
    setSaved(initialStatus)
    setStatus(initialStatus)
  }

  const forward = nextStatuses(status)
  // Reset targets: any stage other than the current one, for deliberate
  // corrections (uses the DB reset path to bypass the adjacency guard).
  const resetTargets = ACT_STATUS_ORDER.filter((s) => s !== status)

  function apply(
    label: string,
    fn: () => Promise<{ ok: true } | { ok: false; error: string }>,
    optimistic: ActStatus | null,
  ) {
    const prev = status
    setStatus(optimistic)
    setOpen(false)
    startTransition(async () => {
      const res = await fn()
      if (!res.ok) {
        toast.error(res.error)
        setStatus(prev)
        return
      }
      setSaved(optimistic)
      toast.success(label)
    })
  }

  return (
    <div className="relative inline-block text-left">
      <button
        type="button"
        disabled={pending}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border px-3 h-8 text-xs font-semibold transition disabled:opacity-50",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50 focus-visible:ring-offset-2",
          status
            ? ACT_STATUS_TONE[status]
            : "border-dashed border-slate-300 bg-white/70 text-slate-600 hover:text-slate-900 hover:bg-white",
        )}
      >
        {status ? (
          <>
            <span
              className={cn("h-1.5 w-1.5 rounded-full", ACT_STATUS_DOT[status])}
            />
            {ACT_STATUS_LABEL[status]}
          </>
        ) : (
          <>
            <Plus className="h-3.5 w-3.5" />
            Add to pipeline
          </>
        )}
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 transition-transform motion-reduce:transition-none",
            open && "rotate-180",
          )}
          aria-hidden="true"
        />
      </button>

      {open && (
        <>
          {/* Click-away backdrop */}
          <button
            type="button"
            aria-hidden="true"
            tabIndex={-1}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-30 cursor-default"
          />
          <div
            role="menu"
            className="absolute left-0 top-full mt-2 z-40 w-60 rounded-2xl border border-white/70 bg-white/95 backdrop-blur-xl shadow-pop p-2"
          >
            {forward.length > 0 && (
              <div className="px-2 pt-1 pb-1 text-[10px] uppercase tracking-[0.22em] font-semibold text-slate-500">
                Advance
              </div>
            )}
            {forward.map((s) => (
              <button
                key={s}
                type="button"
                role="menuitem"
                onClick={() =>
                  apply(`${ACT_STATUS_LABEL[s]}`, () => setActStatus(submissionId, s), s)
                }
                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm text-slate-800 hover:bg-slate-100/80 focus-visible:outline-none focus-visible:bg-slate-100/80"
              >
                <span className={cn("h-1.5 w-1.5 rounded-full", ACT_STATUS_DOT[s])} />
                {ACT_STATUS_VERB[s]}
              </button>
            ))}

            <div className="px-2 pt-2 pb-1 text-[10px] uppercase tracking-[0.22em] font-semibold text-slate-500">
              Change to
            </div>
            <div className="flex flex-wrap gap-1 px-1 pb-1">
              {resetTargets.map((s) => (
                <button
                  key={s}
                  type="button"
                  role="menuitem"
                  onClick={() =>
                    apply(
                      `Set to ${ACT_STATUS_LABEL[s]}`,
                      () => setActStatus(submissionId, s, true),
                      s,
                    )
                  }
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide transition hover:brightness-95",
                    ACT_STATUS_TONE[s],
                  )}
                >
                  <RotateCcw className="h-2.5 w-2.5" aria-hidden="true" />
                  {ACT_STATUS_LABEL[s]}
                </button>
              ))}
            </div>

            {status && (
              <>
                <div className="my-1 border-t border-slate-200/70" />
                <button
                  type="button"
                  role="menuitem"
                  onClick={() =>
                    apply("Removed from pipeline", () => clearActStatus(submissionId), null)
                  }
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm text-rose-700 hover:bg-rose-50 focus-visible:outline-none focus-visible:bg-rose-50"
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                  Remove from pipeline
                </button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
}
