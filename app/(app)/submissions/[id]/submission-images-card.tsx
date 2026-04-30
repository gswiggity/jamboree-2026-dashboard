"use client"

import { useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { ImagePlus, Trash2, X } from "lucide-react"
import { toast } from "sonner"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import {
  createDocument,
  deleteDocument,
} from "@/app/(app)/documents/actions"
import { DOCUMENTS_BUCKET } from "@/app/(app)/documents/constants"

const PERFORMER_PHOTO_CATEGORY = "performer-photo"
const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5 MB
const MAX_IMAGES_PER_SUBMISSION = 10
const ACCEPTED_MIME = /^image\/(png|jpeg|jpg|gif|webp|heic|heif)$/i

export type SubmissionImage = {
  id: string
  storage_path: string
  file_name: string
  preview_url: string | null
  mime_type: string
  size_bytes: number
}

// Storage path for performer photos. Putting them under the submission id
// keeps them addressable as a group when scanning the bucket and survives
// `submission` deletion (cascade) cleanly.
function makeStoragePath(submissionId: string, filename: string): string {
  const rand = Math.random().toString(36).slice(2, 10)
  const safe = filename.replace(/[^a-zA-Z0-9._-]+/g, "_")
  return `submissions/${submissionId}/${Date.now()}-${rand}-${safe}`
}

export function SubmissionImagesCard({
  submissionId,
  initialImages,
}: {
  submissionId: string
  initialImages: SubmissionImage[]
}) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [, startTransition] = useTransition()
  const atLimit = initialImages.length >= MAX_IMAGES_PER_SUBMISSION

  async function uploadFiles(files: FileList | File[]) {
    const remainingSlots = MAX_IMAGES_PER_SUBMISSION - initialImages.length
    if (remainingSlots <= 0) {
      toast.error(`Max ${MAX_IMAGES_PER_SUBMISSION} images per submission.`)
      return
    }
    const list = Array.from(files).slice(0, remainingSlots)
    if (list.length === 0) return

    // Validate up front so we don't half-upload.
    for (const f of list) {
      if (!ACCEPTED_MIME.test(f.type) && !/\.(png|jpe?g|gif|webp|heic|heif)$/i.test(f.name)) {
        toast.error(`"${f.name}" — only image files (png, jpg, gif, webp, heic).`)
        return
      }
      if (f.size > MAX_FILE_SIZE) {
        toast.error(`"${f.name}" is over 5 MB.`)
        return
      }
    }

    setUploading(true)
    const supabase = createClient()
    let succeeded = 0

    for (const file of list) {
      const storagePath = makeStoragePath(submissionId, file.name)
      const { error: uploadError } = await supabase.storage
        .from(DOCUMENTS_BUCKET)
        .upload(storagePath, file, {
          cacheControl: "3600",
          upsert: false,
          contentType: file.type || "application/octet-stream",
        })
      if (uploadError) {
        toast.error(`Upload failed for "${file.name}": ${uploadError.message}`)
        continue
      }
      const dotIdx = file.name.lastIndexOf(".")
      const niceName = dotIdx > 0 ? file.name.slice(0, dotIdx) : file.name
      const res = await createDocument({
        name: niceName,
        file_name: file.name,
        storage_path: storagePath,
        mime_type: file.type || "application/octet-stream",
        size_bytes: file.size,
        category: PERFORMER_PHOTO_CATEGORY,
        description: "",
        submission_id: submissionId,
      })
      if (!res.ok) {
        toast.error(res.error)
        continue
      }
      succeeded++
    }

    setUploading(false)
    if (succeeded > 0) {
      toast.success(
        succeeded === 1 ? "Image uploaded." : `${succeeded} images uploaded.`,
      )
      router.refresh()
    }
  }

  function handleDelete(image: SubmissionImage) {
    if (!window.confirm(`Delete "${image.file_name}"? This can't be undone.`)) {
      return
    }
    startTransition(async () => {
      const res = await deleteDocument(image.id)
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success("Image deleted.")
      router.refresh()
    })
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>
            Photos
            {initialImages.length > 0 && (
              <span className="ml-2 text-xs font-normal text-muted-foreground tabular-nums">
                {initialImages.length} / {MAX_IMAGES_PER_SUBMISSION}
              </span>
            )}
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Team photos for marketing. Visible to all teammates and discoverable
          from the Documents tab. Max 5 MB per image, up to{" "}
          {MAX_IMAGES_PER_SUBMISSION} per submission.
        </p>

        {initialImages.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {initialImages.map((img) => (
              <div
                key={img.id}
                className="group relative aspect-square overflow-hidden rounded-lg border bg-muted"
              >
                {img.preview_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={img.preview_url}
                    alt={img.file_name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-[10px] text-muted-foreground p-2 text-center">
                    {img.file_name}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => handleDelete(img)}
                  className="absolute right-1 top-1 inline-flex items-center justify-center rounded-full bg-rose-600/90 text-white p-1 opacity-0 transition group-hover:opacity-100 hover:bg-rose-700 shadow"
                  aria-label={`Delete ${img.file_name}`}
                  title="Delete"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div
          onDragOver={(e) => {
            if (atLimit || uploading) return
            e.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            if (atLimit || uploading) return
            e.preventDefault()
            setDragging(false)
            const files = e.dataTransfer.files
            if (files && files.length > 0) uploadFiles(files)
          }}
          className={cn(
            "rounded-lg border-2 border-dashed p-4 text-center transition",
            atLimit
              ? "border-slate-200 bg-slate-50/40 text-slate-400"
              : dragging
              ? "border-[#2340d9] bg-blue-50/60"
              : "border-slate-300 bg-white/50 hover:border-blue-300",
          )}
        >
          <div className="flex flex-col items-center gap-1.5">
            <ImagePlus
              className={cn(
                "h-5 w-5",
                atLimit ? "text-slate-300" : "text-slate-500",
              )}
            />
            <button
              type="button"
              disabled={atLimit || uploading}
              onClick={() => inputRef.current?.click()}
              className={cn(
                "text-sm font-medium underline-offset-4 hover:underline disabled:no-underline disabled:cursor-not-allowed",
                atLimit ? "text-slate-400" : "text-blue-700",
              )}
            >
              {uploading
                ? "Uploading…"
                : atLimit
                ? "Limit reached — delete one to add more"
                : "Add photos"}
            </button>
            {!atLimit && !uploading && (
              <span className="text-[11px] text-slate-500">
                or drop them here
              </span>
            )}
          </div>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              const files = e.target.files
              if (files && files.length > 0) uploadFiles(files)
              if (e.target) e.target.value = ""
            }}
          />
        </div>
      </CardContent>
    </Card>
  )
}

// Badge variant: a tiny inline component used in the heading / list contexts.
// (Currently unused — placeholder for the /performers thumbnail strip in the
// next iteration.)
export function ImagesBadge({ count }: { count: number }) {
  if (count === 0) return null
  return (
    <span className="inline-flex items-center gap-0.5 rounded-full bg-violet-50 text-violet-900 border border-violet-100 px-1.5 py-0.5 text-[10px] font-semibold">
      <X className="h-2 w-2 hidden" />
      {count} photo{count === 1 ? "" : "s"}
    </span>
  )
}
