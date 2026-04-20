"use client"

import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { toast } from "sonner"
import { TrashIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { addBlockComment, deleteBlockComment } from "./actions"

export type BlockComment = {
  id: string
  user_id: string
  body: string
  created_at: string
  author_name: string | null
  author_email: string
}

function formatWhen(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

export function BlockCommentsPanel({
  blockId,
  comments,
  currentUserId,
  canComment,
}: {
  blockId: string
  comments: BlockComment[]
  currentUserId: string
  canComment: boolean
}) {
  const router = useRouter()
  const [body, setBody] = useState("")
  const [pending, startTransition] = useTransition()

  function onAdd() {
    const trimmed = body.trim()
    if (!trimmed) return
    startTransition(async () => {
      const result = await addBlockComment(blockId, trimmed)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      setBody("")
      router.refresh()
    })
  }

  function onDelete(id: string) {
    if (!confirm("Delete this comment?")) return
    startTransition(async () => {
      const result = await deleteBlockComment(id)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      router.refresh()
    })
  }

  return (
    <div className="grid gap-2">
      {comments.length === 0 ? (
        <p className="text-xs text-muted-foreground">No comments yet.</p>
      ) : (
        <ul className="grid gap-2 max-h-48 overflow-y-auto">
          {comments.map((c) => {
            const mine = c.user_id === currentUserId
            return (
              <li
                key={c.id}
                className="rounded-md border bg-muted/30 px-2 py-1.5 text-sm"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium">
                    {c.author_name || c.author_email || "Unknown"}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {formatWhen(c.created_at)}
                  </span>
                </div>
                <p className="whitespace-pre-wrap mt-0.5">{c.body}</p>
                {mine && (
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => onDelete(c.id)}
                      disabled={pending}
                      aria-label="Delete comment"
                    >
                      <TrashIcon className="size-3" />
                    </Button>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {canComment ? (
        <div className="grid gap-1.5">
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Add a comment…"
            rows={2}
          />
          <div className="flex justify-end">
            <Button
              size="sm"
              onClick={onAdd}
              disabled={pending || !body.trim()}
            >
              Post
            </Button>
          </div>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          Comments open once this schedule is published.
        </p>
      )}
    </div>
  )
}
