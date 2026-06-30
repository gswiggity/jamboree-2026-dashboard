"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Calendar,
  Clock,
  MapPin,
  Pencil,
  Plus,
  Trash2,
  Users,
} from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { fitForShift } from "@/lib/volunteer-availability"
import type { VolunteerAvailability } from "@/lib/volunteer-availability"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  createShift,
  createVolunteerRole,
  deleteShift,
  deleteVolunteerRole,
  setShiftAssignments,
  updateShift,
  updateVolunteerRole,
} from "./actions"
import { ShiftDialog } from "./shift-dialog"
import { AssignDialog } from "./assign-dialog"
import { Roster } from "./roster"
import type {
  AssignmentRow,
  RoleRow,
  ShiftRow,
  ShowBlockRow,
  VolunteerRow,
} from "./types"

type ShellProps = {
  roles: RoleRow[]
  shifts: ShiftRow[]
  assignments: AssignmentRow[]
  volunteers: VolunteerRow[]
  shows: ShowBlockRow[]
  availability: Record<string, VolunteerAvailability>
}

export function VolunteersShell({
  roles,
  shifts,
  assignments,
  volunteers,
  shows,
  availability,
}: ShellProps) {
  const [editingShift, setEditingShift] = useState<ShiftRow | null>(null)
  const [creatingShift, setCreatingShift] = useState(false)
  const [assigningShift, setAssigningShift] = useState<ShiftRow | null>(null)

  const rolesByKey = useMemo(
    () => new Map(roles.map((r) => [r.key, r])),
    [roles],
  )
  const volunteersById = useMemo(
    () => new Map(volunteers.map((v) => [v.id, v])),
    [volunteers],
  )

  // shift_id → volunteer_ids
  const assignmentsByShift = useMemo(() => {
    const m = new Map<string, string[]>()
    for (const a of assignments) {
      const arr = m.get(a.shift_id)
      if (arr) arr.push(a.volunteer_id)
      else m.set(a.shift_id, [a.volunteer_id])
    }
    return m
  }, [assignments])

  // Top-line stats.
  const stats = useMemo(() => {
    let required = 0
    let filled = 0
    for (const s of shifts) {
      required += s.required_count
      filled += Math.min(
        s.required_count,
        assignmentsByShift.get(s.id)?.length ?? 0,
      )
    }
    return {
      shifts: shifts.length,
      required,
      filled,
      gap: Math.max(0, required - filled),
      volunteers: volunteers.length,
    }
  }, [shifts, assignmentsByShift, volunteers.length])

  return (
    <div className="space-y-5">
      <StatsBar stats={stats} />

      <Tabs defaultValue="schedule" className="gap-5">
        <TabsList>
          <TabsTrigger value="schedule">Schedule</TabsTrigger>
          <TabsTrigger value="roster">
            Roster
            <span className="ml-1.5 text-slate-400 font-normal tabular-nums">
              {volunteers.length}
            </span>
          </TabsTrigger>
          <TabsTrigger value="roles">Roles</TabsTrigger>
        </TabsList>

        <TabsContent value="schedule" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-700">
              Shifts
              <span className="ml-2 text-slate-400 font-normal tabular-nums">
                {shifts.length}
              </span>
            </h2>
            <Button
              type="button"
              size="sm"
              onClick={() => setCreatingShift(true)}
              disabled={roles.length === 0}
              title={
                roles.length === 0
                  ? "Create a role on the Roles tab first."
                  : "Add a shift"
              }
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              Add shift
            </Button>
          </div>

          {shifts.length === 0 && shows.length === 0 ? (
            <EmptyState
              title="No shifts yet."
              body={
                roles.length === 0
                  ? "Add a role first, then schedule shifts for it."
                  : "Add your first shift to start scheduling coverage."
              }
            />
          ) : (
            <ScheduleByDay
              shifts={shifts}
              shows={shows}
              rolesByKey={rolesByKey}
              assignmentsByShift={assignmentsByShift}
              volunteersById={volunteersById}
              availability={availability}
              volunteers={volunteers}
              onEdit={setEditingShift}
              onAssign={setAssigningShift}
            />
          )}
        </TabsContent>

        <TabsContent value="roster" className="space-y-4">
          <Roster
            volunteers={volunteers}
            availability={availability}
            rolesByKey={rolesByKey}
          />
        </TabsContent>

        <TabsContent value="roles" className="space-y-4">
          <RolesPanel roles={roles} />
        </TabsContent>
      </Tabs>

      <ShiftDialog
        mode={creatingShift ? "create" : editingShift ? "edit" : "closed"}
        initial={editingShift}
        roles={roles}
        onClose={() => {
          setCreatingShift(false)
          setEditingShift(null)
        }}
        onSubmit={async (input) => {
          if (creatingShift) return createShift(input)
          if (editingShift) return updateShift(editingShift.id, input)
          return { ok: false as const, error: "No shift open for edit." }
        }}
        onDelete={
          editingShift
            ? async () => {
                const res = await deleteShift(editingShift.id)
                return res
              }
            : undefined
        }
      />

      <AssignDialog
        shift={assigningShift}
        rolesByKey={rolesByKey}
        volunteers={volunteers}
        availability={availability}
        currentAssignments={
          assigningShift
            ? (assignmentsByShift.get(assigningShift.id) ?? [])
            : []
        }
        onClose={() => setAssigningShift(null)}
        onSubmit={async (volunteerIds) => {
          if (!assigningShift) {
            return { ok: false as const, error: "No shift open." }
          }
          return setShiftAssignments(assigningShift.id, volunteerIds)
        }}
      />
    </div>
  )
}

