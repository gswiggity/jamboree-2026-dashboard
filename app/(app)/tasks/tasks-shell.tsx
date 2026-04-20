"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import {
  Calendar,
  Check,
  Pencil,
  Plus,
  Trash2,
  User as UserIcon,
} from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  createTask,
  deleteTask,
  setTaskComplete,
  updateTask,
} from "./actions"

export type TaskRow = {
  id: string
  title: string
  description: string
  due_date: string | null
  assigned_to: string | null
  created_by: string | null
  completed_at: string | null
  completed_by: string | null
  created_at: string
  updated_at: string
}

export type TeamMember = {
  id: string
  name: string | null
  email: string
}

type FilterKey = "all" | "mine" | "unassigned" | "completed"

export function TasksShell({
  tasks,
  team,
  currentUserId,
}: {
  tasks: TaskRow[]
  team: TeamMember[]
  currentUserId: string
}) {
  const [filter, setFilter] = useState<FilterKey>("all")
  const [editing, setEditing] = useState<TaskRow | null>(null)

  const teamById = useMemo(
    () => new Map(team.map((m) => [m.id, m])),
    [team],
  )

  const counts = useMemo(() => {
    let open = 0
    let mine = 0
    let unassigned = 0
    let completed = 0
    for (const t of tasks) {
      if (t.completed_at) {
        completed += 1
        continue
      }
      open += 1
      if (!t.assigned_to) unassigned += 1
      else if (t.assigned_to === currentUserId) mine += 1
    }
    return { open, mine, unassigned, completed, total: tasks.length }
  }, [tasks, currentUserId])

  const filtered = useMemo(() => {
    switch (filter) {
      case "mine":
        return tasks.filter(
          (t) => !t.completed_at && t.assigned_to === currentUserId,
        )
      case "unassigned":
        return tasks.filter((t) => !t.completed_at && !t.assigned_to)
      case "completed":
        return tasks.filter((t) => !!t.completed_at)
      case "all":
      default:
        return tasks.filter((t) => !t.completed_at)
    }
  }, [tasks, filter, currentUserId])

  const groups = useMemo(() => groupByDue(filtered), [filtered])

  return (
    <div className="space-y-5">
      <QuickCreate team={team} currentUserId={currentUserId} />

      <FilterChips
        filter={filter}
        onChange={setFilter}
        counts={{
          all: counts.open,
          mine: counts.mine,
          unassigned: counts.unassigned,
          completed: counts.completed,
        }}
      />

      {filtered.length === 0 ? (
        <EmptyState filter={filter} hasAny={counts.total > 0} />
      ) : (
        <div className="space-y-6">
          {groups.map((g) => (
            <TaskGroup
              key={g.key}
              label={g.label}
              tone={g.tone}
              tasks={g.tasks}
              teamById={teamById}
              currentUserId={currentUserId}
              onEdit={setEditing}
            />
          ))}
        </div>
      )}

      <EditDialog
        task={editing}
        team={team}
        onClose={() => setEditing(null)}
      />
    </div>
  )
}

// ——————————————————————————————————————————————————————————
// Quick-create row — add a task in one line.
// ——————————————————————————————————————————————————————————

