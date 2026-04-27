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

type BlockKind = "show" | "workshop" | "event"

type Props = {
  blockId: string
  initial: { title: string; theme: string; host: string; kind: BlockKind }
  acts: Act[]
  candidates: ActSubmission[]
  judgmentsBySubmission: Record<string, ActJudgment[]>
  comments: BlockComment[]
  currentUserId: string
}

type HeaderField = "title" | "theme" | "host"

const KIND_OPTIONS: Array<{ key: BlockKind; label: string; hint: string }> = [
  { key: "show", label: "Show", hint: "Multi-act lineup with timing." },
  {
    key: "workshop",
    label: "Workshop",
    hint: "One class with cost, capacity, and tickets.",
  },
  {
    key: "event",
    label: "Event",
    hint: "Festival event powered by volunteers, no acts.",
  },
]

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
  const [kind, setKind] = useState<BlockKind>(initial.kind)
  const [savingField, setSavingField] = useState<HeaderField | null>(null)
  const [savedField, setSavedField] = useState<HeaderField | null>(null)
  const [kindPending, setKindPending] = useState(false)
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

  function changeKind(next: BlockKind) {
    if (next === kind) return
    if (
      (kind === "show" && acts.length > 1 && next === "workshop") ||
      (next === "event" && acts.length > 0)
    ) {
      const ok = confirm(
        next === "workshop"
          ? `Switching to Workshop will keep only one of the ${acts.length} programmed entries.`
          : `Switching to Event will remove all ${acts.length} programmed entries.`,
      )
      if (!ok) return
    }
    setKind(next)
    setKindPending(true)
    startTransition(async () => {
      const r = await updateBlockProgramming(blockId, { kind: next })
      setKindPending(false)
      if (!r.ok) {
        toast.error(r.error)
        setKind(kind)
        return
      }
      router.refresh()
    })
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
          <CardContent className="space-y-4">
            <div>
              <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Kind
              </Label>
              <div className="mt-1 inline-flex rounded-full border bg-white/60 p-0.5">
                {KIND_OPTIONS.map((opt) => {
                  const active = kind === opt.key
                  return (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => changeKind(opt.key)}
                      disabled={kindPending}
                      className={cn(
                        "px-3 py-1 rounded-full text-xs font-medium transition disabled:opacity-50",
                        active
                          ? "bg-blue-950 text-white"
                          : "text-slate-700 hover:text-slate-950 hover:bg-slate-100/70",
                      )}
                      title={opt.hint}
                    >
                      {opt.label}
                    </button>
                  )
                })}
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">
                {KIND_OPTIONS.find((o) => o.key === kind)?.hint}
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <FieldRow
                label="Name"
                field="title"
                value={header.title}
                placeholder={
                  kind === "workshop"
                    ? "e.g. Sunday Stand-up Bootcamp"
                    : kind === "event"
                      ? "e.g. Opening night reception"
                      : "e.g. Friday Late Show"
                }
                savingField={savingField}
                savedField={savedField}
                onChange={onHeaderChange}
              />
              <FieldRow
                label={kind === "workshop" ? "Instructor" : "Host"}
                field="host"
                value={header.host}
                placeholder={
                  kind === "workshop" ? "Lead teacher" : "MC name"
                }
                savingField={savingField}
                savedField={savedField}
                onChange={onHeaderChange}
              />
              <div className="sm:col-span-2">
                <FieldRow
                  label={kind === "workshop" ? "Description" : "Theme"}
                  field="theme"
                  value={header.theme}
                  placeholder={
                    kind === "workshop"
                      ? "What students will learn"
                      : kind === "event"
                        ? "What this event is about"
                        : "What ties the night together?"
                  }
                  savingField={savingField}
                  savedField={savedField}
                  onChange={onHeaderChange}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {kind === "show" && (
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
        )}

        {kind === "workshop" && (
          <WorkshopBlock
            selected={acts[0] ?? null}
            candidates={candidates}
            onAdd={(s) => {
              // Replace any existing selection.
              if (acts[0]) handleRemove(acts[0].submission.id)
              handleAdd(s)
            }}
            onRemove={() =>
              acts[0] && handleRemove(acts[0].submission.id)
            }
          />
        )}

        {kind === "event" && <EventBlock />}

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
        {kind === "show" && (
          <BillingPreview
            blockTitle={header.title}
            theme={header.theme}
            host={header.host}
            acts={acts}
          />
        )}
        {kind === "workshop" && (
          <Card>
            <CardHeader>
              <CardTitle>Class details</CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground space-y-2">
              <p>
                Pick a workshop submission to see its full description, cost,
                and ticket link inline.
              </p>
              <p>
                Submission data lives in <code>submissions.data</code> from
                the imported CSV — anything you collected on the form is
                surfaced.
              </p>
            </CardContent>
          </Card>
        )}
        {kind === "event" && (
          <Card>
            <CardHeader>
              <CardTitle>Volunteers</CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground space-y-2">
              <p>
                Events run on volunteers — assign them on the Volunteers page
                and link the shift to this block&apos;s time.
              </p>
              <a
                href="/volunteers"
                className="text-primary hover:underline underline-offset-4"
              >
                Open Volunteers →
              </a>
            </CardContent>
          </Card>
        )}
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

