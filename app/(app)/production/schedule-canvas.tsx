"use client"

import { useEffect, useRef, useState } from "react"
import { MessageSquare } from "lucide-react"
import { cn } from "@/lib/utils"
import { BlockDialog, type BlockDialogInput } from "./block-dialog"
import { BlockDetailsDialog } from "./block-details"
import type { BlockComment } from "./block-comments"

export type Block = {
  id: string
  draft_id: string
  day: string
  start_time: string
  end_time: string
  title: string | null
  location: string | null
  notes: string | null
}

export type EligibleSubmission = {
  id: string
  type: string
  name: string | null
  email: string | null
  data: Record<string, unknown> | null
}

export function submissionMeta(s: EligibleSubmission): {
  city: string | null
  kind: string | null
  contact: string | null
} {
  const d = (s.data ?? {}) as Record<string, unknown>
  const pick = (key: string) => {
    const v = d[key]
    return v == null || String(v).trim() === "" ? null : String(v).trim()
  }
  if (s.type === "act") {
    return {
      city: pick("Location"),
      kind: pick("GroupAct Type"),
      contact: pick("Primary Contact 11"),
    }
  }
  if (s.type === "workshop") {
    return {
      city: pick("CityRegion"),
      kind: "Workshop",
      contact: pick("Name"),
    }
  }
  return { city: null, kind: s.type, contact: null }
}

import { FESTIVAL_DAYS } from "./festival"

const SLOT_MIN = 15
const SLOT_PX = 20

