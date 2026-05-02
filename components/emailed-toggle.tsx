"use client"

import { useState, useTransition } from "react"
import { Check, Mail } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { setEmailed } from "@/app/(app)/submissions/[id]/actions"

// Team-wide outreach checkmark. One flag per submission — the first
// teammate to mark it captures the timestamp + their identity. Designed
// to fit anywhere we surface a group: detail page header, lineup list
// rows, board sticky cards.
export function EmailedToggle({
  submissionId,
  initialEmailedAt,
  emailedByName,
  size = "sm",
}: {
  submissionId: string
  initialEmailedAt: string | null
  // Display name (or email) of whoever flipped it; null if unknown.
  emailedByName: string | null
  size?: "sm" | "md"
}) {
  const [emailedAt, setEmailedAt] = useState<string | null>(initialEmailedAt)
  const [savedAt, setSavedAt] = useState<string | null>(initialEmailedAt)
  const [pending, startTransition] = useTransition()

  if (!pending && savedAt !== initialEmailedAt) {
    setSavedAt(initialEmailedAt)
    setEmailedAt(initialEmailedAt)
  }

  function toggle(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    const prev = emailedAt
    const nextOn = !emailedAt
    const optimistic = nextOn ? new Date().toISOString() : null
    setEmailedAt(optimistic)
    startTransition(async () => {
      const res = await setEmailed(submissionId, nextOn)
      if (!res.ok) {
        toast.error(res.error)
        setEmailedAt(prev)
        return
      }
      setSavedAt(optimistic)
    })
  }

  const on = emailedAt !== null
  const when = on
    ? new Date(emailedAt!).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      })
    : null
  const title = on
    ? `Emailed${when ? ` on ${when}` : ""}${emailedByName ? ` by ${emailedByName}` : ""} — click to clear`
    : "Mark this group as emailed"

  const sizeClasses =
    size === "md"
      ? "h-7 px-2.5 text-[11px]"
      : "h-6 px-2 text-[10px]"

  return (
    <button
      type="button"
      disabled={pending}
      onClick={toggle}
      title={title}
      aria-pressed={on}
      onPointerDown={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border font-semibold transition disabled:opacity-50",
        sizeClasses,
        on
          ? "bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700"
          : "bg-white/70 text-slate-600 border-slate-200/80 hover:text-slate-900 hover:bg-slate-50",
      )}
    >
      {on ? (
        <Check className="h-3 w-3" />
      ) : (
        <Mail className="h-3 w-3" />
      )}
      {on ? "Emailed" : "Email?"}
    </button>
  )
}
