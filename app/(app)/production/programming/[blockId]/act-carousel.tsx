"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  PlusIcon,
  SearchIcon,
  XIcon,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { VideoLinkEditor } from "@/components/video-link-editor"
import { CANONICAL_ACT_TYPES, canonicalActType } from "@/lib/act-types"
import { cn } from "@/lib/utils"
import {
  pickBlurb,
  pickFirstEmbedUrl,
  pickStr,
  type ActJudgment,
  type ActSubmission,
} from "./act-marketing"

type Sort = "name_asc" | "name_desc" | "type" | "location" | "verdicts"

type Tier = "locked" | "likely" | "bubble" | "none"

// Mirrors the bucketing on /lineup so the sort produces the same ordering.
function classifyTier(judgments: ActJudgment[]): Tier {
  let yes = 0
  let no = 0
  for (const j of judgments) {
    if (j.verdict === "yes") yes++
    else if (j.verdict === "no") no++
  }
  if (yes <= 0) return "none"
  if (yes >= 2 && no === 0) return "locked"
  if (yes > no) return "likely"
  return "bubble"
}

const TIER_RANK: Record<Tier, number> = {
  locked: 0,
  likely: 1,
  bubble: 2,
  none: 3,
}

export type BookedElsewhereInfo = {
  blockId: string
  blockTitle: string | null
  day: string
  start_time: string
}

type Props = {
  candidates: ActSubmission[]
  excludedIds: Set<string>
  judgmentsBySubmission: Record<string, ActJudgment[]>
  bookedElsewhere?: Record<string, BookedElsewhereInfo>
  onAdd: (sub: ActSubmission) => void
}

