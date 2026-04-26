"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { LinkIcon, PencilIcon, VideoIcon, XIcon } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { setSupplementalVideoUrl } from "@/app/(app)/submissions/[id]/actions"

type Props = {
  submissionId: string
  supplementalUrl: string | null
  hasAutoDetectedVideo: boolean
}

export function VideoLinkEditor({
  submissionId,
  supplementalUrl,
  hasAutoDetectedVideo,
}: Props) {
  const [editing, setEditing] = useState(false)
  const [url, setUrl] = useState(supplementalUrl ?? "")
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  const supplementalSet = !!supplementalUrl
  const label = supplementalSet
    ? "Replace video link"
    : hasAutoDetectedVideo
      ? "Override video link"
      : "Add a performance video link"

  function commit(value: string | null) {
    startTransition(async () => {
      const r = await setSupplementalVideoUrl(submissionId, value)
      if (!r.ok) {
        toast.error(r.error)
        return
      }
      toast.success(value ? "Video link saved." : "Video link cleared.")
      setEditing(false)
      router.refresh()
    })
  }

  function save() {
    const trimmed = url.trim()
    if (!trimmed) {
      commit(null)
      return
    }
    if (!/^https?:\/\/\S+$/i.test(trimmed)) {
      toast.error("Enter an http(s) URL.")
      return
    }
    commit(trimmed)
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => {
          setUrl(supplementalUrl ?? "")
          setEditing(true)
        }}
        className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground underline-offset-4 hover:underline"
      >
        {supplementalSet ? (
          <PencilIcon className="size-3" />
        ) : (
          <VideoIcon className="size-3" />
        )}
        {label}
      </button>
    )
  }

  return (
    <div className="space-y-1.5">
      <div className="relative">
        <LinkIcon className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
        <Input
          autoFocus
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") save()
            if (e.key === "Escape") {
              setEditing(false)
              setUrl(supplementalUrl ?? "")
            }
          }}
          placeholder="https://… (YouTube, Vimeo, IG, TikTok, Drive)"
          className="h-8 pl-7 text-xs"
          disabled={pending}
        />
      </div>
      <div className="flex justify-between items-center gap-1">
        <div>
          {supplementalSet && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-7 text-destructive hover:text-destructive gap-1"
              onClick={() => commit(null)}
              disabled={pending}
            >
              <XIcon className="size-3" /> Clear
            </Button>
          )}
        </div>
        <div className="flex gap-1.5">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-7"
            onClick={() => {
              setEditing(false)
              setUrl(supplementalUrl ?? "")
            }}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            className="h-7"
            onClick={save}
            disabled={pending}
          >
            Save
          </Button>
        </div>
      </div>
    </div>
  )
}