function QuickCreate({
  team,
  currentUserId,
}: {
  team: TeamMember[]
  currentUserId: string
}) {
  const router = useRouter()
  const [title, setTitle] = useState("")
  const [assignee, setAssignee] = useState<string>("")
  const [dueDate, setDueDate] = useState<string>("")
  const [pending, startTransition] = useTransition()

  function submit() {
    if (!title.trim()) return
    startTransition(async () => {
      const res = await createTask({
        title,
        description: "",
        assigned_to: assignee || null,
        due_date: dueDate || null,
      })
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success("Task added.")
      setTitle("")
      setAssignee("")
      setDueDate("")
      router.refresh()
    })
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
      className="rounded-2xl border border-white/70 bg-white/65 backdrop-blur-xl p-3 shadow-[0_8px_28px_-18px_rgba(30,58,138,0.18)]"
    >
      <div className="flex flex-wrap items-end gap-2">
        <FieldWithLabel
          label="Task"
          htmlFor="quick-title"
          className="flex-1 min-w-[220px]"
        >
          <Input
            id="quick-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What needs doing? e.g. Buy volunteer lanyards"
            disabled={pending}
          />
        </FieldWithLabel>
        <FieldWithLabel label="Assignee" htmlFor="quick-assignee">
          <AssigneePicker
            id="quick-assignee"
            value={assignee}
            onChange={setAssignee}
            team={team}
            currentUserId={currentUserId}
            disabled={pending}
            compact
          />
        </FieldWithLabel>
        <FieldWithLabel label="Due date" htmlFor="quick-due">
          <DueDatePicker
            id="quick-due"
            value={dueDate}
            onChange={setDueDate}
            disabled={pending}
            compact
          />
        </FieldWithLabel>
        <Button type="submit" size="sm" disabled={pending || !title.trim()}>
          <Plus className="h-3.5 w-3.5 mr-1" />
          {pending ? "Adding…" : "Add task"}
        </Button>
      </div>
    </form>
  )
}

function FieldWithLabel({
  label,
  htmlFor,
  className,
  children,
}: {
  label: string
  htmlFor: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={cn("space-y-1", className)}>
      <Label
        htmlFor={htmlFor}
        className="text-[10px] uppercase tracking-[0.18em] font-semibold text-slate-500"
      >
        {label}
      </Label>
      {children}
    </div>
  )
}

// ——————————————————————————————————————————————————————————
// Filter chips
// ——————————————————————————————————————————————————————————

function FilterChips({
  filter,
  onChange,
  counts,
}: {
  filter: FilterKey
  onChange: (f: FilterKey) => void
  counts: { all: number; mine: number; unassigned: number; completed: number }
}) {
  const chips: { key: FilterKey; label: string; count: number }[] = [
    { key: "all", label: "All open", count: counts.all },
    { key: "mine", label: "Mine", count: counts.mine },
    { key: "unassigned", label: "Unassigned", count: counts.unassigned },
    { key: "completed", label: "Completed", count: counts.completed },
  ]
  return (
    <div className="flex flex-wrap gap-1.5">
      {chips.map((c) => {
        const active = c.key === filter
        return (
          <button
            key={c.key}
            type="button"
            onClick={() => onChange(c.key)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition",
              active
                ? "bg-blue-950 text-white"
                : "bg-white/60 border border-slate-200/70 text-slate-700 hover:bg-white",
            )}
          >
            <span>{c.label}</span>
            <span
              className={cn(
                "tabular-nums text-[10px]",
                active ? "text-white/70" : "text-slate-500",
              )}
            >
              {c.count}
            </span>
          </button>
        )
      })}
    </div>
  )
}

function EmptyState({
  filter,
  hasAny,
}: {
  filter: FilterKey
  hasAny: boolean
}) {
  const msg =
    !hasAny
      ? "No tasks yet. Add one above to start tracking work."
      : filter === "mine"
        ? "Nothing assigned to you right now."
        : filter === "unassigned"
          ? "Every open task has an owner — nice."
          : filter === "completed"
            ? "No completed tasks yet."
            : "Nothing open right now."
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white/40 p-10 text-center">
      <p className="text-sm text-slate-700 font-medium">{msg}</p>
    </div>
  )
}

// ——————————————————————————————————————————————————————————
// Group headers + task groups
// ——————————————————————————————————————————————————————————

type DueGroup = {
  key: string
  label: string
  tone: "rose" | "amber" | "slate" | "emerald"
  tasks: TaskRow[]
}