export function ActCarousel({
  candidates,
  excludedIds,
  judgmentsBySubmission,
  bookedElsewhere,
  onAdd,
}: Props) {
  const pool = useMemo(
    () => candidates.filter((c) => !excludedIds.has(c.id)),
    [candidates, excludedIds],
  )

  const [actTypes, setActTypes] = useState<string[]>([])
  const [locations, setLocations] = useState<string[]>([])
  const [search, setSearch] = useState("")
  const [sort, setSort] = useState<Sort>("name_asc")

  const typeFacets = useMemo(() => {
    const counts = new Map<string, number>()
    for (const c of pool) {
      const k = canonicalActType(pickStr(c.data, "GroupAct Type")).key
      counts.set(k, (counts.get(k) ?? 0) + 1)
    }
    return CANONICAL_ACT_TYPES.filter((t) => counts.has(t.key)).map((t) => ({
      key: t.key,
      label: t.label,
      count: counts.get(t.key) ?? 0,
    }))
  }, [pool])

  const locationFacets = useMemo(() => {
    const counts = new Map<string, number>()
    for (const c of pool) {
      const v = pickStr(c.data, "Location") ?? "(no location)"
      counts.set(v, (counts.get(v) ?? 0) + 1)
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([key, count]) => ({ key, count }))
  }, [pool])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    let list = pool.filter((c) => {
      if (actTypes.length > 0) {
        const k = canonicalActType(pickStr(c.data, "GroupAct Type")).key
        if (!actTypes.includes(k)) return false
      }
      if (locations.length > 0) {
        const loc = pickStr(c.data, "Location") ?? "(no location)"
        if (!locations.includes(loc)) return false
      }
      if (q) {
        const hay = [
          c.name,
          c.email,
          pickStr(c.data, "Location"),
          pickStr(c.data, "GroupAct Type"),
          pickStr(c.data, "Primary Contact 11"),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
    list = list.slice()
    list.sort((a, b) => {
      if (sort === "name_asc")
        return (a.name ?? "").localeCompare(b.name ?? "")
      if (sort === "name_desc")
        return (b.name ?? "").localeCompare(a.name ?? "")
      if (sort === "type") {
        const at = canonicalActType(pickStr(a.data, "GroupAct Type")).label
        const bt = canonicalActType(pickStr(b.data, "GroupAct Type")).label
        return (
          at.localeCompare(bt) ||
          (a.name ?? "").localeCompare(b.name ?? "")
        )
      }
      if (sort === "verdicts") {
        const aj = judgmentsBySubmission[a.id] ?? []
        const bj = judgmentsBySubmission[b.id] ?? []
        const at = TIER_RANK[classifyTier(aj)]
        const bt = TIER_RANK[classifyTier(bj)]
        if (at !== bt) return at - bt
        const ay = aj.filter((j) => j.verdict === "yes").length
        const by = bj.filter((j) => j.verdict === "yes").length
        if (ay !== by) return by - ay
        const an = aj.filter((j) => j.verdict === "no").length
        const bn = bj.filter((j) => j.verdict === "no").length
        if (an !== bn) return an - bn
        return (a.name ?? "").localeCompare(b.name ?? "")
      }
      const al = pickStr(a.data, "Location") ?? ""
      const bl = pickStr(b.data, "Location") ?? ""
      return al.localeCompare(bl) || (a.name ?? "").localeCompare(b.name ?? "")
    })
    return list
  }, [pool, actTypes, locations, search, sort, judgmentsBySubmission])

  const scrollerRef = useRef<HTMLDivElement>(null)
  const [activeIdx, setActiveIdx] = useState(0)

  function resetScroll() {
    setActiveIdx(0)
    scrollerRef.current?.scrollTo({ left: 0 })
  }

  function scrollToCard(i: number) {
    const sc = scrollerRef.current
    if (!sc) return
    const card = sc.children[i] as HTMLElement | undefined
    if (!card) return
    const left = card.offsetLeft - sc.offsetLeft
    sc.scrollTo({ left, behavior: "smooth" })
  }

  function nudge(dir: -1 | 1) {
    const next = Math.max(0, Math.min(filtered.length - 1, activeIdx + dir))
    setActiveIdx(next)
    scrollToCard(next)
  }

  function clearFilters() {
    setActTypes([])
    setLocations([])
    setSearch("")
    resetScroll()
  }

  const filtersActive =
    actTypes.length > 0 || locations.length > 0 || search.trim().length > 0

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <FacetMultiSelect
          label="Act type"
          allLabel="All act types"
          options={typeFacets.map((f) => ({
            key: f.key,
            label: f.label,
            count: f.count,
          }))}
          selected={actTypes}
          onChange={(v) => {
            setActTypes(v)
            resetScroll()
          }}
        />
        <FacetMultiSelect
          label="Location"
          allLabel="All locations"
          options={locationFacets.map((f) => ({
            key: f.key,
            label: f.key,
            count: f.count,
          }))}
          selected={locations}
          onChange={(v) => {
            setLocations(v)
            resetScroll()
          }}
        />
        <div className="relative">
          <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              resetScroll()
            }}
            placeholder="Search name, contact…"
            className="h-8 pl-7 w-56 text-sm"
          />
        </div>
        <Select
          value={sort}
          onValueChange={(v) => {
            if (!v) return
            setSort(v as Sort)
            resetScroll()
          }}
        >
          <SelectTrigger className="h-8 w-48 text-sm">
            <SelectValue>
              {(v) => {
                const map: Record<string, string> = {
                  verdicts: "Sort: Lineup tier",
                  name_asc: "Sort: Name A→Z",
                  name_desc: "Sort: Name Z→A",
                  type: "Sort: Act type",
                  location: "Sort: Location",
                }
                return map[v as string] ?? "Sort"
              }}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="verdicts">Lineup tier (locked → bubble)</SelectItem>
            <SelectItem value="name_asc">Name A→Z</SelectItem>
            <SelectItem value="name_desc">Name Z→A</SelectItem>
            <SelectItem value="type">Act type</SelectItem>
            <SelectItem value="location">Location</SelectItem>
          </SelectContent>
        </Select>
        {filtersActive && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={clearFilters}
            className="text-muted-foreground hover:text-foreground"
          >
            Clear filters
          </Button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="border border-dashed rounded-lg py-10 text-center text-sm text-muted-foreground">
          {pool.length === 0
            ? 'Mark acts as "Yes" in Judging to add them here.'
            : "No acts match these filters."}
        </div>
      ) : (
        <div className="relative">
          <CarouselButton
            direction="prev"
            disabled={activeIdx === 0}
            onClick={() => nudge(-1)}
          />
          <div
            ref={scrollerRef}
            className="flex gap-3 overflow-x-auto snap-x snap-mandatory scroll-smooth pb-2 -mx-1 px-1"
            onScroll={() => {
              const sc = scrollerRef.current
              if (!sc) return
              const cards = Array.from(sc.children) as HTMLElement[]
              let closest = 0
              let min = Infinity
              for (let i = 0; i < cards.length; i++) {
                const dist = Math.abs(
                  cards[i].offsetLeft - sc.offsetLeft - sc.scrollLeft,
                )
                if (dist < min) {
                  min = dist
                  closest = i
                }
              }
              if (closest !== activeIdx) setActiveIdx(closest)
            }}
          >
            {filtered.map((c) => (
              <ActCard
                key={c.id}
                sub={c}
                judgments={judgmentsBySubmission[c.id] ?? []}
                bookedElsewhere={bookedElsewhere?.[c.id]}
                onAdd={() => onAdd(c)}
              />
            ))}
          </div>
          <CarouselButton
            direction="next"
            disabled={activeIdx >= filtered.length - 1}
            onClick={() => nudge(1)}
          />
          <div className="flex items-center justify-between mt-1 text-xs text-muted-foreground">
            <span className="tabular-nums">
              {activeIdx + 1} of {filtered.length}
            </span>
            <span>Drag, scroll, or use the arrows to browse.</span>
          </div>
        </div>
      )}
    </div>
  )
}

