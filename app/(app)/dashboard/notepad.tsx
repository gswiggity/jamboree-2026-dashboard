"use client"

import { useMemo, useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Pin, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import {
  createNote,
  deleteNote,
  setNotePinned,
  updateNote,
} from "./actions"

export type NoteRow = {
  id: string
  body: string
  pinned: boolean
  created_at: string
  updated_at: string
  created_by: string | null
}

export type NoteAuthor = {
  id: string
  name: string | null
  email: string
}

// Lined-paper rules and red margin line. Tweak the numbers in tandem:
// LINE_HEIGHT must match `leading-[…]` on the editable text so the writing
// sits on the rule, not floating between two of them.
const LINE_HEIGHT_REM = 1.625
const MARGIN_LEFT_REM = 2.25
const RULE_COLOR = "rgba(99, 102, 241, 0.18)"
const MARGIN_COLOR = "rgba(244, 63, 94, 0.45)"

const PAPER_BG: React.CSSProperties = {
  backgroundColor: "#fffdf3",
  backgroundImage: [
    // Red vertical margin line.
    `linear-gradient(to right, transparent 0 ${MARGIN_LEFT_REM}rem, ${MARGIN_COLOR} ${MARGIN_LEFT_REM}rem ${MARGIN_LEFT_REM + 0.0625}rem, transparent ${MARGIN_LEFT_REM + 0.0625}rem)`,
    // Horizontal ruled lines.
    `repeating-linear-gradient(to bottom, transparent 0 ${LINE_HEIGHT_REM - 0.0625}rem, ${RULE_COLOR} ${LINE_HEIGHT_REM - 0.0625}rem ${LINE_HEIGHT_REM}rem)`,
  ].join(","),
  backgroundAttachment: "local",
}

export function Notepad({
  notes,
  authors,
  currentUserId,
}: {
  notes: NoteRow[]
  authors: NoteAuthor[]
  currentUserId: string
}) {
  const authorById = useMemo(
    () => new Map(authors.map((a) => [a.id, a])),
    [authors],
  )

  const sorted = useMemo(() => {
    return [...notes].sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
      return b.created_at.localeCompare(a.created_at)
    })
  }, [notes])

  return (
    <article
      // h-full makes the notepad fill the right column (which is sticky and
      // sized to the viewport). Body scrolls when there are too many notes.
      className="rounded-md overflow-hidden border border-amber-300/60 shadow-[0_18px_40px_-20px_rgba(120,53,15,0.35),0_4px_12px_-4px_rgba(120,53,15,0.2)] flex flex-col h-full"
    >
      {/* Spiral binding strip */}
      <div className="bg-gradient-to-b from-blue-950 to-blue-900 px-4 py-2 flex items-center justify-between relative">
        <div className="absolute inset-x-0 top-1 flex justify-around px-2 pointer-events-none">
          {Array.from({ length: 14 }).map((_, i) => (
            <span
              key={i}
              className="h-1.5 w-1.5 rounded-full bg-amber-100/40 shadow-inner"
            />
          ))}
        </div>
        <h2 className="font-[family-name:var(--font-serif)] italic text-amber-50 text-base mt-2">
          Team notepad
        </h2>
        <span className="text-[10px] uppercase tracking-[0.18em] text-amber-200/80 mt-2 tabular-nums">
          {notes.length} {notes.length === 1 ? "note" : "notes"}
        </span>
      </div>

      {/* Paper body */}
      <div
        className="flex-1 overflow-y-auto"
        style={PAPER_BG}
      >
        <div
          className="py-3"
          style={{ paddingLeft: `${MARGIN_LEFT_REM + 0.75}rem`, paddingRight: "0.75rem" }}
        >
          <Composer lineHeightRem={LINE_HEIGHT_REM} />
          {sorted.length > 0 && (
            <div className="mt-3 space-y-3">
              {sorted.map((n) => (
                <NoteEntry
                  key={n.id}
                  note={n}
                  author={n.created_by ? authorById.get(n.created_by) ?? null : null}
                  isOwn={n.created_by === currentUserId}
                  lineHeightRem={LINE_HEIGHT_REM}
                />
              ))}
            </div>
          )}
          {sorted.length === 0 && (
            <p
              className="text-slate-400 italic font-[family-name:var(--font-serif)] mt-2"
              style={{ lineHeight: `${LINE_HEIGHT_REM}rem` }}
            >
              No notes yet — start above.
            </p>
          )}
        </div>
      </div>
    </article>
  )
}

// ——————————————————————————————————————————————————————————
// Composer — always-on textarea at the top of the page. Submits on
// ⌘/Ctrl+Enter; bare Enter inserts a new line, like a real notepad.
// ——————————————————————————————————————————————————————————

function Composer({ lineHeightRem }: { lineHeightRem: number }) {
  const router = useRouter()
  const ref = useRef<HTMLTextAreaElement>(null)
  const [body, setBody] = useState("")
  const [pending, startTransition] = useTransition()

  function submit() {
    const trimmed = body.trim()
    if (!trimmed) return
    // Clear synchronously *before* the transition. router.refresh() can
    // briefly blur the textarea, which would re-fire submit() via onBlur
    // and create a duplicate if body still held the old text.
    setBody("")
    startTransition(async () => {
      const res = await createNote(trimmed)
      if (!res.ok) {
        toast.error(res.error)
        setBody(trimmed)
        return
      }
      router.refresh()
      ref.current?.focus()
    })
  }

  return (
    <div>
      <div
        className="text-[10px] uppercase tracking-[0.18em] text-rose-700/70 font-semibold"
        style={{ lineHeight: `${lineHeightRem}rem` }}
      >
        New note
      </div>
      <textarea
        ref={ref}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault()
            submit()
          }
        }}
        onBlur={submit}
        placeholder="Jot something for the team — ⌘↵ to save"
        rows={2}
        disabled={pending}
        className={cn(
          "w-full bg-transparent border-0 outline-none resize-none p-0 m-0",
          "text-slate-800 font-[family-name:var(--font-serif)] placeholder:italic placeholder:text-slate-400",
          "field-sizing-content",
        )}
        style={{ lineHeight: `${lineHeightRem}rem` }}
      />
    </div>
  )
}