// ——————————————————————————————————————————————————————————
// Stats bar
// ——————————————————————————————————————————————————————————

function StatsBar({
  stats,
}: {
  stats: {
    shifts: number
    required: number
    filled: number
    gap: number
    volunteers: number
  }
}) {
  const pct = stats.required === 0 ? 0 : stats.filled / stats.required
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
      <Stat label="Shifts" value={stats.shifts} />
      <Stat
        label="Coverage"
        value={`${stats.filled}/${stats.required}`}
        sub={`${Math.round(pct * 100)}%`}
        tone={
          stats.required === 0
            ? "neutral"
            : pct >= 1
              ? "good"
              : pct >= 0.66
                ? "warn"
                : "alert"
        }
      />
      <Stat
        label="Gap"
        value={stats.gap}
        tone={stats.gap === 0 ? "good" : "alert"}
      />
      <Stat label="Volunteer pool" value={stats.volunteers} />
    </div>
  )
}

function Stat({
  label,
  value,
  sub,
  tone = "neutral",
}: {
  label: string
  value: number | string
  sub?: string
  tone?: "neutral" | "good" | "warn" | "alert"
}) {
  const toneClasses = {
    neutral: "text-slate-900",
    good: "text-emerald-700",
    warn: "text-amber-700",
    alert: "text-rose-700",
  }[tone]
  return (
    <div className="rounded-2xl border border-white/70 bg-white/65 backdrop-blur-xl px-4 py-3 shadow-[0_8px_28px_-18px_rgba(30,58,138,0.18)]">
      <div className="text-[10px] uppercase tracking-[0.18em] font-semibold text-slate-500">
        {label}
      </div>
      <div className="mt-1 flex items-baseline gap-1.5">
        <span className={cn("text-2xl font-semibold tabular-nums", toneClasses)}>
          {value}
        </span>
        {sub && (
          <span className="text-xs font-medium text-slate-500 tabular-nums">
            {sub}
          </span>
        )}
      </div>
    </div>
  )
}

// ——————————————————————————————————————————————————————————
// Schedule — show calendar + shifts, grouped by day
// ——————————————————————————————————————————————————————————

