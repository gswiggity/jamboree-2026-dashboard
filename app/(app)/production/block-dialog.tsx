"use client"

import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Combobox } from "@base-ui/react/combobox"
import { XIcon } from "lucide-react"
import { createBlock, deleteBlock, setBlockSubmissions, updateBlock } from "./actions"
import { BlockCommentsPanel, type BlockComment } from "./block-comments"
import {
  FESTIVAL_DAYS,
  submissionMeta,
  timeToMinutes,
  type Block,
  type EligibleSubmission,
} from "./schedule-canvas"

export type BlockDialogInput = {
  day: string
  start_time: string
  end_time: string
  title: string
  location: string
  notes: string
}

function buildTimeOptions(startMin: number, endMin: number) {
  const out: { value: string; label: string }[] = []
  for (let min = startMin; min <= endMin; min += 15) {
    const hh = Math.floor(min / 60)
    const mm = min % 60
    const value = `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:00`
    const hh12 = hh % 12 === 0 ? 12 : hh % 12
    const period = hh < 12 ? "am" : "pm"
    const label =
      mm === 0
        ? `${hh12}:00${period}`
        : `${hh12}:${String(mm).padStart(2, "0")}${period}`
    out.push({ value, label: hh === 24 ? "12:00am (end of day)" : label })
  }
  return out
}

type Props = {
  draftId: string
  venues: string[]
  windowStartTime: string
  windowEndTime: string
  eligibleSubmissions: EligibleSubmission[]
  currentUserId: string
  canComment: boolean
  open: true
  onClose: () => void
} & (
  | {
      mode: "create"
      input: BlockDialogInput
      initialTags: string[]
      comments: BlockComment[]
    }
  | {
      mode: "edit"
      block: Block
      initialTags: string[]
      comments: BlockComment[]
    }
)

