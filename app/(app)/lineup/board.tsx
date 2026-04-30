"use client"

import {
  type ChangeEvent,
  type DragEvent,
  type FocusEvent,
  type FormEvent,
  type KeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react"
import {
  ArrowDownUp,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Plus,
  Search,
  Tag as TagIcon,
  Trash2,
  X,
} from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { InlineVerdict, type Verdict } from "@/components/inline-verdict"
import {
  createColumn,
  deleteColumn,
  moveCard,
  renameColumn,
  reorderColumns,
  setCardSetLength,
  setCardTags,
} from "./actions"

export type BoardColumn = {
  id: string
  title: string
  position: number
}


export type Tier = "locked" | "likely" | "maybe" | "bubble"

export type BoardCard = {
  id: string
  submissionId: string
  columnId: string | null
  position: number
  name: string
  nameWasSubstituted: boolean
  originalName: string | null
  typeLabel: string
  submitter: string | null
  members: string[]
  isSolo: boolean
  setLengthMinutes: number | null
  tags: string[]
  tier: Tier | null
  counts: { yes_count: number; no_count: number; maybe_count: number }
  myVerdict: Verdict | null
}

const UNSORTED_ID = "__unsorted__"

const TIER_DOT: Record<Tier, string> = {
  locked: "bg-emerald-500",
  likely: "bg-sky-500",
  maybe: "bg-slate-400",
  bubble: "bg-amber-500",
}

const TIER_LABEL: Record<Tier, string> = {
  locked: "Team yes",
  likely: "Likely",
  maybe: "Maybe",
  bubble: "Bubble",
}

// A few warm sticky-note tones, deterministically assigned by card id so the
// same act always looks the same. Solid backgrounds keep the text readable
// against the page's airy gradient.
const STICKY_TONES = [
  "bg-amber-100 border-amber-200",
  "bg-yellow-100 border-yellow-200",
  "bg-rose-100 border-rose-200",
  "bg-sky-100 border-sky-200",
  "bg-emerald-100 border-emerald-200",
  "bg-violet-100 border-violet-200",
] as const

type SortKey = "manual" | "name" | "type" | "length_desc" | "tier" | "tags"

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "manual", label: "Manual (drag)" },
  { key: "name", label: "Name (A → Z)" },
  { key: "type", label: "Type (A → Z)" },
  { key: "length_desc", label: "Set length (long → short)" },
  { key: "tier", label: "Tier (locked → bubble)" },
  { key: "tags", label: "Tag count (most → least)" },
]

const TIER_RANK: Record<Tier | "none", number> = {
  locked: 0,
  likely: 1,
  maybe: 2,
  bubble: 3,
  none: 4,
}

function compareCards(a: BoardCard, b: BoardCard, key: SortKey): number {
  switch (key) {
    case "name":
      return a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
    case "type":
      return a.typeLabel.localeCompare(b.typeLabel, undefined, {
        sensitivity: "base",
      })
    case "length_desc": {
      const av = a.setLengthMinutes
      const bv = b.setLengthMinutes
      if (av === null && bv === null) return 0
      if (av === null) return 1
      if (bv === null) return -1
      return bv - av
    }
    case "tier":
      return TIER_RANK[a.tier ?? "none"] - TIER_RANK[b.tier ?? "none"]
    case "tags":
      return b.tags.length - a.tags.length
    case "manual":
    default:
      return a.position - b.position
  }
}

// Subsequence match — every char of `q` must appear in `target` in order
// (e.g. "stnd" matches "stand-up"). Lets the user type abbreviations or skip
// over typos without remembering the exact spelling.
function fuzzyMatch(target: string, q: string): boolean {
  if (!q) return true
  const t = target.toLowerCase()
  const query = q.toLowerCase()
  let qi = 0
  for (let i = 0; i < t.length && qi < query.length; i++) {
    if (t[i] === query[qi]) qi++
  }
  return qi === query.length
}

function matchesSearch(card: BoardCard, query: string): boolean {
  const q = query.trim()
  if (!q) return true
  // Each whitespace-separated token must match any field. So "musical s"
  // would match "Musical Sketch" via name, but also "Musical Improv" tagged
  // "showcase" via type+tag combined.
  const tokens = q.toLowerCase().split(/\s+/).filter(Boolean)
  if (tokens.length === 0) return true
  const haystacks = [
    card.name,
    card.typeLabel,
    card.submitter ?? "",
    ...(card.members ?? []),
    ...card.tags,
  ]
  return tokens.every((tok) => haystacks.some((h) => fuzzyMatch(h, tok)))
}

