"use client"

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Eye,
  EyeOff,
  Keyboard,
  Mic2,
  SkipForward,
  X,
} from "lucide-react"
import { SUBMISSION_TYPES, TYPE_LABELS, type SubmissionType } from "@/lib/csv"
import { castVerdictAndAdvance } from "./actions"
import { cn } from "@/lib/utils"

type Verdict = "yes" | "no" | "maybe"

export type TeamJudgment = {
  userId: string
  name: string
  verdict: Verdict | null
  notes: string
  updatedAt: string
}

type Progress = {
  judged: number
  total: number
  remaining: number
  position: number // position within the active (filter-aware) queue; 0 if off-queue
  navTotal: number // size of the active queue
  offQueue: boolean // true when current id isn't in the active queue (e.g. judged item w/ Skip-judged ON)
}

type Props = {
  submission: {
    id: string
    name: string
    email: string | null
    submittedAt: string | null
  }
  type: SubmissionType
  typeLabel: string
  videoEmbed: string | null
  highlighted: [string, string][]
  other: [string, string][]
  myVerdict: Verdict | null
  myNotes: string
  teamJudgments: TeamJudgment[]
  progress: Progress
  prevId: string | null
  nextId: string | null
  filter: "all" | "unjudged"
}

const VERDICT_CONFIG: Record<
  Verdict,
  { label: string; shortLabel: string; key: string; ring: string; solid: string; soft: string; dot: string; text: string }
> = {
  yes: {
    label: "Yes",
    shortLabel: "Yes",
    key: "Y",
    ring: "ring-emerald-500/40",
    solid: "bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-600",
    soft: "bg-emerald-50 text-emerald-900 border-emerald-200 hover:bg-emerald-100",
    dot: "bg-emerald-500",
    text: "text-emerald-700",
  },
  maybe: {
    label: "Could be convinced",
    shortLabel: "Maybe",
    key: "M",
    ring: "ring-amber-400/40",
    solid: "bg-amber-500 text-white border-amber-500 hover:bg-amber-500",
    soft: "bg-amber-50 text-amber-900 border-amber-200 hover:bg-amber-100",
    dot: "bg-amber-400",
    text: "text-amber-700",
  },
  no: {
    label: "No",
    shortLabel: "No",
    key: "N",
    ring: "ring-rose-500/40",
    solid: "bg-rose-600 text-white border-rose-600 hover:bg-rose-600",
    soft: "bg-rose-50 text-rose-900 border-rose-200 hover:bg-rose-100",
    dot: "bg-rose-500",
    text: "text-rose-700",
  },
}

const AUTO_ADVANCE_MS = 1400

