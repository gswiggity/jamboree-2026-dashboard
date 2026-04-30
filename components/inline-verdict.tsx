"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { setVerdict } from "@/app/(app)/submissions/[id]/actions"

export type Verdict = "yes" | "maybe" | "no"

const PILLS: {
  key: Verdict
  label: string
  active: string
  inactive: string
  hover: string
  title: string
}[] = [
  {
    key: "yes",
    label: "Y",
    active: "bg-emerald-600 text-white border-emerald-600",
    inactive:
      "bg-white/70 text-emerald-800 border-emerald-200/80",
    hover: "hover:bg-emerald-50",
    title: "Yes",
  },
  {
    key: "maybe",
    label: "M",
    active: "bg-amber-500 text-white border-amber-500",
    inactive: "bg-white/70 text-amber-800 border-amber-200/80",
    hover: "hover:bg-amber-50",
    title: "Could be convinced",
  },
  {
    key: "no",
    label: "N",
    active: "bg-rose-600 text-white border-rose-600",
    inactive: "bg-white/70 text-rose-800 border-rose-200/80",
    hover: "hover:bg-rose-50",
    title: "No",
  },
]

// Tiny Y / M / N pill cluster. Click an inactive pill to set your verdict;
// click your active pill to clear it. Optimistic state with toast on error.
// `size="sm"` is the compact variant used in dense list rows; "md" is for
// places with a bit more room (lineup board cards).
export function InlineVerdict({
  submissionId,
  initialVerdict,
  size = "sm",
  onChange,
}: {
  submissionId: string
  initialVerdict: Verdict | null
  size?: "sm" | "md"
  onChange?: (v: Verdict | null) => void
}) {
  const [verdict, setVerdictState] = useState<Verdict | null>(initialVerdict)
  const [savedVerdict, setSavedVerdict] = useState<Verdict | null>(initialVerdict)
  const [pending, startTransition] = useTransition()

  // If the parent re-renders us with a fresher initialVerdict (e.g. after
  // server revalidation), pick that up — but only when nothing's in flight.
  if (!pending && savedVerdict !== initialVerdict) {
    setSavedVerdict(initialVerdict)
    setVerdictState(initialVerdict)
  }

  function pick(next: Verdict, e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    const chosen: Verdict | null = next === verdict ? null : next
    const prev = verdict
    setVerdictState(chosen)
    onChange?.(chosen)
    startTransition(async () => {
      const res = await setVerdict(submissionId, chosen)
      if (!res.ok) {
        toast.error(res.error)
        setVerdictState(prev)
        onChange?.(prev)
        return
      }
      setSavedVerdict(chosen)
    })
  }

  const sizeClasses =
    size === "md"
      ? "h-7 w-7 text-xs"
      : "h-6 w-6 text-[11px]"

  return (
    <div
      className="inline-flex items-center gap-1"
      // Sticky-card drag handlers shouldn't fire when the user is poking a pill.
      onPointerDown={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {PILLS.map((p) => {
        const active = verdict === p.key
        return (
          <button
            key={p.key}
            type="button"
            disabled={pending}
            onClick={(e) => pick(p.key, e)}
            title={`${p.title}${active ? " (click to clear)" : ""}`}
            aria-pressed={active}
            className={cn(
              "inline-flex items-center justify-center rounded-full border font-bold transition disabled:opacity-50",
              sizeClasses,
              active ? p.active : cn(p.inactive, p.hover),
            )}
          >
            {p.label}
          </button>
        )
      })}
    </div>
  )
}
