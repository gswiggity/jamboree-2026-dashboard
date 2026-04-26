"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { RotateCcwIcon, TrashIcon } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import {
  restoreSubmission,
  softDeleteSubmission,
} from "./[id]/actions"

type Props = {
  submissionId: string
  mode: "active" | "trash"
}

export function RowTrashButton({ submissionId, mode }: Props) {
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  function onClick(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (mode === "active") {
      if (
        !confirm(
          "Move this submission to trash? It'll be hidden from judging, performers, lineup, and production. You can restore it later.",
        )
      ) {
        return
      }
      startTransition(async () => {
        const r = await softDeleteSubmission(submissionId)
        if (!r.ok) {
          toast.error(r.error)
          return
        }
        toast.success("Moved to trash.")
        router.refresh()
      })
    } else {
      startTransition(async () => {
        const r = await restoreSubmission(submissionId)
        if (!r.ok) {
          toast.error(r.error)
          return
        }
        toast.success("Restored.")
        router.refresh()
      })
    }
  }

  const isTrash = mode === "trash"
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      title={isTrash ? "Restore from trash" : "Move to trash"}
      aria-label={isTrash ? "Restore from trash" : "Move to trash"}
      className={cn(
        "size-8 rounded-full inline-flex items-center justify-center transition shrink-0 disabled:opacity-50",
        isTrash
          ? "border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
          : "text-slate-400 hover:text-rose-700 hover:bg-rose-50",
      )}
    >
      {isTrash ? (
        <RotateCcwIcon className="size-4" />
      ) : (
        <TrashIcon className="size-4" />
      )}
    </button>
  )
}