export function timeToMinutes(t: string): number {
  const [hh, mm] = t.split(":").map(Number)
  return hh * 60 + mm
}
function minutesToDbTime(min: number): string {
  const hh = Math.floor(min / 60)
  const mm = min % 60
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:00`
}
function minutesToDisplay(min: number): string {
  const hh = Math.floor(min / 60) % 24
  const mm = min % 60
  const period = hh < 12 ? "am" : "pm"
  const hh12 = hh === 0 ? 12 : hh > 12 ? hh - 12 : hh
  return mm === 0 ? `${hh12}${period}` : `${hh12}:${String(mm).padStart(2, "0")}${period}`
}

type Laid = Block & { lane: number; lanes: number; topPx: number; heightPx: number }

function layoutDay(blocks: Block[], startMin: number): Laid[] {
  const sorted = [...blocks].sort((a, b) => {
    const sa = timeToMinutes(a.start_time)
    const sb = timeToMinutes(b.start_time)
    if (sa !== sb) return sa - sb
    return timeToMinutes(a.end_time) - timeToMinutes(b.end_time)
  })
  const out: Laid[] = []
  let cluster: (Block & { lane: number })[] = []
  let clusterEnd = -1

  const flush = () => {
    const max = cluster.reduce((m, b) => Math.max(m, b.lane), 0)
    for (const b of cluster) {
      const s = timeToMinutes(b.start_time)
      const e = timeToMinutes(b.end_time)
      out.push({
        ...b,
        lanes: max + 1,
        topPx: ((s - startMin) / SLOT_MIN) * SLOT_PX,
        heightPx: ((e - s) / SLOT_MIN) * SLOT_PX,
      })
    }
    cluster = []
    clusterEnd = -1
  }

  for (const b of sorted) {
    const s = timeToMinutes(b.start_time)
    const e = timeToMinutes(b.end_time)
    if (cluster.length > 0 && s >= clusterEnd) flush()
    const active = cluster.filter((c) => timeToMinutes(c.end_time) > s)
    const used = new Set(active.map((a) => a.lane))
    let lane = 0
    while (used.has(lane)) lane++
    cluster.push({ ...b, lane })
    clusterEnd = Math.max(clusterEnd, e)
  }
  if (cluster.length > 0) flush()
  return out
}

type DragState = {
  day: string
  anchorSlot: number
  currentSlot: number
}

export function ScheduleCanvas({
  draftId,
  isPublished,
  viewerRole,
  blocks,
  venues,
  venueColors,
  windowStartTime,
  windowEndTime,
  eligibleSubmissions,
  tagsByBlock,
  commentsByBlock,
  currentUserId,
}: {
  draftId: string
  isPublished: boolean
  viewerRole: "admin" | "member"
  blocks: Block[]
  venues: string[]
  venueColors: Record<string, string>
  windowStartTime: string
  windowEndTime: string
  eligibleSubmissions: EligibleSubmission[]
  tagsByBlock: Record<string, string[]>
  commentsByBlock: Record<string, BlockComment[]>
  currentUserId: string
}) {
  const isAdmin = viewerRole === "admin"
  const START_MIN = timeToMinutes(windowStartTime)
  const END_MIN = timeToMinutes(windowEndTime)
  const TOTAL_SLOTS = Math.max(1, Math.round((END_MIN - START_MIN) / SLOT_MIN))

  const [drag, setDrag] = useState<DragState | null>(null)
  const [dialog, setDialog] = useState<
    | { mode: "create"; input: BlockDialogInput }
    | { mode: "edit"; block: Block }
    | null
  >(null)
  const columnsRef = useRef<Map<string, HTMLDivElement | null>>(new Map())

  useEffect(() => {
    if (!drag) return
    function onMove(e: MouseEvent) {
      if (!drag) return
      const col = columnsRef.current.get(drag.day)
      if (!col) return
      const rect = col.getBoundingClientRect()
      const y = e.clientY - rect.top
      const slot = Math.max(0, Math.min(TOTAL_SLOTS, Math.floor(y / SLOT_PX)))
      setDrag((d) => (d ? { ...d, currentSlot: slot } : null))
    }
    function onUp() {
      setDrag((d) => {
        if (!d) return null
        const a = Math.min(d.anchorSlot, d.currentSlot)
        const b = Math.max(d.anchorSlot, d.currentSlot)
        const endSlot = b === a ? a + 1 : b
        const start = START_MIN + a * SLOT_MIN
        const end = START_MIN + Math.min(TOTAL_SLOTS, endSlot) * SLOT_MIN
        setDialog({
          mode: "create",
          input: {
            day: d.day,
            start_time: minutesToDbTime(start),
            end_time: minutesToDbTime(end),
            title: "",
            location: "",
            notes: "",
          },
        })
        return null
      })
    }
    window.addEventListener("mousemove", onMove)
    window.addEventListener("mouseup", onUp)
    return () => {
      window.removeEventListener("mousemove", onMove)
      window.removeEventListener("mouseup", onUp)
    }
  }, [drag, START_MIN, TOTAL_SLOTS])

  function onColumnMouseDown(e: React.MouseEvent, day: string) {
    if (!isAdmin || isPublished) return
    if ((e.target as HTMLElement).closest("[data-block]")) return
    const col = columnsRef.current.get(day)
    if (!col) return
    const rect = col.getBoundingClientRect()
    const y = e.clientY - rect.top
    const slot = Math.max(0, Math.min(TOTAL_SLOTS - 1, Math.floor(y / SLOT_PX)))
    setDrag({ day, anchorSlot: slot, currentSlot: slot + 1 })
  }

  const byDay = new Map<string, Block[]>()
  for (const b of blocks) {
    const arr = byDay.get(b.day) ?? []
    arr.push(b)
    byDay.set(b.day, arr)
  }

  return (
    <>
      <div className="rounded-lg border bg-card overflow-hidden">
        <div className="grid" style={{ gridTemplateColumns: "64px repeat(4, 1fr)" }}>
          <div className="border-b border-r bg-muted/30 h-10" />
          {FESTIVAL_DAYS.map((d) => (
            <div
              key={d.date}
              className="border-b border-r last:border-r-0 h-10 flex items-center justify-center text-sm font-medium"
            >
              <span>{d.label}</span>
              <span className="ml-2 text-muted-foreground text-xs">
                Jul {Number(d.date.slice(-2))}
              </span>
            </div>
          ))}

          <div className="relative border-r">
            {Array.from({ length: (END_MIN - START_MIN) / 60 + 1 }).map((_, i) => {
              const hour = START_MIN / 60 + i
              const display =
                hour === 24 ? "12am" :
                hour === 12 ? "12pm" :
                hour > 12 ? `${hour - 12}pm` :
                hour === 0 ? "12am" :
                `${hour}am`
              return (
                <div
                  key={i}
                  className="text-[10px] text-muted-foreground -translate-y-1/2 pr-1 text-right"
                  style={{ position: "absolute", top: i * 4 * SLOT_PX, right: 0, width: "100%" }}
                >
                  {display}
                </div>
              )
            })}
            <div style={{ height: TOTAL_SLOTS * SLOT_PX }} />
          </div>

          {FESTIVAL_DAYS.map((d) => {
            const dayBlocks = layoutDay(byDay.get(d.date) ?? [], START_MIN)
            const isDragDay = drag?.day === d.date
            const dragA = isDragDay ? Math.min(drag!.anchorSlot, drag!.currentSlot) : 0
            const dragB = isDragDay ? Math.max(drag!.anchorSlot, drag!.currentSlot) : 0
            const dragEndSlot = isDragDay && dragB === dragA ? dragA + 1 : dragB
            const dragTop = dragA * SLOT_PX
            const dragHeight = Math.max(SLOT_PX, (dragEndSlot - dragA) * SLOT_PX)
            const dragStartLabel = isDragDay
              ? minutesToDisplay(START_MIN + dragA * SLOT_MIN)
              : ""
            const dragEndLabel = isDragDay
              ? minutesToDisplay(START_MIN + dragEndSlot * SLOT_MIN)
              : ""
            return (
              <div
                key={d.date}
                ref={(el) => {
                  columnsRef.current.set(d.date, el)
                }}
                data-day={d.date}
                onMouseDown={(e) => onColumnMouseDown(e, d.date)}
                className={cn(
                  "relative border-r last:border-r-0",
                  isAdmin && !isPublished && "cursor-crosshair",
                )}
                style={{ height: TOTAL_SLOTS * SLOT_PX }}
              >
                {Array.from({ length: TOTAL_SLOTS }).map((_, i) => (
                  <div
                    key={i}
                    className={cn(
                      "border-b",
                      i % 4 === 3 ? "border-border" : "border-muted/40",
                    )}
                    style={{ height: SLOT_PX }}
                  />
                ))}

                {dayBlocks.map((b) => {
                  const widthPct = 100 / b.lanes
                  const leftPct = b.lane * widthPct
                  const tagIds = tagsByBlock[b.id] ?? []
                  const tagNames = tagIds
                    .map((id) => eligibleSubmissions.find((s) => s.id === id)?.name)
                    .filter((n): n is string => !!n)
                  const commentCount = commentsByBlock[b.id]?.length ?? 0
                  const color =
                    b.location && venueColors[b.location]
                      ? venueColors[b.location]
                      : null
                  const colorStyle = color
                    ? { backgroundColor: `${color}40`, borderColor: color }
                    : undefined
                  return (
                    <button
                      key={b.id}
                      data-block
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        setDialog({ mode: "edit", block: b })
                      }}
                      style={{
                        position: "absolute",
                        top: b.topPx,
                        height: b.heightPx,
                        left: `calc(${leftPct}% + 2px)`,
                        width: `calc(${widthPct}% - 4px)`,
                        ...colorStyle,
                      }}
                      className={cn(
                        "rounded-md border text-left px-1.5 py-0.5 overflow-hidden text-xs transition-colors shadow-sm",
                        color
                          ? "hover:brightness-110"
                          : "border-primary/60 bg-primary/25 hover:bg-primary/35",
                      )}
                    >
                      <div className="font-medium truncate leading-tight">
                        {b.title || "Untitled"}
                      </div>
                      <div className="flex items-center gap-1 text-[10px] text-muted-foreground leading-tight">
                        <span className="truncate min-w-0 flex-1">
                          {minutesToDisplay(timeToMinutes(b.start_time))}–
                          {minutesToDisplay(timeToMinutes(b.end_time))}
                          {b.location ? ` · ${b.location}` : ""}
                        </span>
                        {commentCount > 0 && (
                          <span className="shrink-0 inline-flex items-center gap-0.5 tabular-nums">
                            <MessageSquare className="h-2.5 w-2.5" aria-hidden />
                            {commentCount}
                          </span>
                        )}
                      </div>
                      {tagNames.length === 1 && (
                        <div className="text-[10px] leading-tight truncate mt-0.5">
                          {tagNames[0]}
                        </div>
                      )}
                      {tagNames.length >= 2 && (
                        <div className="text-[10px] leading-tight truncate mt-0.5">
                          {tagNames[0]}{" "}
                          <span className="text-muted-foreground">
                            +{tagNames.length - 1}
                          </span>
                        </div>
                      )}
                    </button>
                  )
                })}

                {isDragDay && (
                  <div
                    className="pointer-events-none absolute inset-x-0.5 z-10 rounded-md border-2 border-primary bg-primary/50 shadow-lg"
                    style={{ top: dragTop, height: dragHeight }}
                  >
                    <div className="px-1.5 py-0.5 text-[10px] font-medium text-primary-foreground leading-tight truncate">
                      {dragStartLabel} – {dragEndLabel}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {dialog && isAdmin && (
        <BlockDialog
          draftId={draftId}
          venues={venues}
          windowStartTime={windowStartTime}
          windowEndTime={windowEndTime}
          eligibleSubmissions={eligibleSubmissions}
          currentUserId={currentUserId}
          canComment={isPublished}
          open
          onClose={() => setDialog(null)}
          {...(dialog.mode === "create"
            ? {
                mode: "create" as const,
                input: dialog.input,
                initialTags: [],
                comments: [],
              }
            : {
                mode: "edit" as const,
                block: dialog.block,
                initialTags: tagsByBlock[dialog.block.id] ?? [],
                comments: commentsByBlock[dialog.block.id] ?? [],
              })}
        />
      )}

      {dialog && !isAdmin && dialog.mode === "edit" && (
        <BlockDetailsDialog
          block={dialog.block}
          performers={(tagsByBlock[dialog.block.id] ?? [])
            .map((id) => eligibleSubmissions.find((s) => s.id === id))
            .filter((s): s is EligibleSubmission => !!s)}
          comments={commentsByBlock[dialog.block.id] ?? []}
          currentUserId={currentUserId}
          canComment={isPublished}
          open
          onClose={() => setDialog(null)}
        />
      )}
    </>
  )
}
