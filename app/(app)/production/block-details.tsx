"use client"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { BlockCommentsPanel, type BlockComment } from "./block-comments"
import { FESTIVAL_DAYS } from "./festival"
import {
  submissionMeta,
  timeToMinutes,
  type Block,
  type EligibleSubmission,
} from "./schedule-canvas"

function minutesToDisplay(min: number): string {
  const hh = Math.floor(min / 60) % 24
  const mm = min % 60
  const period = hh < 12 ? "am" : "pm"
  const hh12 = hh === 0 ? 12 : hh > 12 ? hh - 12 : hh
  return mm === 0
    ? `${hh12}${period}`
    : `${hh12}:${String(mm).padStart(2, "0")}${period}`
}

export function BlockDetailsDialog({
  block,
  performers,
  comments,
  currentUserId,
  canComment,
  open,
  onClose,
}: {
  block: Block
  performers: EligibleSubmission[]
  comments: BlockComment[]
  currentUserId: string
  canComment: boolean
  open: boolean
  onClose: () => void
}) {
  const day = FESTIVAL_DAYS.find((d) => d.date === block.day)
  const start = minutesToDisplay(timeToMinutes(block.start_time))
  const end = minutesToDisplay(timeToMinutes(block.end_time))

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{block.title || "Untitled block"}</DialogTitle>
          <DialogDescription>
            {day ? `${day.long}, ` : ""}
            {start} – {end}
            {block.location ? ` · ${block.location}` : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          {performers.length > 0 && (
            <div className="grid gap-1.5">
              <h3 className="text-xs font-medium text-muted-foreground">
                Performers
              </h3>
              <ul className="flex flex-wrap gap-1.5">
                {performers.map((s) => {
                  const meta = submissionMeta(s)
                  const caption = [meta.city, meta.kind, meta.contact]
                    .filter(Boolean)
                    .join(" · ")
                  return (
                    <li key={s.id}>
                      <Badge
                        variant="secondary"
                        className="flex-col items-start gap-0 py-1 leading-tight"
                      >
                        <span className="text-sm">{s.name ?? "Untitled"}</span>
                        {caption && (
                          <span className="text-[10px] text-muted-foreground">
                            {caption}
                          </span>
                        )}
                      </Badge>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}

          {block.notes && (
            <div className="grid gap-1.5">
              <h3 className="text-xs font-medium text-muted-foreground">
                Notes
              </h3>
              <p className="text-sm whitespace-pre-wrap">{block.notes}</p>
            </div>
          )}

          <div className="grid gap-1.5">
            <h3 className="text-xs font-medium text-muted-foreground">
              Comments
            </h3>
            <BlockCommentsPanel
              blockId={block.id}
              comments={comments}
              currentUserId={currentUserId}
              canComment={canComment}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