export function BlockDialog(props: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const TIME_OPTIONS = buildTimeOptions(
    timeToMinutes(props.windowStartTime),
    timeToMinutes(props.windowEndTime),
  )

  const initial: BlockDialogInput =
    props.mode === "create"
      ? props.input
      : {
          day: props.block.day,
          start_time: toTimeOption(props.block.start_time),
          end_time: toTimeOption(props.block.end_time),
          title: props.block.title ?? "",
          location: props.block.location ?? "",
          notes: props.block.notes ?? "",
        }

  const [state, setState] = useState<BlockDialogInput>(initial)
  const [selectedSubs, setSelectedSubs] = useState<EligibleSubmission[]>(
    () =>
      props.initialTags
        .map((id) => props.eligibleSubmissions.find((s) => s.id === id))
        .filter((s): s is EligibleSubmission => !!s),
  )
  const selectedTags = selectedSubs.map((s) => s.id)

  const initialTagsSorted = [...props.initialTags].sort().join(",")
  const selectedTagsSorted = [...selectedTags].sort().join(",")
  const tagsChanged = initialTagsSorted !== selectedTagsSorted

  function save() {
    startTransition(async () => {
      if (state.end_time <= state.start_time) {
        toast.error("End must be after start.")
        return
      }
      const payload = {
        day: state.day,
        start_time: state.start_time,
        end_time: state.end_time,
        title: state.title,
        location: state.location,
        notes: state.notes,
      }
      let blockId: string
      if (props.mode === "create") {
        const result = await createBlock({ ...payload, draft_id: props.draftId })
        if (!result.ok) {
          toast.error(result.error)
          return
        }
        blockId = result.data.id
      } else {
        const result = await updateBlock(props.block.id, payload)
        if (!result.ok) {
          toast.error(result.error)
          return
        }
        blockId = props.block.id
      }
      if (tagsChanged) {
        const tagResult = await setBlockSubmissions(blockId, selectedTags)
        if (!tagResult.ok) {
          toast.error(tagResult.error)
          return
        }
      }
      toast.success(props.mode === "create" ? "Block created." : "Saved.")
      props.onClose()
      router.refresh()
    })
  }

  function onDelete() {
    if (props.mode !== "edit") return
    if (!confirm("Delete this block?")) return
    startTransition(async () => {
      const result = await deleteBlock(props.block.id)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success("Deleted.")
      props.onClose()
      router.refresh()
    })
  }

  return (
    <Dialog open={props.open} onOpenChange={(o) => !o && props.onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {props.mode === "create" ? "New block" : "Edit block"}
          </DialogTitle>
          <DialogDescription>
            Set the day, time window, and a title. Location and notes are
            optional.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label>Title</Label>
            <Input
              value={state.title}
              onChange={(e) => setState({ ...state, title: e.target.value })}
              placeholder="e.g. Friday Late Show"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="grid gap-1.5">
              <Label>Day</Label>
              <Select
                value={state.day}
                onValueChange={(v) => v && setState({ ...state, day: v })}
              >
                <SelectTrigger>
                  <SelectValue>
                    {(v) =>
                      FESTIVAL_DAYS.find((d) => d.date === v)?.label ?? ""
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {FESTIVAL_DAYS.map((d) => (
                    <SelectItem key={d.date} value={d.date}>
                      {d.long} · Jul {Number(d.date.slice(-2))}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-1.5">
              <Label>Start</Label>
              <Select
                value={state.start_time}
                onValueChange={(v) => v && setState({ ...state, start_time: v })}
              >
                <SelectTrigger>
                  <SelectValue>
                    {(v) => TIME_OPTIONS.find((t) => t.value === v)?.label ?? ""}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {TIME_OPTIONS.slice(0, -1).map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-1.5">
              <Label>End</Label>
              <Select
                value={state.end_time}
                onValueChange={(v) => v && setState({ ...state, end_time: v })}
              >
                <SelectTrigger>
                  <SelectValue>
                    {(v) => TIME_OPTIONS.find((t) => t.value === v)?.label ?? ""}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {TIME_OPTIONS.slice(1).map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label>Location</Label>
            {props.venues.length > 0 ? (
              <Select
                value={state.location || "__none__"}
                onValueChange={(v) =>
                  setState({
                    ...state,
                    location: !v || v === "__none__" ? "" : v,
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue>
                    {(v) =>
                      !v || v === "__none__" ? "No venue" : String(v)
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">No venue</SelectItem>
                  {props.venues.map((v) => (
                    <SelectItem key={v} value={v}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                value={state.location}
                onChange={(e) =>
                  setState({ ...state, location: e.target.value })
                }
                placeholder="Add venues on the draft to pick from a list"
              />
            )}
          </div>

          <div className="grid gap-1.5">
            <Label>Notes</Label>
            <Textarea
              value={state.notes}
              onChange={(e) => setState({ ...state, notes: e.target.value })}
              placeholder="Optional"
              rows={3}
            />
          </div>

          <div className="grid gap-1.5">
            <Label>Performers</Label>
            <Combobox.Root
              items={props.eligibleSubmissions}
              multiple
              value={selectedSubs}
              onValueChange={(v) => setSelectedSubs(v)}
              itemToStringLabel={(s) => s.name ?? ""}
              itemToStringValue={(s) => s.id}
              isItemEqualToValue={(a, b) => a.id === b.id}
              filter={(item, query) => {
                if (!query) return true
                const q = query.toLowerCase()
                const meta = submissionMeta(item)
                return (
                  (item.name ?? "").toLowerCase().includes(q) ||
                  (item.email ?? "").toLowerCase().includes(q) ||
                  (meta.city ?? "").toLowerCase().includes(q) ||
                  (meta.kind ?? "").toLowerCase().includes(q) ||
                  (meta.contact ?? "").toLowerCase().includes(q)
                )
              }}
            >
              <Combobox.Chips className="flex flex-wrap items-center gap-1 rounded-lg border border-input bg-transparent px-2 py-1.5 min-h-9 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50">
                {selectedSubs.map((s) => (
                  <Combobox.Chip
                    key={s.id}
                    className="flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-xs"
                    aria-label={s.name ?? "Tag"}
                  >
                    <span className="truncate max-w-[180px]">
                      {s.name ?? "Untitled"}
                    </span>
                    <Combobox.ChipRemove
                      aria-label={`Remove ${s.name ?? "tag"}`}
                      className="rounded hover:bg-muted-foreground/10"
                    >
                      <XIcon className="size-3" />
                    </Combobox.ChipRemove>
                  </Combobox.Chip>
                ))}
                <Combobox.Input
                  placeholder={
                    selectedSubs.length === 0
                      ? "Search acts & workshops…"
                      : "Add another…"
                  }
                  className="flex-1 min-w-[120px] bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                />
              </Combobox.Chips>
              <Combobox.Portal>
                <Combobox.Positioner sideOffset={4} className="isolate z-50">
                  <Combobox.Popup className="max-h-60 w-(--anchor-width) overflow-y-auto rounded-lg bg-popover text-popover-foreground shadow-md ring-1 ring-foreground/10">
                    <Combobox.Empty className="px-3 py-2 text-xs text-muted-foreground">
                      {props.eligibleSubmissions.length === 0
                        ? "Import acts or workshops in Settings first."
                        : "No matches."}
                    </Combobox.Empty>
                    <Combobox.List>
                      {(s: EligibleSubmission) => {
                        const meta = submissionMeta(s)
                        const caption = [meta.city, meta.kind, meta.contact]
                          .filter(Boolean)
                          .join(" · ")
                        return (
                          <Combobox.Item
                            key={s.id}
                            value={s}
                            className="cursor-default select-none px-2 py-1.5 text-sm data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground"
                          >
                            <div className="font-medium truncate">
                              {s.name ?? "Untitled"}
                            </div>
                            {caption && (
                              <div className="text-xs text-muted-foreground truncate">
                                {caption}
                              </div>
                            )}
                          </Combobox.Item>
                        )
                      }}
                    </Combobox.List>
                  </Combobox.Popup>
                </Combobox.Positioner>
              </Combobox.Portal>
            </Combobox.Root>
          </div>

          {props.mode === "edit" && (
            <div className="grid gap-1.5">
              <Label>Comments</Label>
              <BlockCommentsPanel
                blockId={props.block.id}
                comments={props.comments}
                currentUserId={props.currentUserId}
                canComment={props.canComment}
              />
            </div>
          )}
        </div>

        <DialogFooter>
          {props.mode === "edit" && (
            <Button
              variant="ghost"
              onClick={onDelete}
              disabled={pending}
              className="mr-auto text-destructive hover:text-destructive"
            >
              Delete
            </Button>
          )}
          <Button variant="outline" onClick={props.onClose} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={save} disabled={pending}>
            {props.mode === "create" ? "Create" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function toTimeOption(t: string): string {
  if (/^\d{2}:\d{2}:\d{2}$/.test(t)) return t
  if (/^\d{2}:\d{2}$/.test(t)) return `${t}:00`
  return t
}