function toneFor(id: string): string {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return STICKY_TONES[h % STICKY_TONES.length]
}

export function LineupBoard({
  columns: initialColumns,
  cards: initialCards,
}: {
  columns: BoardColumn[]
  cards: BoardCard[]
}) {
  const [columns, setColumns] = useState(initialColumns)
  const [cards, setCards] = useState(initialCards)
  const [lastInitialColumns, setLastInitialColumns] = useState(initialColumns)
  const [lastInitialCards, setLastInitialCards] = useState(initialCards)
  const [sortKey, setSortKey] = useState<SortKey>("manual")
  const [search, setSearch] = useState("")
  const [, startTransition] = useTransition()

  // Snap local state to fresh server data when revalidation lands. Done at
  // render time (per project's set-state-in-effect rule) using identity
  // tracking so it only fires on actual prop changes.
  if (lastInitialColumns !== initialColumns) {
    setLastInitialColumns(initialColumns)
    setColumns(initialColumns)
  }
  if (lastInitialCards !== initialCards) {
    setLastInitialCards(initialCards)
    setCards(initialCards)
  }

  // Manual ordering — used for drag-and-drop math regardless of how the user
  // is currently sorting. We always send the manual order to the server when
  // moving cards around.
  const cardsByColumnManual = useMemo(() => {
    const map = new Map<string, BoardCard[]>()
    map.set(UNSORTED_ID, [])
    for (const col of columns) map.set(col.id, [])
    for (const c of cards) {
      const key = c.columnId ?? UNSORTED_ID
      const list = map.get(key) ?? []
      list.push(c)
      map.set(key, list)
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.position - b.position)
    }
    return map
  }, [cards, columns])

  // Visible ordering — manual order, optionally re-sorted by metadata, then
  // filtered by search. Empty search shows everything.
  const cardsByColumnVisible = useMemo(() => {
    const map = new Map<string, BoardCard[]>()
    for (const [key, list] of cardsByColumnManual) {
      let filtered = list.filter((c) => matchesSearch(c, search))
      if (sortKey !== "manual") {
        filtered = [...filtered].sort((a, b) => compareCards(a, b, sortKey))
      }
      map.set(key, filtered)
    }
    return map
  }, [cardsByColumnManual, sortKey, search])

  const filteredCount = useMemo(() => {
    let n = 0
    for (const list of cardsByColumnVisible.values()) n += list.length
    return n
  }, [cardsByColumnVisible])

  /* ---------------- card moves ---------------- */

  function handleCardDrop(opts: {
    cardId: string
    destColumnId: string | null
    overCardId: string | null
  }) {
    const { cardId, destColumnId, overCardId } = opts
    const moving = cards.find((c) => c.id === cardId)
    if (!moving) return
    const sourceColumnId = moving.columnId
    if (
      sourceColumnId === destColumnId &&
      overCardId === cardId
    ) {
      return // no-op self-drop
    }

    const destKey = destColumnId ?? UNSORTED_ID
    const sourceKey = sourceColumnId ?? UNSORTED_ID

    // Build new ordering for source and destination columns. Always use the
    // manual order as the source of truth — visible sort/search is presentation.
    const sourceList = (cardsByColumnManual.get(sourceKey) ?? []).filter(
      (c) => c.id !== cardId,
    )
    const destBase =
      destKey === sourceKey
        ? sourceList
        : (cardsByColumnManual.get(destKey) ?? []).slice()

    let insertIdx = destBase.length
    if (overCardId && overCardId !== cardId) {
      const i = destBase.findIndex((c) => c.id === overCardId)
      if (i >= 0) insertIdx = i
    }
    const destList = [
      ...destBase.slice(0, insertIdx),
      { ...moving, columnId: destColumnId },
      ...destBase.slice(insertIdx),
    ]

    // Optimistic state.
    const nextCards = cards.map((c) => {
      const inDest = destList.findIndex((d) => d.id === c.id)
      if (inDest >= 0) {
        return { ...c, columnId: destColumnId, position: inDest }
      }
      if (sourceKey !== destKey) {
        const inSource = sourceList.findIndex((s) => s.id === c.id)
        if (inSource >= 0) return { ...c, position: inSource }
      }
      return c
    })
    setCards(nextCards)

    startTransition(async () => {
      const res = await moveCard({
        cardId,
        columnId: destColumnId,
        destOrder: destList.map((c) => c.id),
        sourceColumnId: sourceColumnId,
        sourceOrder:
          sourceKey === destKey ? undefined : sourceList.map((c) => c.id),
      })
      if (!res.ok) {
        toast.error(res.error)
        setCards(cards) // revert
      }
    })
  }

  /* ---------------- column ops ---------------- */

  function handleAddColumn(title: string) {
    const cleaned = title.trim()
    if (!cleaned) return
    startTransition(async () => {
      const res = await createColumn(cleaned)
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      // Optimistic: append a temp row; the revalidation will replace it.
      setColumns((prev) => [
        ...prev,
        { id: res.data.id, title: cleaned, position: prev.length },
      ])
    })
  }

  function handleRenameColumn(id: string, title: string) {
    const cleaned = title.trim()
    const prev = columns
    setColumns((cs) => cs.map((c) => (c.id === id ? { ...c, title: cleaned } : c)))
    startTransition(async () => {
      const res = await renameColumn(id, cleaned)
      if (!res.ok) {
        toast.error(res.error)
        setColumns(prev)
      }
    })
  }

  function handleDeleteColumn(id: string) {
    const col = columns.find((c) => c.id === id)
    if (!col) return
    const movedCards = cards.filter((c) => c.columnId === id).length
    const message = movedCards
      ? `Delete "${col.title}"? ${movedCards} ${movedCards === 1 ? "card goes" : "cards go"} back to Unsorted.`
      : `Delete "${col.title}"?`
    if (!window.confirm(message)) return

    const prevCols = columns
    const prevCards = cards
    setColumns((cs) => cs.filter((c) => c.id !== id))
    setCards((cs) =>
      cs.map((c) => (c.columnId === id ? { ...c, columnId: null } : c)),
    )
    startTransition(async () => {
      const res = await deleteColumn(id)
      if (!res.ok) {
        toast.error(res.error)
        setColumns(prevCols)
        setCards(prevCards)
      }
    })
  }

  function handleMoveColumn(id: string, dir: -1 | 1) {
    const idx = columns.findIndex((c) => c.id === id)
    if (idx < 0) return
    const target = idx + dir
    if (target < 0 || target >= columns.length) return
    const next = [...columns]
    const [moved] = next.splice(idx, 1)
    next.splice(target, 0, moved)
    const renumbered = next.map((c, i) => ({ ...c, position: i }))
    const prev = columns
    setColumns(renumbered)
    startTransition(async () => {
      const res = await reorderColumns(renumbered.map((c) => c.id))
      if (!res.ok) {
        toast.error(res.error)
        setColumns(prev)
      }
    })
  }

  /* ---------------- card field edits ---------------- */

  function handleSetLength(cardId: string, value: number | null) {
    const prev = cards
    setCards((cs) =>
      cs.map((c) =>
        c.id === cardId ? { ...c, setLengthMinutes: value } : c,
      ),
    )
    startTransition(async () => {
      const res = await setCardSetLength(cardId, value)
      if (!res.ok) {
        toast.error(res.error)
        setCards(prev)
      }
    })
  }

  function handleSetTags(cardId: string, tags: string[]) {
    const prev = cards
    const cleaned = Array.from(
      new Set(
        tags
          .map((t) => t.trim().toLowerCase())
          .filter((t) => t.length > 0 && t.length <= 32),
      ),
    )
    setCards((cs) =>
      cs.map((c) => (c.id === cardId ? { ...c, tags: cleaned } : c)),
    )
    startTransition(async () => {
      const res = await setCardTags(cardId, cleaned)
      if (!res.ok) {
        toast.error(res.error)
        setCards(prev)
      }
    })
  }

  /* ---------------- render ---------------- */

  const allColumns: { id: string; title: string; isUnsorted: boolean }[] = [
    { id: UNSORTED_ID, title: "Unsorted", isUnsorted: true },
    ...columns.map((c) => ({ id: c.id, title: c.title, isUnsorted: false })),
  ]

  const totalCards = cards.length

  const sortLabel =
    SORT_OPTIONS.find((o) => o.key === sortKey)?.label ?? "Manual (drag)"

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, type, or tag…"
            className="w-full rounded-full border border-slate-200/80 bg-white/80 backdrop-blur pl-9 pr-9 py-1.5 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#2340d9]/40"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              aria-label="Clear search"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
        <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-600">
          <ArrowDownUp className="h-3.5 w-3.5 text-slate-500" />
          <span className="hidden sm:inline">Sort</span>
          <select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
            className="rounded-full border border-slate-200/80 bg-white/80 backdrop-blur px-3 py-1.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#2340d9]/40"
            aria-label={`Sort cards: ${sortLabel}`}
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.key} value={o.key}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <div className="ml-auto flex items-center gap-3 text-xs text-slate-600 tabular-nums">
          {search ? (
            <span>
              <span className="font-semibold text-slate-900">
                {filteredCount}
              </span>
              <span className="text-slate-500">/{totalCards}</span> matched
            </span>
          ) : (
            <span>
              <span className="font-semibold text-slate-900">{totalCards}</span>{" "}
              {totalCards === 1 ? "act" : "acts"}
            </span>
          )}
          <span className="text-slate-300">·</span>
          <span>
            <span className="font-semibold text-slate-900">
              {columns.length}
            </span>{" "}
            {columns.length === 1 ? "column" : "columns"}
          </span>
        </div>
      </div>

      {sortKey !== "manual" && (
        <div className="text-[11px] text-slate-500 italic">
          Sorted by {sortLabel.toLowerCase()} — switch to Manual to use drag
          ordering.
        </div>
      )}

      <div className="-mx-4 px-4 overflow-x-auto pb-4">
        <div className="flex items-start gap-3 min-h-[60vh]">
          {allColumns.map((col, idx) => {
            const colCards =
              cardsByColumnVisible.get(col.isUnsorted ? UNSORTED_ID : col.id) ??
              []
            return (
              <Column
                key={col.id}
                id={col.isUnsorted ? null : col.id}
                title={col.title}
                isUnsorted={col.isUnsorted}
                canMoveLeft={!col.isUnsorted && idx > 1}
                canMoveRight={!col.isUnsorted && idx < allColumns.length - 1}
                cards={colCards}
                draggableCards={sortKey === "manual"}
                onCardDrop={handleCardDrop}
                onRename={(t) =>
                  !col.isUnsorted && handleRenameColumn(col.id, t)
                }
                onDelete={() =>
                  !col.isUnsorted && handleDeleteColumn(col.id)
                }
                onMove={(dir) =>
                  !col.isUnsorted && handleMoveColumn(col.id, dir)
                }
                onSetLength={handleSetLength}
                onSetTags={handleSetTags}
              />
            )
          })}
          <AddColumn onAdd={handleAddColumn} />
        </div>
      </div>
    </div>
  )
}