function ScheduleByDay({
  shifts,
  shows,
  rolesByKey,
  assignmentsByShift,
  volunteersById,
  availability,
  volunteers,
  onEdit,
  onAssign,
}: {
  shifts: ShiftRow[]
  shows: ShowBlockRow[]
  rolesByKey: Map<string, RoleRow>
  assignmentsByShift: Map<string, string[]>
  volunteersById: Map<string, VolunteerRow>
  availability: Record<string, VolunteerAvailability>
  volunteers: VolunteerRow[]
  onEdit: (shift: ShiftRow) => void
  onAssign: (shift: ShiftRow) => void
}) {
  // Build one section per day, drawn from the union of show days and shift
  // days so the schedule shows even before any shifts exist for it.
  const days = useMemo(() => {
    const shiftsByDay = new Map<string, ShiftRow[]>()
    const showsByDay = new Map<string, ShowBlockRow[]>()
    for (const s of shifts) {
      const arr = shiftsByDay.get(s.day)
      if (arr) arr.push(s)
      else shiftsByDay.set(s.day, [s])
    }
    for (const b of shows) {
      const arr = showsByDay.get(b.day)
      if (arr) arr.push(b)
      else showsByDay.set(b.day, [b])
    }
    const allDays = new Set<string>([...shiftsByDay.keys(), ...showsByDay.keys()])
    return Array.from(allDays)
      .sort((a, b) => a.localeCompare(b))
      .map((day) => ({
        day,
        shifts: shiftsByDay.get(day) ?? [],
        shows: showsByDay.get(day) ?? [],
      }))
  }, [shifts, shows])

  return (
    <div className="space-y-6">
      {days.map(({ day, shifts: dayShifts, shows: dayShows }) => (
        <section key={day} className="space-y-2">
          <div className="flex items-center gap-2 px-1">
            <Calendar className="h-3.5 w-3.5 text-slate-500" />
            <h2 className="text-[11px] uppercase tracking-[0.22em] font-semibold text-slate-600">
              {formatDay(day)}
            </h2>
            <span className="text-[10px] tabular-nums text-slate-500">
              {dayShifts.length} shift{dayShifts.length === 1 ? "" : "s"}
            </span>
          </div>

          {dayShows.length > 0 && <ShowStrip shows={dayShows} />}

          {dayShifts.length === 0 ? (
            <p className="text-[11px] text-slate-400 px-1 italic">
              No volunteer shifts scheduled for this day yet.
            </p>
          ) : (
            <ul className="space-y-2">
              {dayShifts.map((s) => (
                <ShiftCard
                  key={s.id}
                  shift={s}
                  role={rolesByKey.get(s.role_key)}
                  assignedIds={assignmentsByShift.get(s.id) ?? []}
                  volunteersById={volunteersById}
                  availability={availability}
                  volunteers={volunteers}
                  onEdit={() => onEdit(s)}
                  onAssign={() => onAssign(s)}
                />
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  )
}

// Read-only reference rail of the day's programmed blocks (shows / workshops /
// events) so you can see what's happening when carving out shifts.
function ShowStrip({ shows }: { shows: ShowBlockRow[] }) {
  const kindStyle: Record<string, string> = {
    show: "bg-blue-50/80 border-blue-200/70 text-blue-900",
    workshop: "bg-violet-50/80 border-violet-200/70 text-violet-900",
    event: "bg-slate-50/80 border-slate-200/70 text-slate-700",
  }
  return (
    <div className="flex flex-wrap gap-1.5 px-1">
      {shows.map((b) => (
        <span
          key={b.id}
          title={[b.title ?? "", b.location ?? ""].filter(Boolean).join(" · ")}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[11px] max-w-[14rem]",
            kindStyle[b.kind ?? "event"] ?? kindStyle.event,
          )}
        >
          <span className="tabular-nums font-medium shrink-0">
            {formatTime(b.start_time)}
          </span>
          <span className="truncate">{b.title ?? "Untitled"}</span>
        </span>
      ))}
    </div>
  )
}

function ShiftCard({
  shift,
  role,
  assignedIds,
  volunteersById,
  availability,
  volunteers,
  onEdit,
  onAssign,
}: {
  shift: ShiftRow
  role: RoleRow | undefined
  assignedIds: string[]
  volunteersById: Map<string, VolunteerRow>
  availability: Record<string, VolunteerAvailability>
  volunteers: VolunteerRow[]
  onEdit: () => void
  onAssign: () => void
}) {
  const filled = assignedIds.length
  const needed = shift.required_count
  const tone =
    filled >= needed ? "good" : filled === 0 ? "alert" : "warn"

  const toneChip = {
    good: "bg-emerald-100 text-emerald-800",
    warn: "bg-amber-100 text-amber-900",
    alert: "bg-rose-100 text-rose-800",
  }[tone]

  // Count assigned people whose availability conflicts with this shift, and how
  // many free-and-available volunteers are still unassigned in the pool.
  const assignedSet = new Set(assignedIds)
  const conflicts = assignedIds.reduce((n, id) => {
    const av = availability[id]
    if (!av) return n
    const f = fitForShift(av, shift)
    return f.status === "day" || f.status === "time" ? n + 1 : n
  }, 0)
  const poolAvailable =
    needed > filled
      ? volunteers.reduce((n, v) => {
          if (assignedSet.has(v.id)) return n
          const av = availability[v.id]
          return av && fitForShift(av, shift).status === "available" ? n + 1 : n
        }, 0)
      : 0

  return (
    <li className="group rounded-2xl border border-white/70 bg-white/65 backdrop-blur-xl px-4 py-3 shadow-[0_8px_28px_-18px_rgba(30,58,138,0.18)] transition hover:bg-white/80">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-sm font-semibold text-slate-900">
              {role?.label ?? shift.role_key}
            </span>
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium tabular-nums",
                toneChip,
              )}
            >
              <Users className="h-3 w-3" />
              {filled}/{needed} filled
            </span>
            {conflicts > 0 && (
              <span
                className="inline-flex items-center gap-1 rounded-full bg-rose-100 text-rose-800 px-2 py-0.5 text-[11px] font-medium"
                title="Assigned volunteers who aren't available at this day/time per their sign-up."
              >
                <AlertTriangle className="h-3 w-3" />
                {conflicts} conflict{conflicts === 1 ? "" : "s"}
              </span>
            )}
            {poolAvailable > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100 px-2 py-0.5 text-[11px] font-medium tabular-nums">
                {poolAvailable} available
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-slate-600">
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatTimeRange(shift.start_time, shift.end_time)}
            </span>
            {shift.location && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {shift.location}
              </span>
            )}
          </div>
          {shift.notes && (
            <p className="text-xs text-slate-500 mt-1.5 whitespace-pre-wrap">
              {shift.notes}
            </p>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {assignedIds.length === 0 ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-50 border border-dashed border-slate-300 px-2 py-0.5 text-[11px] text-slate-500">
                No one assigned yet
              </span>
            ) : (
              assignedIds.map((id) => {
                const v = volunteersById.get(id)
                const name =
                  v?.name ?? v?.email?.split("@")[0] ?? "Unknown volunteer"
                const av = availability[id]
                const f = av ? fitForShift(av, shift) : null
                const conflicted = f?.status === "day" || f?.status === "time"
                return (
                  <span
                    key={id}
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium",
                      conflicted
                        ? "bg-rose-50 border-rose-200 text-rose-800"
                        : "bg-blue-50 border-blue-100 text-blue-900",
                    )}
                    title={
                      conflicted
                        ? f?.status === "day"
                          ? `${name} isn't available this day per their sign-up.`
                          : `${name} signed up for a different time of day.`
                        : (v?.email ?? undefined)
                    }
                  >
                    {conflicted && <AlertTriangle className="h-3 w-3" />}
                    {name}
                  </span>
                )
              })
            )}
          </div>
        </div>

        <div className="flex flex-col gap-1 shrink-0">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={onAssign}
          >
            <Users className="h-3.5 w-3.5 mr-1" />
            Assign
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={onEdit}
            className="text-slate-600"
          >
            <Pencil className="h-3.5 w-3.5 mr-1" />
            Edit
          </Button>
        </div>
      </div>
    </li>
  )
}

// ——————————————————————————————————————————————————————————
// Roles panel — manage the role catalog.
// ——————————————————————————————————————————————————————————

function RolesPanel({ roles }: { roles: RoleRow[] }) {
  const router = useRouter()
  const [newLabel, setNewLabel] = useState("")
  const [pending, startTransition] = useTransition()

  function handleAdd() {
    const label = newLabel.trim()
    if (!label) return
    startTransition(async () => {
      const res = await createVolunteerRole({ label })
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success(`Added "${label}".`)
      setNewLabel("")
      router.refresh()
    })
  }

  return (
    <div className="space-y-4">
      <form
        onSubmit={(e) => {
          e.preventDefault()
          handleAdd()
        }}
        className="rounded-2xl border border-white/70 bg-white/65 backdrop-blur-xl p-3 shadow-[0_8px_28px_-18px_rgba(30,58,138,0.18)]"
      >
        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1 flex-1 min-w-[220px]">
            <Label
              htmlFor="role-label"
              className="text-[10px] uppercase tracking-[0.18em] font-semibold text-slate-500"
            >
              New role
            </Label>
            <Input
              id="role-label"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder="e.g. Hospitality lead"
              disabled={pending}
            />
          </div>
          <Button
            type="submit"
            size="sm"
            disabled={pending || !newLabel.trim()}
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            {pending ? "Adding…" : "Add role"}
          </Button>
        </div>
      </form>

      {roles.length === 0 ? (
        <EmptyState
          title="No roles yet."
          body="Add a role to start scheduling shifts."
        />
      ) : (
        <ul className="divide-y divide-slate-200/60 rounded-2xl border border-slate-200/70 overflow-hidden bg-white/40 text-sm">
          {roles.map((r, idx) => (
            <RoleItem
              key={r.key}
              role={r}
              isFirst={idx === 0}
              isLast={idx === roles.length - 1}
              prev={roles[idx - 1]}
              next={roles[idx + 1]}
            />
          ))}
        </ul>
      )}
    </div>
  )
}

function RoleItem({
  role,
  isFirst,
  isLast,
  prev,
  next,
}: {
  role: RoleRow
  isFirst: boolean
  isLast: boolean
  prev: RoleRow | undefined
  next: RoleRow | undefined
}) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [label, setLabel] = useState(role.label)
  const [pending, startTransition] = useTransition()

  // Keep the draft in sync when a re-render brings a new label in.
  if (!editing && label !== role.label) setLabel(role.label)

  function saveLabel() {
    const trimmed = label.trim()
    if (!trimmed || trimmed === role.label) {
      setEditing(false)
      return
    }
    startTransition(async () => {
      const res = await updateVolunteerRole(role.key, { label: trimmed })
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      setEditing(false)
      toast.success("Role updated.")
      router.refresh()
    })
  }

  function handleDelete() {
    if (
      !confirm(
        `Delete the "${role.label}" role? You'll need to reassign any shifts that use it first.`,
      )
    )
      return
    startTransition(async () => {
      const res = await deleteVolunteerRole(role.key)
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success("Role deleted.")
      router.refresh()
    })
  }

  function moveUp() {
    if (!prev) return
    startTransition(async () => {
      // Simple swap of sort_order between neighbors.
      const res1 = await updateVolunteerRole(role.key, {
        sort_order: prev.sort_order,
      })
      const res2 = await updateVolunteerRole(prev.key, {
        sort_order: role.sort_order,
      })
      if (!res1.ok || !res2.ok) {
        toast.error(
          (!res1.ok && res1.error) ||
            (!res2.ok && res2.error) ||
            "Failed to reorder.",
        )
        return
      }
      router.refresh()
    })
  }

  function moveDown() {
    if (!next) return
    startTransition(async () => {
      const res1 = await updateVolunteerRole(role.key, {
        sort_order: next.sort_order,
      })
      const res2 = await updateVolunteerRole(next.key, {
        sort_order: role.sort_order,
      })
      if (!res1.ok || !res2.ok) {
        toast.error(
          (!res1.ok && res1.error) ||
            (!res2.ok && res2.error) ||
            "Failed to reorder.",
        )
        return
      }
      router.refresh()
    })
  }

  return (
    <li className="py-2.5 px-3 flex items-center gap-3 bg-white/40">
      <div className="flex flex-col">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={moveUp}
          disabled={isFirst || pending}
          title="Move up"
          className="h-5 w-5"
        >
          <ArrowUp className="h-3 w-3" />
          <span className="sr-only">Move up</span>
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={moveDown}
          disabled={isLast || pending}
          title="Move down"
          className="h-5 w-5"
        >
          <ArrowDown className="h-3 w-3" />
          <span className="sr-only">Move down</span>
        </Button>
      </div>
      <div className="min-w-0 flex-1">
        {editing ? (
          <Input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onBlur={saveLabel}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault()
                saveLabel()
              }
              if (e.key === "Escape") {
                setLabel(role.label)
                setEditing(false)
              }
            }}
            disabled={pending}
            autoFocus
            className="h-8"
          />
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="font-medium text-slate-900 hover:text-[#2340d9] text-left"
          >
            {role.label}
          </button>
        )}
        <div className="text-[10px] text-slate-500 font-mono mt-0.5">
          {role.key}
        </div>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => setEditing(true)}
        disabled={pending || editing}
        title="Rename"
      >
        <Pencil className="h-3.5 w-3.5" />
        <span className="sr-only">Rename</span>
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={handleDelete}
        disabled={pending}
        title="Delete role"
        className="text-rose-600 hover:text-rose-700 hover:bg-rose-50"
      >
        <Trash2 className="h-3.5 w-3.5" />
        <span className="sr-only">Delete</span>
      </Button>
    </li>
  )
}

// ——————————————————————————————————————————————————————————
// Helpers & small components
// ——————————————————————————————————————————————————————————

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white/40 p-10 text-center">
      <p className="text-sm text-slate-700 font-medium">{title}</p>
      <p className="text-xs text-slate-500 mt-1">{body}</p>
    </div>
  )
}

function formatDay(day: string): string {
  // Parse as local date to avoid UTC-shift surprises.
  const [y, m, d] = day.split("-").map((n) => parseInt(n, 10))
  if (!y || !m || !d) return day
  const date = new Date(y, m - 1, d)
  return date.toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  })
}

function formatTimeRange(start: string, end: string): string {
  return `${formatTime(start)} – ${formatTime(end)}`
}

function formatTime(t: string): string {
  // t is "HH:mm:ss" or "HH:mm". Render as e.g. "6:30 PM".
  const [hStr, mStr] = t.split(":")
  const h = parseInt(hStr, 10)
  const m = parseInt(mStr ?? "0", 10)
  if (!Number.isFinite(h) || !Number.isFinite(m)) return t
  const ampm = h >= 12 ? "PM" : "AM"
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h
  const mm = m.toString().padStart(2, "0")
  return `${h12}:${mm} ${ampm}`
}
