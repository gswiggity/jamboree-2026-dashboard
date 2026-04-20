import { createClient } from "@/lib/supabase/server"
import { VolunteersShell } from "./volunteers-shell"
import type {
  AssignmentRow,
  RoleRow,
  ShiftRow,
  VolunteerRow,
} from "./types"

export default async function VolunteersPage() {
  const supabase = await createClient()

  const [
    { data: roles },
    { data: shifts },
    { data: assignments },
    { data: volunteers },
  ] = await Promise.all([
    supabase
      .from("volunteer_roles")
      .select("key, label, sort_order")
      .order("sort_order", { ascending: true })
      .order("label", { ascending: true }),
    supabase
      .from("volunteer_shifts")
      .select(
        "id, role_key, day, start_time, end_time, required_count, location, notes, created_at",
      )
      .order("day", { ascending: true })
      .order("start_time", { ascending: true }),
    supabase
      .from("volunteer_shift_assignments")
      .select("shift_id, volunteer_id, assigned_at"),
    supabase
      .from("submissions")
      .select("id, name, email")
      .eq("type", "volunteer")
      .order("name", { ascending: true, nullsFirst: false }),
  ])

  const roleRows: RoleRow[] = (roles ?? []).map((r) => ({
    key: r.key,
    label: r.label,
    sort_order: r.sort_order,
  }))

  const shiftRows: ShiftRow[] = (shifts ?? []).map((s) => ({
    id: s.id,
    role_key: s.role_key,
    day: s.day,
    start_time: s.start_time,
    end_time: s.end_time,
    required_count: s.required_count,
    location: s.location,
    notes: s.notes,
  }))

  const assignmentRows: AssignmentRow[] = (assignments ?? []).map((a) => ({
    shift_id: a.shift_id,
    volunteer_id: a.volunteer_id,
  }))

  const volunteerRows: VolunteerRow[] = (volunteers ?? []).map((v) => ({
    id: v.id,
    name: v.name,
    email: v.email,
  }))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Volunteers</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Schedule shifts, assign volunteers, and keep an eye on coverage.
        </p>
      </div>

      <VolunteersShell
        roles={roleRows}
        shifts={shiftRows}
        assignments={assignmentRows}
        volunteers={volunteerRows}
      />
    </div>
  )
}