function groupByDue(tasks: TaskRow[]): DueGroup[] {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  const overdue: TaskRow[] = []
  const dueSoon: TaskRow[] = [] // within the next 7 days
  const later: TaskRow[] = []
  const completed: TaskRow[] = []

  for (const t of tasks) {
    if (t.completed_at) {
      completed.push(t)
      continue
    }
    if (!t.due_date) {
      later.push(t)
      continue
    }
    const d = parseDueDate(t.due_date)
    if (!d) {
      later.push(t)
      continue
    }
    const diffDays = Math.floor(
      (d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
    )
    if (diffDays < 0) overdue.push(t)
    else if (diffDays <= 7) dueSoon.push(t)
    else later.push(t)
  }

  const groups: DueGroup[] = []
  if (overdue.length > 0)
    groups.push({ key: "overdue", label: "Overdue", tone: "rose", tasks: overdue })
  if (dueSoon.length > 0)
    groups.push({
      key: "due-soon",
      label: "Due this week",
      tone: "amber",
      tasks: dueSoon,
    })
  if (later.length > 0)
    groups.push({
      key: "later",
      label: "Later / no due date",
      tone: "slate",
      tasks: later,
    })
  if (completed.length > 0)
    groups.push({
      key: "completed",
      label: "Completed",
      tone: "emerald",
      tasks: completed,
    })

  return groups
}

function TaskGroup({
  label,
  tone,
  tasks,
  teamById,
  currentUserId,
  onEdit,
}: {
  label: string
  tone: DueGroup["tone"]
  tasks: TaskRow[]
  teamById: Map<string, TeamMember>
  currentUserId: string
  onEdit: (t: TaskRow) => void
}) {
  const dotTone = {
    rose: "bg-rose-500",
    amber: "bg-amber-500",
    slate: "bg-slate-400",
    emerald: "bg-emerald-500",
  }[tone]
  return (
    <section className="space-y-2">
      <div className="flex items-center gap-2 px-1">
        <span className={cn("h-2 w-2 rounded-full", dotTone)} />
        <h2 className="text-[11px] uppercase tracking-[0.22em] font-semibold text-slate-600">
          {label}
        </h2>
        <span className="text-[10px] tabular-nums text-slate-500">
          {tasks.length}
        </span>
      </div>
      <ul className="space-y-2">
        {tasks.map((t) => (
          <TaskRowItem
            key={t.id}
            task={t}
            teamById={teamById}
            currentUserId={currentUserId}
            onEdit={() => onEdit(t)}
          />
        ))}
      </ul>
    </section>
  )
}

// ——————————————————————————————————————————————————————————
// Individual row
// ——————————————————————————————————————————————————————————

function TaskRowItem({
  task,
  teamById,
  currentUserId,
  onEdit,
}: {
  task: TaskRow
  teamById: Map<string, TeamMember>
  currentUserId: string
  onEdit: () => void
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  const assignee = task.assigned_to ? teamById.get(task.assigned_to) : null
  const done = !!task.completed_at

  function toggleDone() {
    startTransition(async () => {
      const res = await setTaskComplete(task.id, !done)
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      router.refresh()
    })
  }

  function handleDelete() {
    if (!confirm(`Delete “${task.title}”?`)) return
    startTransition(async () => {
      const res = await deleteTask(task.id)
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success("Task deleted.")
      router.refresh()
    })
  }

  const dueLabel = task.due_date ? formatDueDate(task.due_date) : null
  const dueTone = task.due_date ? dueDateTone(task.due_date, done) : "neutral"

  return (
    <li
      className={cn(
        "group rounded-2xl border border-white/70 bg-white/65 backdrop-blur-xl px-4 py-3 shadow-[0_8px_28px_-18px_rgba(30,58,138,0.18)] transition hover:bg-white/80",
        done && "opacity-75",
      )}
    >
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={toggleDone}
          disabled={pending}
          aria-pressed={done}
          aria-label={done ? "Mark as open" : "Mark as done"}
          className={cn(
            "shrink-0 mt-0.5 h-5 w-5 rounded-full border-2 flex items-center justify-center transition",
            done
              ? "bg-emerald-500 border-emerald-500 text-white"
              : "border-slate-300 text-transparent hover:border-[#2340d9]",
            pending && "opacity-50",
          )}
        >
          <Check className="h-3 w-3" strokeWidth={3} />
        </button>

        <button
          type="button"
          onClick={onEdit}
          disabled={pending}
          className="min-w-0 flex-1 text-left"
          title="Edit task"
        >
          <div
            className={cn(
              "text-sm font-medium text-slate-900 break-words",
              done && "line-through text-slate-500",
            )}
          >
            {task.title}
          </div>
          {task.description && (
            <p className="text-xs text-slate-600 mt-0.5 line-clamp-2 whitespace-pre-wrap">
              {task.description}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1.5 text-xs">
            {assignee ? (
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium capitalize",
                  assignee.id === currentUserId
                    ? "bg-blue-100 text-blue-900"
                    : "bg-slate-100 text-slate-700",
                )}
              >
                <UserIcon className="h-3 w-3" />
                {assignee.name ?? assignee.email.split("@")[0]}
                {assignee.id === currentUserId && (
                  <span className="text-[10px] opacity-70">(you)</span>
                )}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-50 border border-dashed border-slate-300 px-2 py-0.5 text-slate-500">
                <UserIcon className="h-3 w-3" />
                Unassigned
              </span>
            )}
            {dueLabel && (
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium",
                  dueTone === "overdue" && "bg-rose-100 text-rose-800",
                  dueTone === "soon" && "bg-amber-100 text-amber-900",
                  dueTone === "neutral" && "bg-slate-100 text-slate-700",
                )}
              >
                <Calendar className="h-3 w-3" />
                {dueLabel}
              </span>
            )}
          </div>
        </button>

        <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={onEdit}
            disabled={pending}
            title="Edit"
          >
            <Pencil className="h-3.5 w-3.5" />
            <span className="sr-only">Edit</span>
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={handleDelete}
            disabled={pending}
            title="Delete"
            className="text-rose-600 hover:text-rose-700 hover:bg-rose-50"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span className="sr-only">Delete</span>
          </Button>
        </div>
      </div>
    </li>
  )
}