/* ============================================================== Column */

function Column({
  id,
  title,
  isUnsorted,
  canMoveLeft,
  canMoveRight,
  cards,
  draggableCards,
  onCardDrop,
  onRename,
  onDelete,
  onMove,
  onSetLength,
  onSetTags,
}: {
  id: string | null
  title: string
  isUnsorted: boolean
  canMoveLeft: boolean
  canMoveRight: boolean
  cards: BoardCard[]
  draggableCards: boolean
  onCardDrop: (opts: {
    cardId: string
    destColumnId: string | null
    overCardId: string | null
  }) => void
  onRename: (title: string) => void
  onDelete: () => void
  onMove: (dir: -1 | 1) => void
  onSetLength: (cardId: string, value: number | null) => void
  onSetTags: (cardId: string, tags: string[]) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draftTitle, setDraftTitle] = useState(title)
  const [lastTitle, setLastTitle] = useState(title)
  const [hovered, setHovered] = useState(false)

  // When the parent renames a column from elsewhere (e.g. another teammate),
  // pick up the new title — but only when we're not actively editing.
  if (!editing && lastTitle !== title) {
    setLastTitle(title)
    setDraftTitle(title)
  }

  function commit() {
    setEditing(false)
    if (draftTitle.trim() && draftTitle.trim() !== title) {
      onRename(draftTitle)
    } else {
      setDraftTitle(title)
    }
  }

  function onDragOverColumn(e: DragEvent<HTMLDivElement>) {
    if (e.dataTransfer.types.includes("application/x-lineup-card")) {
      e.preventDefault()
      e.dataTransfer.dropEffect = "move"
      setHovered(true)
    }
  }

  function onDropColumn(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setHovered(false)
    const cardId = e.dataTransfer.getData("application/x-lineup-card")
    if (!cardId) return
    onCardDrop({ cardId, destColumnId: id, overCardId: null })
  }

  return (
    <div
      className={cn(
        "shrink-0 w-72 rounded-2xl border bg-white/65 backdrop-blur-xl shadow-[0_8px_28px_-18px_rgba(30,58,138,0.18)] flex flex-col max-h-[calc(100vh-220px)]",
        isUnsorted ? "border-slate-200/80 bg-slate-50/65" : "border-white/70",
        hovered && "ring-2 ring-[#2340d9]/40",
      )}
    >
      <div className="flex items-center gap-1.5 px-3 pt-3 pb-2">
        {isUnsorted ? (
          <div className="text-[11px] uppercase tracking-[0.22em] font-semibold text-slate-500">
            Unsorted
          </div>
        ) : editing ? (
          <input
            autoFocus
            value={draftTitle}
            onChange={(e) => setDraftTitle(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") commit()
              else if (e.key === "Escape") {
                setEditing(false)
                setDraftTitle(title)
              }
            }}
            className="flex-1 min-w-0 text-sm font-semibold bg-white/90 border border-slate-300/80 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-[#2340d9]/40"
          />
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="flex-1 min-w-0 text-left text-sm font-semibold text-slate-900 hover:text-[#2340d9] truncate"
            title="Rename column"
          >
            {title}
          </button>
        )}
        <span className="text-[10px] tabular-nums text-slate-500 px-1.5 py-0.5 rounded-full bg-slate-100">
          {cards.length}
        </span>
        {!isUnsorted && (
          <div className="flex items-center -mr-1">
            <button
              type="button"
              onClick={() => onMove(-1)}
              disabled={!canMoveLeft}
              className="p-1 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent"
              title="Move left"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onMove(1)}
              disabled={!canMoveRight}
              className="p-1 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent"
              title="Move right"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="p-1 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100"
              title="Rename"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={onDelete}
              className="p-1 rounded-md text-slate-500 hover:text-rose-600 hover:bg-rose-50"
              title="Delete column"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>

      <div
        onDragOver={onDragOverColumn}
        onDragLeave={() => setHovered(false)}
        onDrop={onDropColumn}
        className="flex-1 overflow-y-auto px-3 pb-3 space-y-2"
      >
        {cards.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300/70 px-3 py-6 text-center text-xs text-slate-500">
            Drag a sticky here.
          </div>
        ) : (
          cards.map((card) => (
            <StickyCard
              key={card.id}
              card={card}
              destColumnId={id}
              draggable={draggableCards}
              onCardDrop={onCardDrop}
              onSetLength={onSetLength}
              onSetTags={onSetTags}
            />
          ))
        )}
      </div>
    </div>
  )
}