function CarouselButton({
  direction,
  disabled,
  onClick,
}: {
  direction: "prev" | "next"
  disabled: boolean
  onClick: () => void
}) {
  const isPrev = direction === "prev"
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={isPrev ? "Previous act" : "Next act"}
      className={cn(
        "absolute top-1/2 -translate-y-1/2 z-10 size-8 rounded-full bg-white/95 backdrop-blur shadow-md ring-1 ring-foreground/10",
        "flex items-center justify-center transition",
        "disabled:opacity-30 disabled:cursor-not-allowed",
        "hover:bg-white",
        isPrev ? "-left-2" : "-right-2",
      )}
    >
      {isPrev ? (
        <ChevronLeftIcon className="size-4" />
      ) : (
        <ChevronRightIcon className="size-4" />
      )}
    </button>
  )
}

function ActCard({
  sub,
  judgments,
  bookedElsewhere,
  onAdd,
}: {
  sub: ActSubmission
  judgments: ActJudgment[]
  bookedElsewhere?: BookedElsewhereInfo
  onAdd: () => void
}) {
  const typeLabel = canonicalActType(pickStr(sub.data, "GroupAct Type")).label
  const location = pickStr(sub.data, "Location")
  const contact = pickStr(sub.data, "Primary Contact 11")
  const blurb = pickBlurb(sub)
  const embed = pickFirstEmbedUrl(sub)
  const isBooked = !!bookedElsewhere

  return (
    <div
      className={cn(
        "snap-start shrink-0 w-[320px] rounded-xl border bg-card flex flex-col overflow-hidden",
        isBooked && "opacity-60",
      )}
    >
      {embed ? (
        <div className="aspect-video bg-muted">
          <iframe
            src={embed.src}
            title={sub.name ?? "Act preview"}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            className="size-full"
            loading="lazy"
          />
        </div>
      ) : (
        <div className="aspect-video bg-gradient-to-br from-blue-50 to-slate-100 flex items-center justify-center text-xs text-muted-foreground">
          No video preview
        </div>
      )}
      <div className="p-3 flex-1 flex flex-col gap-2 min-h-0">
        <div className="min-w-0">
          <div className="font-medium truncate">{sub.name ?? "Untitled"}</div>
          <div className="flex flex-wrap gap-1 mt-1">
            <Badge variant="secondary" className="font-normal">
              {typeLabel}
            </Badge>
            {location && (
              <Badge variant="outline" className="font-normal">
                {location}
              </Badge>
            )}
            {isBooked && (
              <Badge
                variant="outline"
                className="font-normal border-rose-300 bg-rose-50 text-rose-900"
              >
                Already booked
              </Badge>
            )}
          </div>
        </div>
        {isBooked && bookedElsewhere && (
          <a
            href={`/production/programming/${bookedElsewhere.blockId}`}
            className="text-[11px] text-rose-700 hover:underline underline-offset-4"
          >
            In{" "}
            <span className="font-medium">
              {bookedElsewhere.blockTitle ?? "another block"}
            </span>{" "}
            · {formatBookedSlot(bookedElsewhere.day, bookedElsewhere.start_time)}
          </a>
        )}
        <VerdictRow judgments={judgments} />
        <VideoLinkEditor
          submissionId={sub.id}
          supplementalUrl={sub.supplemental_video_url}
          hasAutoDetectedVideo={!!embed && !sub.supplemental_video_url}
        />
        {blurb && (
          <p className="text-xs text-muted-foreground line-clamp-4">{blurb}</p>
        )}
        <div className="mt-auto pt-2 flex items-center justify-between gap-2 border-t">
          <span className="text-[11px] text-muted-foreground truncate">
            {contact ?? sub.email ?? ""}
          </span>
          <Button
            type="button"
            size="sm"
            onClick={onAdd}
            disabled={isBooked}
            title={isBooked ? "Already booked elsewhere this festival" : ""}
            className="h-7 gap-1"
          >
            <PlusIcon className="size-3.5" />
            {isBooked ? "Booked" : "Add"}
          </Button>
        </div>
      </div>
    </div>
  )
}