// Highlighted fields shown at the top of the workshop selection. Order is the
// reading order; first non-empty match for each label wins. We deliberately
// stay forgiving on the source key names since Squarespace forms vary.
const WORKSHOP_HIGHLIGHTS: Array<{
  label: string
  candidates: RegExp[]
}> = [
  {
    label: "Cost",
    candidates: [/^cost$/i, /^price$/i, /tuition/i, /fee/i],
  },
  {
    label: "Max attendees",
    candidates: [
      /max.*(attendee|capacity|student|participant)/i,
      /^capacity$/i,
      /class.*size/i,
      /attendee.*max/i,
    ],
  },
  {
    label: "Duration",
    candidates: [/^duration$/i, /^length$/i, /run.?time/i],
  },
  {
    label: "Tickets",
    candidates: [/ticket/i, /eventbrite/i, /signup/i, /registration/i],
  },
]

function pickHighlight(
  data: Record<string, unknown> | null,
  candidates: RegExp[],
): { value: string; key: string } | null {
  if (!data) return null
  for (const re of candidates) {
    for (const [k, v] of Object.entries(data)) {
      if (!re.test(k)) continue
      if (v == null) continue
      const s = String(v).trim()
      if (s.length > 0) return { value: s, key: k }
    }
  }
  return null
}

function WorkshopBlock({
  selected,
  candidates,
  onAdd,
  onRemove,
}: {
  selected: Act | null
  candidates: ActSubmission[]
  onAdd: (sub: ActSubmission) => void
  onRemove: () => void
}) {
  if (!selected) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Workshop</CardTitle>
          <CardAction>
            <span className="text-xs text-muted-foreground">
              {candidates.length} on file
            </span>
          </CardAction>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Pick the class for this slot. Switching the selection later
            replaces it.
          </p>
          <WorkshopPicker candidates={candidates} onAdd={onAdd} />
        </CardContent>
      </Card>
    )
  }

  const sub = selected.submission
  const highlights = WORKSHOP_HIGHLIGHTS.map((h) => ({
    label: h.label,
    hit: pickHighlight(sub.data, h.candidates),
  })).filter((h) => h.hit)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Workshop</CardTitle>
        <CardAction>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onRemove}
            className="text-muted-foreground hover:text-destructive"
          >
            Change
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <div className="font-medium text-base">
            {sub.name ?? "Untitled workshop"}
          </div>
          {sub.email && (
            <a
              href={`mailto:${sub.email}`}
              className="text-xs text-muted-foreground hover:text-foreground underline-offset-4 hover:underline"
            >
              {sub.email}
            </a>
          )}
        </div>

        {highlights.length > 0 && (
          <dl className="grid grid-cols-2 gap-3">
            {highlights.map((h) => (
              <div
                key={h.label}
                className="rounded-lg border bg-muted/40 px-3 py-2"
              >
                <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  {h.label}
                </dt>
                <dd className="text-sm font-medium mt-0.5 break-words">
                  {h.label === "Tickets" && /^https?:\/\//i.test(h.hit!.value) ? (
                    <a
                      href={h.hit!.value}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline underline-offset-4 break-all"
                    >
                      {h.hit!.value}
                    </a>
                  ) : (
                    h.hit!.value
                  )}
                </dd>
                <div className="text-[10px] text-muted-foreground mt-0.5 truncate">
                  from <span className="font-mono">{h.hit!.key}</span>
                </div>
              </div>
            ))}
          </dl>
        )}

        <div>
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1.5">
            Full submission
          </div>
          <ActMarketingPanel submission={sub} />
        </div>
      </CardContent>
    </Card>
  )
}

function WorkshopPicker({
  candidates,
  onAdd,
}: {
  candidates: ActSubmission[]
  onAdd: (sub: ActSubmission) => void
}) {
  if (candidates.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4 text-center border border-dashed rounded-lg">
        No workshop submissions on file. Import a workshop CSV in Settings.
      </p>
    )
  }
  return (
    <ul className="grid gap-2 sm:grid-cols-2">
      {candidates.map((c) => {
        const cost = pickHighlight(c.data, WORKSHOP_HIGHLIGHTS[0].candidates)
        const cap = pickHighlight(c.data, WORKSHOP_HIGHLIGHTS[1].candidates)
        return (
          <li key={c.id}>
            <button
              type="button"
              onClick={() => onAdd(c)}
              className="w-full text-left rounded-lg border bg-card p-3 transition hover:border-blue-300 hover:shadow-sm"
            >
              <div className="font-medium truncate">{c.name ?? "Untitled"}</div>
              {c.email && (
                <div className="text-xs text-muted-foreground truncate">
                  {c.email}
                </div>
              )}
              <div className="flex flex-wrap gap-2 mt-2 text-xs text-muted-foreground">
                {cost && <span>Cost: {cost.value}</span>}
                {cap && <span>Max: {cap.value}</span>}
              </div>
            </button>
          </li>
        )
      })}
    </ul>
  )
}

function EventBlock() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Event</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Events don&apos;t have acts or classes — they&apos;re festival
          moments staffed by volunteers (think opening reception, closing
          party, registration table coverage).
        </p>
        <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50/60 px-3 py-3 text-sm">
          <div className="font-medium text-slate-900">Volunteer assignments</div>
          <p className="text-xs text-muted-foreground mt-0.5">
            We&apos;re wiring per-block volunteer hookup next. For now, head
            to the Volunteers page to manage shifts.
          </p>
          <a
            href="/volunteers"
            className="mt-2 inline-block text-xs text-primary hover:underline underline-offset-4"
          >
            Open Volunteers →
          </a>
        </div>
      </CardContent>
    </Card>
  )
}
