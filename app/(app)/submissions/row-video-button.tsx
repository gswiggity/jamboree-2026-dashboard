"use client"

import { useEffect, useRef, useState } from "react"
import { VideoIcon, VideoOffIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { VideoLinkEditor } from "@/components/video-link-editor"

type Props = {
  submissionId: string
  supplementalUrl: string | null
  hasAutoDetectedVideo: boolean
}

export function RowVideoButton({
  submissionId,
  supplementalUrl,
  hasAutoDetectedVideo,
}: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const hasAnyVideo = !!supplementalUrl || hasAutoDetectedVideo
  const status = supplementalUrl
    ? { label: "Performance video added", tone: "added" as const }
    : hasAutoDetectedVideo
      ? { label: "Auto-detected video on file", tone: "detected" as const }
      : { label: "No performance video — click to add", tone: "missing" as const }

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false)
    }
    window.addEventListener("mousedown", onDown)
    window.addEventListener("keydown", onKey)
    return () => {
      window.removeEventListener("mousedown", onDown)
      window.removeEventListener("keydown", onKey)
    }
  }, [open])

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title={status.label}
        aria-label={status.label}
        className={cn(
          "size-8 rounded-full border inline-flex items-center justify-center transition shrink-0",
          status.tone === "added" && "border-blue-300 bg-blue-50 text-blue-700",
          status.tone === "detected" &&
            "border-emerald-200 bg-emerald-50 text-emerald-700",
          status.tone === "missing" &&
            "border-dashed border-slate-300 text-slate-400 hover:text-slate-700 hover:border-slate-400",
        )}
      >
        {hasAnyVideo ? (
          <VideoIcon className="size-4" />
        ) : (
          <VideoOffIcon className="size-4" />
        )}
      </button>
      {open && (
        <div className="absolute z-40 left-0 top-full mt-1 w-80 rounded-lg bg-popover text-popover-foreground shadow-lg ring-1 ring-foreground/10 p-3 space-y-2">
          <div className="text-[11px] font-medium text-muted-foreground">
            {status.label}
          </div>
          <VideoLinkEditor
            submissionId={submissionId}
            supplementalUrl={supplementalUrl}
            hasAutoDetectedVideo={hasAutoDetectedVideo}
          />
        </div>
      )}
    </div>
  )
}