export function JudgingCockpit(props: Props) {
  const {
    submission,
    type,
    videoEmbed,
    highlighted,
    other,
    teamJudgments,
    progress,
    prevId,
    nextId,
    filter,
  } = props

  const router = useRouter()
  const [verdict, setVerdict] = useState<Verdict | null>(props.myVerdict)
  const [notes, setNotes] = useState(props.myNotes)
  const [savedVerdict, setSavedVerdict] = useState<Verdict | null>(props.myVerdict)
  const [savedNotes, setSavedNotes] = useState(props.myNotes)
  const [revealed, setRevealed] = useState(props.myVerdict !== null)
  const [showHelp, setShowHelp] = useState(false)
  const [autoAdvance, setAutoAdvance] = useState<{ nextId: string | null; startedAt: number } | null>(null)
  const [pending, startTransition] = useTransition()
  const notesRef = useRef<HTMLTextAreaElement | null>(null)
  const hrefFor = useCallback(
    (id: string | null) => {
      if (!id) return null
      const qs = new URLSearchParams({ type, filter })
      qs.set("id", id)
      return `/judge?${qs.toString()}`
    },
    [type, filter],
  )

  // Reset local state when the current submission changes (e.g. after auto-advance).
  useEffect(() => {
    setVerdict(props.myVerdict)
    setNotes(props.myNotes)
    setSavedVerdict(props.myVerdict)
    setSavedNotes(props.myNotes)
    setRevealed(props.myVerdict !== null)
    setAutoAdvance(null)
  }, [submission.id, props.myVerdict, props.myNotes])

  const goTo = useCallback(
    (id: string | null) => {
      const href = hrefFor(id)
      if (!href) return
      router.push(href)
    },
    [hrefFor, router],
  )

  const cast = useCallback(
    (next: Verdict | null) => {
      setVerdict(next)
      setRevealed(next !== null || revealed)
      startTransition(async () => {
        const result = await castVerdictAndAdvance(submission.id, next, notes, type)
        if (!result.ok) {
          toast.error(result.error)
          return
        }
        setSavedVerdict(next)
        setSavedNotes(notes)
        // Schedule auto-advance if we just cast a verdict (not cleared).
        if (next !== null && result.nextId) {
          setAutoAdvance({ nextId: result.nextId, startedAt: Date.now() })
        } else if (next === null) {
          setAutoAdvance(null)
        } else {
          // nextId null — queue cleared. Nudge a refresh so the page re-renders.
          router.refresh()
        }
      })
    },
    [notes, revealed, router, submission.id, type],
  )

  const skip = useCallback(() => {
    if (nextId) goTo(nextId)
    else toast.message("No next submission — end of queue.")
  }, [goTo, nextId])

  const saveNotes = useCallback(() => {
    startTransition(async () => {
      const result = await castVerdictAndAdvance(submission.id, verdict, notes, type)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      setSavedNotes(notes)
      setSavedVerdict(verdict)
      toast.success("Notes saved.")
    })
  }, [notes, submission.id, type, verdict])

  // Auto-advance timer.
  useEffect(() => {
    if (!autoAdvance) return
    const timer = window.setTimeout(() => {
      goTo(autoAdvance.nextId)
    }, AUTO_ADVANCE_MS)
    return () => window.clearTimeout(timer)
  }, [autoAdvance, goTo])

  const cancelAutoAdvance = useCallback(() => setAutoAdvance(null), [])

  // Keyboard shortcuts.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      // Skip if typing in an input-like element — except for Escape which we
      // intercept to blur the notes field.
      const target = e.target as HTMLElement | null
      const isTyping =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      if (isTyping) {
        if (e.key === "Escape") {
          ;(target as HTMLElement).blur()
          e.preventDefault()
        }
        return
      }
      const k = e.key.toLowerCase()
      switch (k) {
        case "y":
        case "1":
          e.preventDefault()
          cast("yes")
          break
        case "m":
        case "2":
          e.preventDefault()
          cast("maybe")
          break
        case "n":
        case "3":
          e.preventDefault()
          cast("no")
          break
        case "s":
          e.preventDefault()
          skip()
          break
        case "arrowright":
          e.preventDefault()
          goTo(nextId)
          break
        case "arrowleft":
          e.preventDefault()
          goTo(prevId)
          break
        case "?":
          e.preventDefault()
          setShowHelp((s) => !s)
          break
        case "escape":
          if (showHelp) setShowHelp(false)
          else if (autoAdvance) cancelAutoAdvance()
          break
        case "r":
          // quick reveal / hide team verdicts
          setRevealed((r) => !r)
          break
        case "j": {
          // Toggle Skip-judged. Navigate to the mirror-image URL; server
          // recomputes prev/next + lands us correctly.
          e.preventDefault()
          const nextFilter = filter === "unjudged" ? "all" : "unjudged"
          const qs = new URLSearchParams({
            type,
            filter: nextFilter,
            id: submission.id,
          })
          router.push(`/judge?${qs.toString()}`)
          break
        }
        case "enter":
          if (notesRef.current) {
            notesRef.current.focus()
            e.preventDefault()
          }
          break
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [
    autoAdvance,
    cancelAutoAdvance,
    cast,
    goTo,
    nextId,
    prevId,
    showHelp,
    skip,
    filter,
    type,
    submission.id,
    router,
  ])

  const notesDirty = notes !== savedNotes
  const progressPct = progress.total > 0 ? (progress.judged / progress.total) * 100 : 0
  const teamConsensus = useMemo(() => tallyConsensus(teamJudgments), [teamJudgments])

  return (
    <div className="space-y-6">
      {/* Top bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/submissions"
            className="text-sm text-slate-600 hover:text-slate-900 inline-flex items-center gap-1"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Exit
          </Link>
          <span className="text-slate-300">·</span>
          <div className="flex items-center gap-2">
            <Mic2 className="h-4 w-4 text-blue-900" />
            <span className="font-[family-name:var(--font-serif)] text-2xl text-blue-950">
              Judging{" "}
              <span className="italic text-[#2340d9]">
                {TYPE_LABELS[type].toLowerCase()}
              </span>
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1 text-xs">
          {SUBMISSION_TYPES.map((t) => (
            <Link
              key={t}
              href={`/judge?type=${t}`}
              className={cn(
                "px-3 py-1.5 rounded-full font-medium transition",
                t === type
                  ? "bg-blue-950 text-white"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/60",
              )}
            >
              {TYPE_LABELS[t]}
            </Link>
          ))}
          <button
            type="button"
            onClick={() => setShowHelp(true)}
            className="ml-2 inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-slate-600 hover:text-slate-900 hover:bg-slate-100/60 font-medium"
            title="Keyboard shortcuts (?)"
          >
            <Keyboard className="h-3.5 w-3.5" /> ?
          </button>
        </div>
      </div>

      {/* Progress strip */}
      <div className="rounded-2xl border border-white/70 bg-white/70 backdrop-blur-xl px-5 py-3 shadow-[0_6px_22px_-16px_rgba(30,58,138,0.2)]">
        <div className="flex items-center justify-between gap-4 text-xs font-medium text-slate-600">
          <div className="inline-flex items-center gap-2">
            <span className="tabular-nums text-slate-900 font-semibold">
              {progress.judged} / {progress.total}
            </span>
            <span>judged</span>
            <span className="text-slate-300">·</span>
            <span className="tabular-nums">{progress.remaining} to go</span>
          </div>
          <div className="inline-flex items-center gap-2">
            <SkipJudgedToggle
              filter={filter}
              type={type}
              currentId={submission.id}
            />
            <span className="text-slate-300">·</span>
            <span className="tabular-nums">
              {progress.offQueue ? (
                <span title="This one's been judged — turn off Skip-judged to navigate through it.">
                  off queue
                </span>
              ) : (
                <>
                  #{progress.position} of {progress.navTotal}
                  {filter === "unjudged" && (
                    <span className="text-slate-400"> unjudged</span>
                  )}
                </>
              )}
            </span>
            <div className="flex items-center gap-1">
              <NavPill
                href={hrefFor(prevId)}
                disabled={!prevId}
                aria-label="Previous (←)"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </NavPill>
              <NavPill
                href={hrefFor(nextId)}
                disabled={!nextId}
                aria-label="Next (→)"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </NavPill>
            </div>
          </div>
        </div>
        <div className="mt-2 h-1 rounded-full bg-slate-200/70 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#2340d9] to-sky-400 transition-all"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* Main cockpit */}
      <div className="grid grid-cols-12 gap-4">
        {/* LEFT: video + subject */}
        <div className="col-span-12 lg:col-span-8 space-y-4">
          <div className="rounded-2xl border border-white/70 bg-white/70 backdrop-blur-xl p-5 shadow-[0_8px_28px_-18px_rgba(30,58,138,0.22)]">
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="text-[11px] uppercase tracking-[0.22em] font-semibold text-blue-900">
                  Currently judging
                </div>
                <h1 className="font-[family-name:var(--font-serif)] text-4xl md:text-5xl text-blue-950 leading-[1.05] mt-1">
                  {submission.name}
                </h1>
                <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-slate-700">
                  {submission.email && (
                    <a
                      href={`mailto:${submission.email}`}
                      className="hover:underline underline-offset-4"
                    >
                      {submission.email}
                    </a>
                  )}
                  {submission.submittedAt && (
                    <>
                      <span className="text-slate-300">·</span>
                      <span className="text-slate-600">
                        Submitted{" "}
                        {new Date(submission.submittedAt).toLocaleDateString()}
                      </span>
                    </>
                  )}
                </div>
              </div>
              <Link
                href={`/submissions/${submission.id}?type=${type}`}
                className="text-xs text-slate-500 hover:text-slate-800 underline-offset-4 hover:underline"
                title="Open full submission"
              >
                Full view →
              </Link>
            </div>

            {videoEmbed ? (
              <div className="aspect-video overflow-hidden rounded-xl border border-slate-200 bg-slate-950">
                <iframe
                  key={submission.id}
                  src={videoEmbed}
                  title={submission.name}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                  className="size-full"
                />
              </div>
            ) : (
              <div className="aspect-video flex items-center justify-center rounded-xl border border-dashed border-slate-300/80 bg-slate-50 text-sm text-slate-500 italic">
                No video URL found in this submission.
              </div>
            )}
          </div>

          {highlighted.length > 0 && (
            <div className="rounded-2xl border border-white/70 bg-white/70 backdrop-blur-xl p-5 shadow-[0_8px_28px_-18px_rgba(30,58,138,0.22)]">
              <div className="text-[11px] uppercase tracking-[0.22em] font-semibold text-slate-600 mb-3">
                Highlights
              </div>
              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                {highlighted.map(([k, v]) => (
                  <div key={k} className="min-w-0">
                    <dt className="text-[11px] uppercase tracking-wider text-slate-500 font-medium">
                      {k}
                    </dt>
                    <dd className="mt-0.5 text-slate-900 leading-snug break-words whitespace-pre-wrap">
                      {v}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          )}

          {other.length > 0 && (
            <details className="rounded-2xl border border-white/70 bg-white/60 backdrop-blur-xl p-5 shadow-[0_6px_22px_-16px_rgba(30,58,138,0.18)] group">
              <summary className="cursor-pointer text-xs font-semibold text-slate-700 uppercase tracking-[0.18em] marker:hidden list-none inline-flex items-center gap-2">
                <span className="inline-block transition group-open:rotate-90">
                  ▸
                </span>
                More fields ({other.length})
              </summary>
              <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-[200px_1fr]">
                {other.map(([k, v]) => (
                  <div key={k} className="contents">
                    <dt className="text-slate-500">{k}</dt>
                    <dd className="text-slate-800 whitespace-pre-wrap break-words">
                      {v}
                    </dd>
                  </div>
                ))}
              </dl>
            </details>
          )}
        </div>

        {/* RIGHT: verdict + notes + team */}
        <div className="col-span-12 lg:col-span-4 space-y-4">
          <div className="rounded-2xl border border-white/70 bg-white/75 backdrop-blur-xl p-5 shadow-[0_8px_28px_-18px_rgba(30,58,138,0.22)]">
            <div className="flex items-center justify-between mb-3">
              <div className="text-[11px] uppercase tracking-[0.22em] font-semibold text-slate-700">
                Your verdict
              </div>
              {verdict && (
                <button
                  type="button"
                  onClick={() => cast(null)}
                  className="text-xs text-slate-500 hover:text-slate-800 inline-flex items-center gap-1"
                  disabled={pending}
                >
                  <X className="h-3 w-3" /> clear
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 gap-2">
              {(["yes", "maybe", "no"] as const).map((v) => {
                const cfg = VERDICT_CONFIG[v]
                const active = verdict === v
                return (
                  <button
                    key={v}
                    type="button"
                    onClick={() => cast(v)}
                    disabled={pending}
                    className={cn(
                      "group relative flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm font-semibold transition disabled:opacity-60",
                      active ? cfg.solid : cfg.soft,
                    )}
                  >
                    <span className="inline-flex items-center gap-2">
                      <span
                        className={cn(
                          "h-2 w-2 rounded-full",
                          active ? "bg-white" : cfg.dot,
                        )}
                      />
                      {cfg.label}
                    </span>
                    <kbd
                      className={cn(
                        "inline-flex items-center justify-center h-6 min-w-6 rounded-md text-[11px] font-mono border",
                        active
                          ? "bg-white/15 border-white/30 text-white"
                          : "bg-white/70 border-slate-300 text-slate-600",
                      )}
                    >
                      {cfg.key}
                    </kbd>
                  </button>
                )
              })}
              <button
                type="button"
                onClick={skip}
                disabled={pending || !nextId}
                className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white/70 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100/60 transition disabled:opacity-50"
              >
                <span>Skip for now</span>
                <kbd className="inline-flex items-center justify-center h-6 min-w-6 rounded-md text-[11px] font-mono border border-slate-300 bg-white/70 text-slate-600">
                  S
                </kbd>
              </button>
            </div>

            {autoAdvance && (
              <AutoAdvanceIndicator
                startedAt={autoAdvance.startedAt}
                onCancel={cancelAutoAdvance}
              />
            )}
          </div>

          <div className="rounded-2xl border border-white/70 bg-white/75 backdrop-blur-xl p-5 shadow-[0_8px_28px_-18px_rgba(30,58,138,0.22)]">
            <label
              htmlFor="judge-notes"
              className="text-[11px] uppercase tracking-[0.22em] font-semibold text-slate-700 block mb-2"
            >
              Private notes
            </label>
            <textarea
              ref={notesRef}
              id="judge-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Why — or anything your teammates should know."
              rows={4}
              className="w-full rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#2340d9]/30 focus:border-[#2340d9]/40 resize-none"
            />
            <div className="mt-2 flex items-center justify-between gap-2">
              <span className="text-[11px] text-slate-500 inline-flex items-center gap-1">
                <Keyboard className="h-3 w-3" /> Press Enter to focus
              </span>
              <button
                type="button"
                onClick={saveNotes}
                disabled={pending || !notesDirty}
                className={cn(
                  "text-xs font-semibold rounded-full px-3 py-1 transition",
                  notesDirty
                    ? "bg-blue-950 text-white hover:bg-blue-900"
                    : "bg-slate-100 text-slate-400",
                )}
              >
                {pending ? "Saving…" : notesDirty ? "Save notes" : "Saved"}
              </button>
            </div>
          </div>

          <TeamPanel
            revealed={revealed}
            canReveal={verdict !== null || revealed}
            onReveal={() => setRevealed(true)}
            onHide={() => setRevealed(false)}
            team={teamJudgments}
            consensus={teamConsensus}
          />
        </div>
      </div>

      {showHelp && <ShortcutsModal onClose={() => setShowHelp(false)} />}
    </div>
  )
}

function SkipJudgedToggle({
  filter,
  type,
  currentId,
}: {
  filter: "all" | "unjudged"
  type: SubmissionType
  currentId: string
}) {
  const enabled = filter === "unjudged"
  const nextFilter = enabled ? "all" : "unjudged"
  // Preserve the current id so the toggle doesn't tele-port them to the first
  // unjudged; the server decides whether they stay on a judged item when
  // Skip-judged is ON (navigates off-queue) vs. redirects.
  const qs = new URLSearchParams({ type, filter: nextFilter, id: currentId })
  return (
    <Link
      href={`/judge?${qs.toString()}`}
      title={
        enabled
          ? "Skip-judged ON — prev/next walk only unjudged submissions (J to toggle)"
          : "Skip-judged OFF — prev/next walk every submission (J to toggle)"
      }
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 transition",
        enabled
          ? "border-blue-200 bg-blue-50 text-blue-900 hover:bg-blue-100"
          : "border-slate-200 bg-white/70 text-slate-600 hover:bg-slate-100/70",
      )}
    >
      <SkipForward className="h-3 w-3" />
      <span className="font-semibold">Skip judged</span>
      <span
        className={cn(
          "ml-0.5 relative inline-flex h-3.5 w-6 items-center rounded-full transition",
          enabled ? "bg-blue-600" : "bg-slate-300",
        )}
      >
        <span
          className={cn(
            "absolute h-2.5 w-2.5 rounded-full bg-white shadow transition-transform",
            enabled ? "translate-x-3" : "translate-x-0.5",
          )}
        />
      </span>
    </Link>
  )
}

function NavPill({
  href,
  disabled,
  children,
  ...rest
}: {
  href: string | null
  disabled?: boolean
  children: React.ReactNode
} & React.AriaAttributes) {
  if (!href || disabled) {
    return (
      <span
        className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white/60 text-slate-400 opacity-60"
        {...rest}
      >
        {children}
      </span>
    )
  }
  return (
    <Link
      href={href}
      className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white/70 text-slate-700 hover:text-slate-900 hover:bg-white transition"
      {...rest}
    >
      {children}
    </Link>
  )
}

function AutoAdvanceIndicator({
  startedAt,
  onCancel,
}: {
  startedAt: number
  onCancel: () => void
}) {
  const [pct, setPct] = useState(0)
  useEffect(() => {
    let raf = 0
    const tick = () => {
      const elapsed = Date.now() - startedAt
      setPct(Math.min(100, (elapsed / AUTO_ADVANCE_MS) * 100))
      if (elapsed < AUTO_ADVANCE_MS) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [startedAt])
  return (
    <div className="mt-4 rounded-xl bg-slate-50 border border-slate-200 p-3">
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="text-slate-700 inline-flex items-center gap-1.5">
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> Saved. Advancing…
        </span>
        <button
          type="button"
          onClick={onCancel}
          className="text-slate-500 hover:text-slate-900 font-medium"
        >
          Cancel (Esc)
        </button>
      </div>
      <div className="mt-2 h-1 rounded-full bg-slate-200 overflow-hidden">
        <div
          className="h-full rounded-full bg-emerald-500 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

type Consensus = {
  yes: number
  no: number
  maybe: number
  total: number
}

function tallyConsensus(team: TeamJudgment[]): Consensus {
  const c: Consensus = { yes: 0, no: 0, maybe: 0, total: 0 }
  for (const j of team) {
    if (j.verdict === "yes") c.yes++
    else if (j.verdict === "no") c.no++
    else if (j.verdict === "maybe") c.maybe++
    if (j.verdict) c.total++
  }
  return c
}

function TeamPanel({
  revealed,
  canReveal,
  onReveal,
  onHide,
  team,
  consensus,
}: {
  revealed: boolean
  canReveal: boolean
  onReveal: () => void
  onHide: () => void
  team: TeamJudgment[]
  consensus: Consensus
}) {
  const hasTeam = team.length > 0
  return (
    <div className="rounded-2xl border border-white/70 bg-white/60 backdrop-blur-xl p-5 shadow-[0_8px_28px_-18px_rgba(30,58,138,0.22)]">
      <div className="flex items-center justify-between mb-3">
        <div className="text-[11px] uppercase tracking-[0.22em] font-semibold text-slate-700">
          Team verdicts{hasTeam ? ` · ${team.length}` : ""}
        </div>
        {canReveal && hasTeam && (
          <button
            type="button"
            onClick={revealed ? onHide : onReveal}
            className="text-xs text-slate-500 hover:text-slate-800 inline-flex items-center gap-1"
          >
            {revealed ? (
              <>
                <EyeOff className="h-3 w-3" /> hide
              </>
            ) : (
              <>
                <Eye className="h-3 w-3" /> reveal
              </>
            )}
          </button>
        )}
      </div>
      {!canReveal ? (
        <div className="rounded-xl border border-dashed border-slate-300/70 bg-slate-50/70 p-4 text-sm text-slate-600 italic text-center">
          Hidden until you vote — blind judging.
        </div>
      ) : !hasTeam ? (
        <p className="text-sm text-slate-600 italic">
          No teammates have judged this one yet.
        </p>
      ) : !revealed ? (
        <button
          type="button"
          onClick={onReveal}
          className="w-full rounded-xl border border-slate-200 bg-white/70 px-4 py-6 text-sm font-medium text-slate-700 hover:bg-slate-100/60 inline-flex items-center justify-center gap-2"
        >
          <Eye className="h-4 w-4" /> Reveal team verdicts
        </button>
      ) : (
        <div className="space-y-3">
          {consensus.total > 0 && (
            <div className="flex items-center gap-1 text-xs font-medium text-slate-600">
              <ConsensusPill count={consensus.yes} label="yes" tone="yes" />
              <ConsensusPill count={consensus.maybe} label="maybe" tone="maybe" />
              <ConsensusPill count={consensus.no} label="no" tone="no" />
            </div>
          )}
          <ul className="space-y-3 text-sm">
            {team.map((j) => (
              <li key={j.userId} className="space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-slate-900 truncate">
                    {j.name}
                  </span>
                  {j.verdict ? (
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold",
                        verdictBadgeClass(j.verdict),
                      )}
                    >
                      <span
                        className={cn("h-1.5 w-1.5 rounded-full", VERDICT_CONFIG[j.verdict].dot)}
                      />
                      {VERDICT_CONFIG[j.verdict].shortLabel}
                    </span>
                  ) : (
                    <span className="text-[11px] text-slate-500 italic">no verdict</span>
                  )}
                </div>
                {j.notes && (
                  <p className="text-xs text-slate-600 whitespace-pre-wrap leading-snug">
                    {j.notes}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function verdictBadgeClass(v: Verdict) {
  return {
    yes: "bg-emerald-100 text-emerald-900",
    no: "bg-rose-100 text-rose-900",
    maybe: "bg-amber-100 text-amber-900",
  }[v]
}

function ConsensusPill({
  count,
  label,
  tone,
}: {
  count: number
  label: string
  tone: Verdict
}) {
  if (count === 0) return null
  const cfg = VERDICT_CONFIG[tone]
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px]",
        verdictBadgeClass(tone),
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", cfg.dot)} />
      <span className="tabular-nums font-semibold">{count}</span>
      <span>{label}</span>
    </span>
  )
}

function ShortcutsModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/30 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-3xl border border-white/70 bg-white/95 backdrop-blur-xl p-6 shadow-xl"
      >
        <div className="flex items-center justify-between mb-5">
          <div className="font-[family-name:var(--font-serif)] text-2xl text-blue-950">
            Shortcuts
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-8 w-8 rounded-full inline-flex items-center justify-center text-slate-500 hover:bg-slate-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <dl className="space-y-2 text-sm">
          <Row k="Y / 1" v="Verdict · Yes" />
          <Row k="M / 2" v="Verdict · Could be convinced" />
          <Row k="N / 3" v="Verdict · No" />
          <Row k="S" v="Skip to next" />
          <Row k="← / →" v="Prev / Next submission" />
          <Row k="R" v="Toggle team verdicts" />
          <Row k="J" v="Toggle Skip-judged filter" />
          <Row k="Enter" v="Focus notes" />
          <Row k="Esc" v="Cancel auto-advance / blur notes" />
          <Row k="?" v="Toggle this help" />
        </dl>
      </div>
    </div>
  )
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-1">
      <dt className="text-slate-600">{v}</dt>
      <dd>
        <kbd className="inline-flex items-center justify-center h-7 min-w-7 rounded-md text-[11px] font-mono border border-slate-300 bg-slate-50 px-2 text-slate-700">
          {k}
        </kbd>
      </dd>
    </div>
  )
}
