import { cn } from "@/lib/utils"
import {
  ACT_STATUS_DOT,
  ACT_STATUS_LABEL,
  ACT_STATUS_TONE,
  type ActStatus,
} from "@/lib/act-status"

// Read-only pipeline-status pill. Rendered on submissions list rows, lineup
// board cards, and inside the ActProfile header control. Returns null when the
// act isn't in the pipeline so callers can fall back to a consensus-tier badge.
export function ActStatusPill({
  status,
  size = "sm",
  className,
}: {
  status: ActStatus | null
  size?: "sm" | "md"
  className?: string
}) {
  if (!status) return null

  const sizeClasses =
    size === "md"
      ? "px-2.5 py-0.5 text-[11px]"
      : "px-2 py-0.5 text-[10px]"

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border font-semibold uppercase tracking-wide",
        sizeClasses,
        ACT_STATUS_TONE[status],
        className,
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", ACT_STATUS_DOT[status])} />
      {ACT_STATUS_LABEL[status]}
    </span>
  )
}
