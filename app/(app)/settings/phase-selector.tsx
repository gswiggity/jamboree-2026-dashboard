"use client"

import { useRouter } from "next/navigation"
import { useTransition } from "react"
import { Check } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import type { Phase } from "@/lib/phases"
import { updateFestivalPhase } from "./phase-actions"

export function PhaseSelector({
  current,
  phases,
}: {
  current: string
  phases: Phase[]
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  function setPhase(next: Phase) {
    if (next.key === current || pending) return
    startTransition(async () => {
      const result = await updateFestivalPhase(next.key)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success(`Phase set to ${next.label}.`)
      router.refresh()
    })
  }

  const sorted = [...phases].sort((a, b) => a.sort_order - b.sort_order)
  const currentIdx = sorted.findIndex((p) => p.key === current)

  if (sorted.length === 0) {
    return (
      <p className="text-sm text-slate-500 italic">
        No phases defined yet. Add one below to get started.
      </p>
    )
  }

  // Grid auto-fits 1–6 columns depending on how many phases exist.
  const cols = Math.min(sorted.length, 5)
  const gridCols =
    cols === 1
      ? "md:grid-cols-1"
      : cols === 2
      ? "md:grid-cols-2"
      : cols === 3
      ? "md:grid-cols-3"
      : cols === 4
      ? "md:grid-cols-4"
      : "md:grid-cols-5"

  return (
    <div className="space-y-3">
      <ol
        className={cn(
          "grid grid-cols-1 gap-2 text-sm",
          gridCols,
          pending && "opacity-70",
        )}
      >
        {sorted.map((meta, i) => {
          const isCurrent = meta.key === current
          const isPast = i < currentIdx
          return (
            <li key={meta.key}>
              <button
                type="button"
                onClick={() => setPhase(meta)}
                disabled={pending || isCurrent}
                aria-current={isCurrent ? "step" : undefined}
                className={cn(
                  "group relative w-full text-left rounded-xl border p-3 transition",
                  "focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2340d9]/40",
                  isCurrent
                    ? "border-blue-950 bg-blue-950 text-white shadow-[0_10px_28px_-16px_rgba(30,58,138,0.5)]"
                    : isPast
                    ? "border-slate-200 bg-white/70 text-slate-700 hover:border-blue-300 hover:bg-white"
                    : "border-dashed border-slate-200 bg-white/40 text-slate-600 hover:border-blue-300 hover:bg-white/80",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={cn(
                      "text-[10px] uppercase tracking-[0.22em] font-semibold",
                      isCurrent ? "text-white/70" : "text-slate-500",
                    )}
                  >
                    Phase {i + 1}
                  </span>
                  {isCurrent && <Check className="h-3.5 w-3.5" />}
                </div>
                <div
                  className={cn(
                    "mt-1.5 font-semibold",
                    isCurrent ? "text-white" : "text-slate-900",
                  )}
                >
                  {meta.short}
                </div>
                <div
                  className={cn(
                    "text-xs mt-1 leading-snug",
                    isCurrent ? "text-blue-100" : "text-slate-500",
                  )}
                >
                  {meta.blurb}
                </div>
              </button>
            </li>
          )
        })}
      </ol>
      <p className="text-xs text-slate-500">
        Click any phase to switch. The dashboard and anywhere else that surfaces
        phase state will update for the whole team.
      </p>
    </div>
  )
}