function formatBookedSlot(day: string, startTime: string): string {
  const [hh, mm] = startTime.split(":").map(Number)
  const period = hh < 12 ? "am" : "pm"
  const hh12 = hh === 0 ? 12 : hh > 12 ? hh - 12 : hh
  const time =
    mm === 0 ? `${hh12}${period}` : `${hh12}:${String(mm).padStart(2, "0")}${period}`
  // Day is 'YYYY-MM-DD'; render as compact 'Fri 7/10' style.
  try {
    const d = new Date(`${day}T00:00:00`)
    const dayName = d.toLocaleDateString(undefined, { weekday: "short" })
    return `${dayName} ${time}`
  } catch {
    return time
  }
}

const VERDICT_STYLE: Record<
  "yes" | "no" | "maybe",
  { label: string; cls: string }
> = {
  yes: {
    label: "Yes",
    cls: "bg-emerald-100 text-emerald-900 ring-emerald-300",
  },
  maybe: {
    label: "Could be convinced",
    cls: "bg-amber-100 text-amber-900 ring-amber-300",
  },
  no: { label: "No", cls: "bg-rose-100 text-rose-900 ring-rose-300" },
}

function VerdictRow({ judgments }: { judgments: ActJudgment[] }) {
  const present = judgments.filter((j) => j.verdict)
  if (present.length === 0) {
    return (
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
        No verdicts yet
      </div>
    )
  }
  return (
    <div className="flex flex-wrap items-center gap-1">
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground mr-1">
        Verdicts
      </span>
      {present.map((j) => (
        <VerdictPill key={j.user_id} judgment={j} />
      ))}
    </div>
  )
}