// ——————————————————————————————————————————————————————————
// Edit dialog
// ——————————————————————————————————————————————————————————

function EditDialog({
  task,
  team,
  onClose,
}: {
  task: TaskRow | null
  team: TeamMember[]
  onClose: () => void
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [assignee, setAssignee] = useState<string>("")
  const [dueDate, setDueDate] = useState<string>("")
  const [lastId, setLastId] = useState<string | null>(null)

  // Snap state to the active task without useEffect (project forbids
  // set-state-in-effect). Runs during render when the identity changes.
  if (task && task.id !== lastId) {
    setLastId(task.id)
    setTitle(task.title)
    setDescription(task.description)
    setAssignee(task.assigned_to ?? "")
    setDueDate(task.due_date ?? "")
  }

  function handleSave() {
    if (!task) return
    startTransition(async () => {
      const res = await updateTask(task.id, {
        title,
        description,
        assigned_to: assignee || null,
        due_date: dueDate || null,
      })
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success("Task saved.")
      onClose()
      router.refresh()
    })
  }

  return (
    <Dialog
      open={task !== null}
      onOpenChange={(v) => {
        if (!v && !pending) onClose()
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit task</DialogTitle>
        </DialogHeader>
        {task && (
          <div className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="task-title" className="text-xs text-slate-600">
                Title
              </Label>
              <Input
                id="task-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={pending}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="task-desc" className="text-xs text-slate-600">
                Description{" "}
                <span className="text-slate-400 font-normal">(optional)</span>
              </Label>
              <Textarea
                id="task-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                disabled={pending}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label
                  htmlFor="task-assignee"
                  className="text-xs text-slate-600"
                >
                  Assignee
                </Label>
                <AssigneeSelect
                  id="task-assignee"
                  value={assignee}
                  onChange={setAssignee}
                  team={team}
                  disabled={pending}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="task-due" className="text-xs text-slate-600">
                  Due date
                </Label>
                <Input
                  id="task-due"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  disabled={pending}
                />
              </div>
            </div>
            {task.completed_at && (
              <p className="text-xs text-emerald-700">
                Completed {new Date(task.completed_at).toLocaleDateString()}.
              </p>
            )}
          </div>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={pending || !title.trim()}>
            {pending ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ——————————————————————————————————————————————————————————
// Assignee picker (quick-create, compact) + full select (dialog)
// ——————————————————————————————————————————————————————————

function AssigneePicker({
  id,
  value,
  onChange,
  team,
  currentUserId,
  disabled,
  compact,
}: {
  id?: string
  value: string
  onChange: (v: string) => void
  team: TeamMember[]
  currentUserId: string
  disabled?: boolean
  compact?: boolean
}) {
  // Put the current user first so "me" is one click away.
  const ordered = [
    ...team.filter((m) => m.id === currentUserId),
    ...team.filter((m) => m.id !== currentUserId),
  ]
  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      aria-label="Assignee"
      className={cn(
        "flex h-9 rounded-md border border-input bg-background px-2 py-1 text-sm shadow-sm outline-none transition focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
        compact && "max-w-[150px]",
      )}
    >
      <option value="">Unassigned</option>
      {ordered.map((m) => (
        <option key={m.id} value={m.id}>
          {memberLabel(m)}
          {m.id === currentUserId ? " (me)" : ""}
        </option>
      ))}
    </select>
  )
}

function AssigneeSelect({
  id,
  value,
  onChange,
  team,
  disabled,
}: {
  id?: string
  value: string
  onChange: (v: string) => void
  team: TeamMember[]
  disabled?: boolean
}) {
  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm outline-none transition focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
    >
      <option value="">Unassigned</option>
      {team.map((m) => (
        <option key={m.id} value={m.id}>
          {memberLabel(m)}
        </option>
      ))}
    </select>
  )
}

function DueDatePicker({
  id,
  value,
  onChange,
  disabled,
  compact,
}: {
  id?: string
  value: string
  onChange: (v: string) => void
  disabled?: boolean
  compact?: boolean
}) {
  return (
    <Input
      id={id}
      type="date"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      aria-label="Due date"
      className={cn(compact && "max-w-[160px]")}
    />
  )
}

// ——————————————————————————————————————————————————————————
// Date helpers
// ——————————————————————————————————————————————————————————

/**
 * Parse a YYYY-MM-DD date string as a local-time date (not UTC midnight).
 * `new Date("2026-04-20")` would parse as UTC which can shift the day in
 * negative-offset timezones.
 */
function parseDueDate(raw: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw)
  if (!m) return null
  const y = Number(m[1])
  const mo = Number(m[2]) - 1
  const d = Number(m[3])
  const date = new Date(y, mo, d)
  if (Number.isNaN(date.getTime())) return null
  return date
}

function formatDueDate(raw: string): string {
  const d = parseDueDate(raw)
  if (!d) return raw
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const diffDays = Math.floor(
    (d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
  )
  if (diffDays === 0) return "Today"
  if (diffDays === 1) return "Tomorrow"
  if (diffDays === -1) return "Yesterday"
  if (diffDays < -1) return `${Math.abs(diffDays)}d overdue`
  if (diffDays < 7) return d.toLocaleDateString("en-US", { weekday: "short" })
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

function dueDateTone(
  raw: string,
  done: boolean,
): "overdue" | "soon" | "neutral" {
  if (done) return "neutral"
  const d = parseDueDate(raw)
  if (!d) return "neutral"
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const diffDays = Math.floor(
    (d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
  )
  if (diffDays < 0) return "overdue"
  if (diffDays <= 3) return "soon"
  return "neutral"
}

function memberLabel(m: TeamMember) {
  return m.name ?? m.email.split("@")[0]
}