/* ============================================================== Card */

function StickyCard({
  card,
  destColumnId,
  draggable,
  onCardDrop,
  onSetLength,
  onSetTags,
}: {
  card: BoardCard
  destColumnId: string | null
  draggable: boolean
  onCardDrop: (opts: {
    cardId: string
    destColumnId: string | null
    overCardId: string | null
  }) => void
  onSetLength: (cardId: string, value: number | null) => void
  onSetTags: (cardId: string, tags: string[]) => void
}) {
  const [dragging, setDragging] = useState(false)
  const [overTop, setOverTop] = useState(false)
  const tone = useMemo(() => toneFor(card.id), [card.id])

  function onDragStart(e: DragEvent<HTMLDivElement>) {
    if (!draggable) return
    e.dataTransfer.setData("application/x-lineup-card", card.id)
    e.dataTransfer.effectAllowed = "move"
    setDragging(true)
  }

  function onDragOverCard(e: DragEvent<HTMLDivElement>) {
    if (!draggable) return
    if (!e.dataTransfer.types.includes("application/x-lineup-card")) return
    e.preventDefault()
    e.stopPropagation()
    e.dataTransfer.dropEffect = "move"
    setOverTop(true)
  }

  function onDropCard(e: DragEvent<HTMLDivElement>) {
    if (!draggable) return
    e.preventDefault()
    e.stopPropagation()
    setOverTop(false)
    const cardId = e.dataTransfer.getData("application/x-lineup-card")
    if (!cardId) return
    onCardDrop({ cardId, destColumnId, overCardId: card.id })
  }

  return (
    <div
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={() => setDragging(false)}
      onDragOver={onDragOverCard}
      onDragLeave={() => setOverTop(false)}
      onDrop={onDropCard}
      className={cn(
        "relative rounded-xl border p-3 transition shadow-[0_2px_8px_-4px_rgba(30,58,138,0.18)] hover:shadow-[0_6px_18px_-8px_rgba(30,58,138,0.25)] -rotate-[0.4deg] hover:rotate-0",
        draggable
          ? "cursor-grab active:cursor-grabbing"
          : "cursor-default",
        tone,
        dragging && "opacity-40",
        overTop && "ring-2 ring-[#2340d9]/50",
      )}
    >
      {/* Tier dot */}
      {card.tier && (
        <span
          className={cn(
            "absolute top-2 right-2 inline-flex items-center gap-1 rounded-full bg-white/70 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-slate-700",
          )}
          title={`${TIER_LABEL[card.tier]} · ${card.counts.yes_count}Y ${card.counts.maybe_count}M ${card.counts.no_count}N`}
        >
          <span className={cn("h-1.5 w-1.5 rounded-full", TIER_DOT[card.tier])} />
          {TIER_LABEL[card.tier]}
        </span>
      )}

      <div
        className="font-semibold text-sm text-slate-900 leading-snug pr-16 break-words"
        title={
          card.nameWasSubstituted && card.originalName
            ? `Group name was "${card.originalName}"`
            : undefined
        }
      >
        {card.name}
      </div>

      <div className="text-[11px] text-slate-700 mt-0.5">
        {card.typeLabel}
      </div>

      {card.isSolo && card.submitter && (
        <div className="mt-1.5">
          <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 text-violet-900 border border-violet-100 px-1.5 py-0.5 text-[10px] font-semibold">
            Solo · {card.submitter}
          </span>
        </div>
      )}

      {!card.isSolo && card.submitter && (
        <div className="text-[11px] text-slate-700 mt-1.5 truncate">
          <span className="text-slate-500">Submitted by</span>{" "}
          <span className="font-medium">{card.submitter}</span>
        </div>
      )}

      {(card.members?.length ?? 0) > 0 && (
        <div className="text-[11px] text-slate-700 mt-0.5">
          <span className="text-slate-500">Members</span>{" "}
          <span>{card.members.join(", ")}</span>
        </div>
      )}

      <div className="mt-2 flex items-center gap-2 text-xs">
        <label className="text-[11px] text-slate-600">Set</label>
        <SetLengthInput
          value={card.setLengthMinutes}
          onCommit={(v) => onSetLength(card.id, v)}
        />
        <span className="text-[11px] text-slate-500">min</span>
      </div>

      <TagEditor
        tags={card.tags}
        onCommit={(tags) => onSetTags(card.id, tags)}
      />

      <div className="mt-2 pt-2 border-t border-white/60 flex items-center justify-between gap-2">
        <span className="text-[10px] uppercase tracking-[0.18em] font-semibold text-slate-500">
          My vote
        </span>
        <InlineVerdict
          submissionId={card.submissionId}
          initialVerdict={card.myVerdict}
          size="sm"
        />
      </div>
    </div>
  )
}