function VerdictPill({ judgment }: { judgment: ActJudgment }) {
  const [open, setOpen] = useState(false)
  const v = judgment.verdict
  if (!v) return null
  const style = VERDICT_STYLE[v]
  const who = judgment.author_name ?? judgment.author_email ?? "Teammate"
  const initials = (who || "?")
    .split(/\s+/)
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase()
  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      <button
        type="button"
        tabIndex={0}
        aria-label={`${who}: ${style.label}${
          judgment.notes ? ` — ${judgment.notes}` : ""
        }`}
        className={cn(
          "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ring-1",
          style.cls,
        )}
      >
        <span>{initials || "·"}</span>
        <span className="font-normal">{style.label}</span>
      </button>
      {open && (
        <div className="absolute z-30 left-0 top-full mt-1 w-64 rounded-md bg-white text-foreground shadow-lg ring-1 ring-foreground/10 p-2 text-xs">
          <div className="font-medium">{who}</div>
          <div className={cn("inline-block mt-0.5 text-[11px]")}>
            <span
              className={cn(
                "inline-block rounded-full px-1.5 py-0.5 ring-1",
                style.cls,
              )}
            >
              {style.label}
            </span>
          </div>
          <div className="mt-1.5 whitespace-pre-wrap text-muted-foreground">
            {judgment.notes?.trim() || "No notes."}
          </div>
        </div>
      )}
    </span>
  )
}

function FacetMultiSelect({
  label,
  allLabel,
  options,
  selected,
  onChange,
}: {
  label: string
  allLabel: string
  options: { key: string; label: string; count: number }[]
  selected: string[]
  onChange: (next: string[]) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

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

  const summary =
    selected.length === 0
      ? allLabel
      : selected.length === 1
        ? (options.find((o) => o.key === selected[0])?.label ?? selected[0])
        : `${label}: ${selected.length}`

  function toggle(k: string) {
    onChange(
      selected.includes(k) ? selected.filter((x) => x !== k) : [...selected, k],
    )
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "h-8 rounded-full bg-white/80 border border-slate-200 text-sm font-medium px-3 inline-flex items-center gap-1.5 hover:bg-white transition",
          selected.length > 0 && "border-blue-300 bg-blue-50/60",
        )}
      >
        <span className="truncate max-w-[180px]">{summary}</span>
        {selected.length > 0 && (
          <span
            role="button"
            aria-label={`Clear ${label}`}
            onClick={(e) => {
              e.stopPropagation()
              onChange([])
            }}
            className="size-4 rounded-full hover:bg-blue-100 inline-flex items-center justify-center"
          >
            <XIcon className="size-3" />
          </span>
        )}
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 z-50 w-64 max-h-72 overflow-y-auto rounded-lg bg-popover text-popover-foreground shadow-md ring-1 ring-foreground/10 p-1">
          {options.length === 0 ? (
            <div className="px-3 py-2 text-xs text-muted-foreground">
              Nothing to filter on.
            </div>
          ) : (
            options.map((o) => {
              const checked = selected.includes(o.key)
              return (
                <button
                  type="button"
                  key={o.key}
                  onClick={() => toggle(o.key)}
                  className={cn(
                    "w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-md text-sm transition text-left",
                    checked
                      ? "bg-blue-50 text-blue-950"
                      : "hover:bg-accent hover:text-accent-foreground",
                  )}
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <span
                      className={cn(
                        "size-3.5 rounded-sm border inline-flex items-center justify-center shrink-0",
                        checked
                          ? "bg-blue-600 border-blue-600 text-white"
                          : "border-slate-300",
                      )}
                    >
                      {checked && (
                        <svg
                          viewBox="0 0 16 16"
                          fill="none"
                          className="size-3"
                          aria-hidden
                        >
                          <path
                            d="M3 8l3.5 3.5L13 4.5"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      )}
                    </span>
                    <span className="truncate">{o.label}</span>
                  </span>
                  <span className="text-xs text-muted-foreground tabular-nums shrink-0">
                    {o.count}
                  </span>
                </button>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
