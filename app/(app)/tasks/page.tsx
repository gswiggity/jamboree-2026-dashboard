import { createClient } from "@/lib/supabase/server"
import { PageHeader } from "@/components/ui/page-header"
import { TasksShell, type TaskRow, type TeamMember } from "./tasks-shell"

export default async function TasksPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const [{ data: tasks }, { data: profiles }] = await Promise.all([
    supabase
      .from("tasks")
      .select(
        "id, title, description, due_date, assigned_to, created_by, completed_at, completed_by, created_at, updated_at",
      )
      // Open first (completed_at null), then by due_date (nulls last), then
      // newest-created. Postgres orders NULLs last on asc by default.
      .order("completed_at", { ascending: true, nullsFirst: true })
      .order("due_date", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false }),
    supabase
      .from("profiles")
      .select("id, full_name, email")
      .order("full_name", { ascending: true, nullsFirst: false }),
  ])

  const team: TeamMember[] = (profiles ?? []).map((p) => ({
    id: p.id,
    name: p.full_name,
    email: p.email,
  }))

  const rows: TaskRow[] = (tasks ?? []).map((t) => ({
    id: t.id,
    title: t.title,
    description: t.description,
    due_date: t.due_date,
    assigned_to: t.assigned_to,
    created_by: t.created_by,
    completed_at: t.completed_at,
    completed_by: t.completed_by,
    created_at: t.created_at,
    updated_at: t.updated_at,
  }))

  return (
    <div className="space-y-6">
      <PageHeader
        kicker="Tasks"
        title="Punch"
        accent="list"
        description="Action items across the festival — assign them, give them a due date, check them off when they're done."
      />

      <TasksShell tasks={rows} team={team} currentUserId={user!.id} />
    </div>
  )
}