// ——————————————————————————————————————————————————————————
// One existing note. Always rendered as a textarea so reading and
// editing are the same gesture — click anywhere on the body, type,
// click away to save. No modal.
// ——————————————————————————————————————————————————————————

function NoteEntry({
  note,
  author,
  isOwn,
  lineHeightRem,
}: {
  note: NoteRow
  author: NoteAuthor | null
  isOwn: boolean
  lineHeightRem: number
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [body, setBody] = useState(note.body)
  // Snap local state to incoming server state (e.g. after a refresh)
  // without useEffect — runs during render when identity changes.
  const [lastSeenBody, setLastSeenBody] = useState(note.body)
  if (note.body !== lastSeenBody) {
    setLastSeenBody(note.body)
    setBody(note.body)
  }

  function save() {
    const trimmed = body.trim()
    if (!trimmed) {
      // Empty edits revert rather than delete (deleting needs the trash icon
      // so it's a deliberate choice).
      setBody(note.body)
      return
    }
    if (trimmed === note.body) return
    startTransition(async () => {
      const res = await updateNote(note.id, trimmed)
      if (!res.ok) {
        toast.error(res.error)
        setBody(note.body)
        return
      }
      router.refresh()
    })
  }

  function togglePin() {
    startTransition(async () => {
      const res = await setNotePinned(note.id, !note.pinned)
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      router.refresh()
    })
  }

  function handleDelete() {
    if (!confirm("Delete this note?")) return
    startTransition(async () => {
      const res = await deleteNote(note.id)
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success("Note deleted.")
      router.refresh()
    })
  }

  const authorLabel = author
    ? author.name ?? author.email.split("@")[0]
    : "Unknown"

  return (
    <div className={cn("group relative", pending && "opacity-70")}>
      <div
        className="flex items-center justify-between text-[10px] uppercase tracking-[0.16em] text-slate-500"
        style={{ lineHeight: `${lineHeightRem}rem` }}
      >
        <span className="truncate">
          {note.pinned && (
            <Pin className="inline-block h-2.5 w-2.5 mr-1 -mt-0.5 text-rose-700" />
          )}
          <span className="font-semibold capitalize text-slate-700">
            {authorLabel}
          </span>
          {isOwn && <span className="text-slate-400 normal-case ml-1">(you)</span>}
          <span className="mx-1.5 text-slate-300">·</span>
          <time
            dateTime={note.created_at}
            title={new Date(note.created_at).toLocaleString()}
            className="tabular-nums"
          >
            {formatRelative(note.created_at)}
          </time>
          {note.updated_at !== note.created_at && (
            <span className="ml-1 italic text-slate-400 normal-case">edited</span>
          )}
        </span>
        <span className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition shrink-0">
          <IconBtn
            label={note.pinned ? "Unpin" : "Pin"}
            onClick={togglePin}
            disabled={pending}
            active={note.pinned}
          >
            <Pin className="h-3 w-3" />
          </IconBtn>
          {isOwn && (
            <IconBtn
              label="Delete"
              onClick={handleDelete}
              disabled={pending}
              tone="danger"
            >
              <Trash2 className="h-3 w-3" />
            </IconBtn>
          )}
        </span>
      </div>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.currentTarget.blur()
          } else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault()
            e.currentTarget.blur()
          }
        }}
        onBlur={save}
        disabled={pending}
        rows={1}
        className={cn(
          "w-full bg-transparent border-0 outline-none resize-none p-0 m-0",
          "text-slate-800 font-[family-name:var(--font-serif)]",
          "field-sizing-content cursor-text",
          "focus-visible:bg-amber-100/30 rounded-sm",
        )}
        style={{ lineHeight: `${lineHeightRem}rem` }}
      />
    </div>
  )
}

function IconBtn({
  children,
  onClick,
  label,
  disabled,
  tone,
  active,
}: {
  children: React.ReactNode
  onClick: () => void
  label: string
  disabled?: boolean
  tone?: "danger"
  active?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className={cn(
        "h-5 w-5 inline-flex items-center justify-center rounded text-slate-500 hover:bg-amber-200/40 hover:text-slate-900 disabled:opacity-40 transition",
        tone === "danger" && "hover:bg-rose-100/60 hover:text-rose-700",
        active && "text-rose-700",
      )}
    >
      {children}
    </button>
  )
}

// ——————————————————————————————————————————————————————————
// Time formatting
// ——————————————————————————————————————————————————————————

function formatRelative(iso: string): string {
  const date = new Date(iso)
  const now = Date.now()
  const diffMs = now - date.getTime()
  const diffMin = Math.round(diffMs / 60_000)
  if (diffMin < 1) return "just now"
  if (diffMin < 60) return `${diffMin}m`
  const diffHr = Math.round(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h`
  const diffDay = Math.round(diffHr / 24)
  if (diffDay === 1) return "yesterday"
  if (diffDay < 7) return `${diffDay}d`
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}