/* ============================================================== Set length */

function SetLengthInput({
  value,
  onCommit,
}: {
  value: number | null
  onCommit: (v: number | null) => void
}) {
  const [draft, setDraft] = useState(value === null ? "" : String(value))
  const [lastValue, setLastValue] = useState(value)

  // Sync external value into the draft on prop change (render-time pattern
  // to avoid set-state-in-effect lint rule).
  if (lastValue !== value) {
    setLastValue(value)
    setDraft(value === null ? "" : String(value))
  }

  function commit(e: FocusEvent<HTMLInputElement> | KeyboardEvent<HTMLInputElement>) {
    const raw = (e.currentTarget.value ?? "").trim()
    if (raw === "") {
      if (value !== null) onCommit(null)
      return
    }
    const n = Number(raw)
    if (!Number.isFinite(n) || n < 0) {
      setDraft(value === null ? "" : String(value))
      return
    }
    if (n !== value) onCommit(Math.round(n))
  }

  return (
    <input
      type="number"
      inputMode="numeric"
      min={0}
      max={999}
      step={1}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          commit(e)
          ;(e.currentTarget as HTMLInputElement).blur()
        } else if (e.key === "Escape") {
          setDraft(value === null ? "" : String(value))
          ;(e.currentTarget as HTMLInputElement).blur()
        }
      }}
      onPointerDown={(e) => e.stopPropagation()}
      className="w-12 rounded-md border border-white/70 bg-white/80 px-1.5 py-0.5 text-xs tabular-nums text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#2340d9]/40"
      placeholder="—"
    />
  )
}

