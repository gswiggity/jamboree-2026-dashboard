"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { Trash2Icon, RotateCcwIcon } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { restoreSubmission } from "./actions"

export function TrashedBanner({
  submissionId,
  deletedAt,
}: {
  submissionId: string
  deletedAt: string
}) {
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  function restore() {
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

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm">
      <div className="flex items-center gap-2 text-rose-900">
        <Trash2Icon className="size-4" />
        <span>
          This submission is in the trash — hidden from judging, performers,
          lineup, and production. Trashed{" "}
          {new Date(deletedAt).toLocaleString()}.
        </span>
      </div>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="gap-1.5"
        onClick={restore}
        disabled={pending}
      >
        <RotateCcwIcon className="size-3.5" />
        Restore
      </Button>
    </div>
  )
}
