"use client"

import { useRouter } from "next/navigation"
import { useMemo, useRef, useState, useTransition } from "react"
import { toast } from "sonner"
import { ClockIcon, GripVerticalIcon, XIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import {
  addActToBlock,
  removeActFromBlock,
  reorderBlockActs,
  setActDuration,
  updateBlockProgramming,
} from "../../actions"
import { BlockCommentsPanel, type BlockComment } from "../../block-comments"
import { ActCarousel } from "./act-carousel"
import {
  ActMarketingPanel,
  pickStr,
  type ActJudgment,
  type ActSubmission,
} from "./act-marketing"
import { BillingPreview } from "./billing-preview"

type Act = {
  submission: ActSubmission
  duration_minutes: number | null
}

type Props = {
  blockId: string
  initial: { title: string; theme: string; host: string }
  acts: Act[]
  candidates: ActSubmission[]
  judgmentsBySubmission: Record<string, ActJudgment[]>
  comments: BlockComment[]
  currentUserId: string
}

type HeaderField = "title" | "theme" | "host"

export function BlockProgrammingShell({
  blockId,
  initial,
  acts: initialActs,
  candidates,
  judgmentsBySubmission,
  comments,
  currentUserId,
}: Props) {
  const router = useRouter()
  const [, startTransition] = useTransition()

  const [header, setHeader] = useState(initial)
  const [savingField, setSavingField] = useState<HeaderField | null>(null)
  const [savedField, setSavedField] = useState<HeaderField | null>(null)
  const initialRef = useRef(initial)
  const debounceRefs = useRef<Record<HeaderField, ReturnType<typeof setTimeout> | null>>({
    title: null,
    theme: null,
    host: null,
  })

  function saveHeaderField(field: HeaderField, value: string) {
    setSavingField(field)
    startTransition(async () => {
      const result = await updateBlockProgramming(blockId, { [field]: value })
      setSavingField(null)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      initialRef.current = { ...initialRef.current, [field]: value }
      setSavedField(field)
      setTimeout(
        () => setSavedField((cur) => (cur === field ? null : cur)),
        1200,
      )
      router.refresh()
    })
  }

  function onHeaderChange(field: HeaderField, value: string) {
    setHeader((s) => ({ ...s, [field]: value }))
    const t = debounceRefs.current[field]
    if (t) clearTimeout(t)
    debounceRefs.current[field] = setTimeout(() => {
      if ((initialRef.current[field] ?? "") !== value) saveHeaderField(field, value)
    }, 600)
  }

  // Shell is keyed on blockId at the page level so navigating to another block
  // remounts and re-initializes from `initialActs`.
  const [acts, setActs] = useState<Act[]>(initialActs)

  const totalMinutes = useMemo(
    () => acts.reduce((acc, a) => acc + (a.duration_minutes ?? 0), 0),
    [acts],
  )

  function setDurationLocal(submissionId: string, value: number | null) {
    setActs((cur) =>
      cur.map((a) =>
        a.submission.id === submissionId ? { ...a, duration_minutes: value } : a,
      ),
    )
  }

  function persistDuration(submissionId: string, value: number | null) {
    startTransition(async () => {
      const result = await setActDuration(blockId, submissionId, value)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      router.refresh()
    })
  }

  function handleRemove(submissionId: string) {
    setActs((cur) => cur.filter((a) => a.submission.id !== submissionId))
    startTransition(async () => {
      const result = await removeActFromBlock(blockId, submissionId)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      router.refresh()
    })
  }

  function handleAdd(sub: ActSubmission | null) {
    if (!sub) return
    if (acts.some((a) => a.submission.id === sub.id)) return
    setActs((cur) => [...cur, { submission: sub, duration_minutes: null }])
    startTransition(async () => {
      const result = await addActToBlock(blockId, sub.id)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      router.refresh()
    })
  }

  function reorder(fromIdx: number, toIdx: number) {
    if (fromIdx === toIdx) return
    setActs((cur) => {
      const next = [...cur]
      const [moved] = next.splice(fromIdx, 1)
      next.splice(toIdx, 0, moved)
      const ids = next.map((a) => a.submission.id)
      startTransition(async () => {
        const result = await reorderBlockActs(blockId, ids)
        if (!result.ok) {
          toast.error(result.error)
          return
        }
        router.refresh()
      })
      return next
    })
  }

  const [dragIdx, setDragIdx] = useState<number | null>(null)
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null)

  return (
    <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
      <div className="space-y-6 min-w-0">
        <Card>
          <CardHeader>
            <CardTitle>Block details</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <FieldRow
              label="Name"
              field="title"
              value={header.title}
              placeholder="e.g. Friday Late Show"
              savingField={savingField}
              savedField={savedField}
              onChange={onHeaderChange}
            />
            <FieldRow
              label="Host"
              field="host"
              value={header.host}
              placeholder="MC name"
              savingField={savingField}
              savedField={savedField}
              onChange={onHeaderChange}
            />
            <div className="sm:col-span-2">
              <FieldRow
                label="Theme"
                field="theme"
                value={header.theme}
                placeholder="What ties the night together?"
                savingField={savingField}
                savedField={savedField}
                onChange={onHeaderChange}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Lineup</CardTitle>
            <CardAction>
              <span className="text-xs text-muted-foreground tabular-nums">
                {acts.length} {acts.length === 1 ? "act" : "acts"}
                {totalMinutes > 0 ? ` · ${totalMinutes} min programmed` : ""}
              </span>
            </CardAction>
          </CardHeader>
          <CardContent className="space-y-4">
            <ActCarousel
              candidates={candidates}
              excludedIds={
                new Set(acts.map((a) => a.submission.id))
              }
              judgmentsBySubmission={judgmentsBySubmission}
              onAdd={handleAdd}
            />
            {acts.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                Add acts above to start building this block.
              </p>
            ) : (
              <ol className="space-y-2">
                {acts.map((a, i) => (
                  <li
                    key={a.submission.id}
                    draggable
                    onDragStart={() => setDragIdx(i)}
                    onDragOver={(e) => {
                      e.preventDefault()
                      setDragOverIdx(i)
                    }}
                    onDragLeave={() => setDragOverIdx((cur) => (cur === i ? null : cur))}
                    onDrop={(e) => {
                      e.preventDefault()
                      if (dragIdx != null) reorder(dragIdx, i)
                      setDragIdx(null)
                      setDragOverIdx(null)
                    }}
                    onDragEnd={() => {
                      setDragIdx(null)
                      setDragOverIdx(null)
                    }}
                    className={cn(
                      "rounded-lg border bg-card transition",
                      dragIdx === i && "opacity-50",
                      dragOverIdx === i && dragIdx !== i && "border-blue-400",
                    )}
                  >
                    <ActRow
                      index={i}
                      act={a}
                      onDuration={(v) => {
                        setDurationLocal(a.submission.id, v)
                        persistDuration(a.submission.id, v)
                      }}
                      onRemove={() => handleRemove(a.submission.id)}
                    />
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Discussion</CardTitle>
            <CardAction>
              <span className="text-xs text-muted-foreground tabular-nums">
                {comments.length}{" "}
                {comments.length === 1 ? "comment" : "comments"}
              </span>
            </CardAction>
          </CardHeader>
          <CardContent>
            <BlockCommentsPanel
              blockId={blockId}
              comments={comments}
              currentUserId={currentUserId}
              canComment
            />
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6 lg:sticky lg:top-24 lg:self-start">
        <BillingPreview
          blockTitle={header.title}
          theme={header.theme}
          host={header.host}
          acts={acts}
        />
      </div>
    </div>
  )
}

function FieldRow({
  label,
  field,
  value,
  placeholder,
  savingField,
  savedField,
  onChange,
}: {
  label: string
  field: HeaderField
  value: string
  placeholder?: string
  savingField: HeaderField | null
  savedField: HeaderField | null
  onChange: (field: HeaderField, value: string) => void
}) {
  return (
    <div className="grid gap-1.5">
      <div className="flex items-center justify-between">
        <Label htmlFor={`block-${field}`}>{label}</Label>
        {savingField === field ? (
          <span className="text-[10px] text-muted-foreground">Saving…</span>
        ) : savedField === field ? (
          <span className="text-[10px] text-emerald-600">Saved</span>
        ) : null}
      </div>
      <Input
        id={`block-${field}`}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(field, e.target.value)}
      />
    </div>
  )
}

function ActRow({
  index,
  act,
  onDuration,
  onRemove,
}: {
  index: number
  act: Act
  onDuration: (value: number | null) => void
  onRemove: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [durStr, setDurStr] = useState<string>(
    act.duration_minutes == null ? "" : String(act.duration_minutes),
  )

  function commitDuration() {
    const trimmed = durStr.trim()
    if (trimmed === "") {
      if (act.duration_minutes != null) onDuration(null)
      return
    }
    const n = Number(trimmed)
    if (Number.isFinite(n) && n >= 0) {
      const rounded = Math.round(n)
      if (rounded !== act.duration_minutes) onDuration(rounded)
    } else {
      setDurStr(act.duration_minutes == null ? "" : String(act.duration_minutes))
    }
  }

  const meta = pickActMeta(act.submission)

  return (
    <div className="p-3">
      <div className="flex items-center gap-2">
        <span
          className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground"
          aria-label="Drag to reorder"
        >
          <GripVerticalIcon className="size-4" />
        </span>
        <span className="text-xs text-muted-foreground tabular-nums w-5">
          {index + 1}.
        </span>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex-1 text-left min-w-0"
        >
          <div className="font-medium truncate">{act.submission.name ?? "Untitled"}</div>
          {meta && (
            <div className="text-xs text-muted-foreground truncate">{meta}</div>
          )}
        </button>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <ClockIcon className="size-3" />
          <Input
            inputMode="numeric"
            pattern="[0-9]*"
            value={durStr}
            onChange={(e) => setDurStr(e.target.value.replace(/[^0-9]/g, ""))}
            onBlur={commitDuration}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.currentTarget.blur()
              }
            }}
            placeholder="min"
            className="h-7 w-14 text-xs text-right tabular-nums"
            aria-label="Duration in minutes"
          />
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onRemove}
          aria-label="Remove from block"
          className="size-7 text-muted-foreground hover:text-destructive"
        >
          <XIcon className="size-4" />
        </Button>
      </div>
      {expanded && (
        <div className="mt-3 pl-7">
          <ActMarketingPanel submission={act.submission} />
        </div>
      )}
    </div>
  )
}

function pickActMeta(s: ActSubmission): string | null {
  const city = pickStr(s.data, "Location")
  const kind = pickStr(s.data, "GroupAct Type")
  return [city, kind].filter(Boolean).join(" · ") || null
}