/* ============================================================== Tag editor */

function TagEditor({
  tags,
  onCommit,
}: {
  tags: string[]
  onCommit: (tags: string[]) => void
}) {
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (adding) inputRef.current?.focus()
  }, [adding])

  function submit(e?: FormEvent) {
    e?.preventDefault()
    const cleaned = draft.trim().toLowerCase()
    if (!cleaned) {
      setAdding(false)
      setDraft("")
      return
    }
    if (!tags.includes(cleaned)) {
      onCommit([...tags, cleaned])
    }
    setDraft("")
    setAdding(false)
  }

  function removeTag(tag: string) {
    onCommit(tags.filter((t) => t !== tag))
  }

  return (
    <div className="mt-2 flex flex-wrap items-center gap-1">
      {tags.map((tag) => (
        <span
          key={tag}
          className="inline-flex items-center gap-1 rounded-full bg-white/80 border border-white/90 px-2 py-0.5 text-[10px] font-medium text-slate-700"
        >
          <TagIcon className="h-2.5 w-2.5 text-slate-500" />
          {tag}
          <button
            type="button"
            onClick={() => removeTag(tag)}
            onPointerDown={(e) => e.stopPropagation()}
            className="text-slate-400 hover:text-rose-600 -mr-0.5"
            aria-label={`Remove tag ${tag}`}
          >
            <X className="h-2.5 w-2.5" />
          </button>
        </span>
      ))}
      {adding ? (
        <form onSubmit={submit} className="inline-flex">
          <input
            ref={inputRef}
            value={draft}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setDraft(e.target.value)}
            onBlur={() => submit()}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setAdding(false)
                setDraft("")
              }
            }}
            onPointerDown={(e) => e.stopPropagation()}
            placeholder="tag"
            maxLength={32}
            className="w-20 rounded-full border border-white/90 bg-white/90 px-2 py-0.5 text-[10px] text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#2340d9]/40"
          />
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          onPointerDown={(e) => e.stopPropagation()}
          className="inline-flex items-center gap-0.5 rounded-full border border-dashed border-slate-400/60 px-1.5 py-0.5 text-[10px] text-slate-500 hover:text-slate-800 hover:border-slate-500"
        >
          <Plus className="h-2.5 w-2.5" />
          tag
        </button>
      )}
    </div>
  )
}

