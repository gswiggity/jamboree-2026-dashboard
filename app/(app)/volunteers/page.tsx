import { createClient } from "@/lib/supabase/server"
import { PageHeader } from "@/components/ui/page-header"
import { parseAvailability } from "@/lib/volunteer-availability"
import type { VolunteerAvailability } from "@/lib/volunteer-availability"
import { VolunteersShell } from "./volunteers-shell"
import type {
  AssignmentRow,
  RoleRow,
  ShiftRow,
  ShowBlockRow,
  VolunteerRow,
} from "./types"

export default async function VolunteersPage() {
  const supabase = await createClient()

  // The published schedule is the one to staff against.
  const { data: publishedDraft } = await supabase
    .from("programming_drafts")
    .select("id")
    .eq("is_published", true)
    .maybeSingle()

  const [
    { data: roles },
    { data: shifts },
    { data: assignments },
    { data: volunteers },
    { data: blocks },
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
      .select("id, name, email, data")
      .eq("type", "volunteer")
      .is("deleted_at", null)
      .order("name", { ascending: true, nullsFirst: false }),
    publishedDraft
      ? supabase
          .from("show_blocks")
          .select("id, day, start_time, end_time, title, location, kind")
          .eq("draft_id", publishedDraft.id)
          .order("day", { ascending: true })
          .order("start_time", { ascending: true })
      : Promise.resolve({ data: [] as ShowBlockRow[] }),
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

  // Parse each volunteer's sign-up answers into structured availability,
  // keyed by id for the shell to cross-reference against shifts.
  const availability: Record<string, VolunteerAvailability> = {}
  for (const v of volunteers ?? []) {
    availability[v.id] = parseAvailability(
      v.data as Record<string, unknown> | null,
    )
  }

  const showRows: ShowBlockRow[] = (blocks ?? []).map((b) => ({
    id: b.id,
    day: b.day,
    start_time: b.start_time,
    end_time: b.end_time,
    title: b.title,
    location: b.location,
    kind: b.kind,
  }))

  return (
    <div className="space-y-6">
      <PageHeader
        kicker="Volunteers"
        title="Crew"
        accent="schedule"
        description="Schedule shifts against the show calendar, assign volunteers by availability, and keep an eye on coverage."
      />

      <VolunteersShell
        roles={roleRows}
        shifts={shiftRows}
        assignments={assignmentRows}
        volunteers={volunteerRows}
        shows={showRows}
        availability={availability}
      />
    </div>
  )
}
