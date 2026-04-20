"use client"

import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { toast } from "sonner"
import { XIcon } from "lucide-react"
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
import { updateDraftSettings } from "./actions"

const HOUR_OPTIONS = (() => {
  const out: { value: string; label: string }[] = []
  for (let h = 0; h <= 24; h++) {
    const value = `${String(h).padStart(2, "0")}:00:00`
    const label =
      h === 0
        ? "12am"
        : h === 12
          ? "12pm"
          : h === 24
            ? "12am (end of day)"
            : h < 12
              ? `${h}am`
              : `${h - 12}pm`
    out.push({ value, label })
  }
  return out
})()

function normalizeTime(t: string): string {
  if (/^\d{2}:\d{2}:\d{2}$/.test(t)) return t
  if (/^\d{2}:\d{2}$/.test(t)) return `${t}:00`
  return t
}

const DEFAULT_PALETTE = [
  "#f87171",
  "#fb923c",
  "#facc15",
  "#4ade80",
  "#60a5fa",
  "#a78bfa",
  "#f472b6",
  "#2dd4bf",
]

function defaultColorFor(venue: string, idx: number): string {
  return DEFAULT_PALETTE[idx % DEFAULT_PALETTE.length] ?? "#6366f1"
}

export function DraftSettingsDialog({
  draftId,
  venues,
  venueColors,
  windowStartTime,
  windowEndTime,
  open,
  onClose,
}: {
  draftId: string
  venues: string[]
  venueColors: Record<string, string>
  windowStartTime: string
  windowEndTime: string
  open: boolean
  onClose: () => void
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [list, setList] = useState<string[]>(venues)
  const [colors, setColors] = useState<Record<string, string>>(venueColors)
  const [draft, setDraft] = useState("")
  const [start, setStart] = useState(normalizeTime(windowStartTime))
  const [end, setEnd] = useState(normalizeTime(windowEndTime))

  function add() {
    const v = draft.trim()
    if (!v) return
    if (list.some((x) => x.toLowerCase() === v.toLowerCase())) {
      toast.error("Already added.")
      return
    }
    const nextList = [...list, v]
    setList(nextList)
    if (!colors[v]) {
      setColors({ ...colors, [v]: defaultColorFor(v, nextList.length - 1) })
    }
    setDraft("")
  }

  function remove(idx: number) {
    const removed = list[idx]
    setList(list.filter((_, i) => i !== idx))
    if (removed) {
      const next = { ...colors }
      delete next[removed]
      setColors(next)
    }
  }

  function setColor(venue: string, hex: string) {
    setColors({ ...colors, [venue]: hex })
  }

  function save() {
    if (end <= start) {
      toast.error("Window end must be after start.")
      return
    }
    startTransition(async () => {
      const result = await updateDraftSettings(draftId, {
        venues: list,
        venue_colors: colors,
        window_start_time: start,
        window_end_time: end,
      })
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success("Settings saved.")
      onClose()
      router.refresh()
    })
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Draft settings</DialogTitle>
          <DialogDescription>
            Venues and the visible time window for this draft&apos;s schedule.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <Label>Schedule window</Label>
            <div className="grid grid-cols-2 gap-2">
              <Select
                value={start}
                onValueChange={(v) => v && setStart(v)}
              >
                <SelectTrigger>
                  <SelectValue>
                    {(v) =>
                      HOUR_OPTIONS.find((o) => o.value === v)?.label ?? ""
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {HOUR_OPTIONS.slice(0, -1).map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={end} onValueChange={(v) => v && setEnd(v)}>
                <SelectTrigger>
                  <SelectValue>
                    {(v) =>
                      HOUR_OPTIONS.find((o) => o.value === v)?.label ?? ""
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {HOUR_OPTIONS.slice(1).map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <p className="text-xs text-muted-foreground">
              Blocks outside this window won&apos;t be visible on the grid.
            </p>
          </div>

          <div className="grid gap-1.5">
            <Label>Venues</Label>
            <div className="flex gap-2">
              <Input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Venue name"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    add()
                  }
                }}
              />
              <Button type="button" onClick={add} disabled={!draft.trim()}>
                Add
              </Button>
            </div>

            {list.length === 0 ? (
              <p className="text-xs text-muted-foreground">No venues yet.</p>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {list.map((v, i) => {
                  const color = colors[v] ?? defaultColorFor(v, i)
                  return (
                    <li
                      key={`${v}-${i}`}
                      className="flex items-center gap-2 rounded-md border bg-muted/40 pl-1 pr-1 py-1 text-sm"
                    >
                      <label
                        className="relative size-6 rounded-md border cursor-pointer shrink-0"
                        style={{ backgroundColor: color }}
                        title={`Color for ${v}`}
                      >
                        <input
                          type="color"
                          value={color}
                          onChange={(e) => setColor(v, e.target.value)}
                          className="absolute inset-0 size-full opacity-0 cursor-pointer"
                        />
                      </label>
                      <span className="flex-1 truncate">{v}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => remove(i)}
                        aria-label={`Remove ${v}`}
                      >
                        <XIcon className="size-3" />
                      </Button>
                    </li>
                  )
                })}
              </ul>
            )}
            <p className="text-xs text-muted-foreground">
              Click a swatch to change the block fill color for that venue.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={save} disabled={pending}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