/* ============================================================== Add column */

function AddColumn({ onAdd }: { onAdd: (title: string) => void }) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  function submit(e?: FormEvent) {
    e?.preventDefault()
    const cleaned = draft.trim()
    if (cleaned) onAdd(cleaned)
    setDraft("")
    setOpen(false)
  }

  return (
    <div className="shrink-0 w-72">
      {open ? (
        <form
          onSubmit={submit}
          className="rounded-2xl border border-white/70 bg-white/65 backdrop-blur-xl p-3 shadow-[0_8px_28px_-18px_rgba(30,58,138,0.18)]"
        >
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Column name (e.g. Friday Late Show)"
            maxLength={60}
            onBlur={() => submit()}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setOpen(false)
                setDraft("")
              }
            }}
            className="w-full text-sm font-semibold bg-white/90 border border-slate-300/80 rounded-md px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#2340d9]/40"
          />
          <p className="mt-1.5 text-[10px] text-slate-500">
            Enter to save · Esc to cancel
          </p>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="w-full rounded-2xl border-2 border-dashed border-slate-300/70 bg-white/30 backdrop-blur px-3 py-4 text-sm font-medium text-slate-600 hover:text-[#2340d9] hover:border-[#2340d9]/50 hover:bg-white/50 transition inline-flex items-center justify-center gap-1.5"
        >
          <Plus className="h-4 w-4" />
          Add column
        </button>
      )}
    </div>
  )
}
