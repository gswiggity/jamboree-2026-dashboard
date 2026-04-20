-- Tasks: cross-cutting action items for the organizing team
-- ("buy volunteer lanyards", "email lineup announcement", etc.). Any team
-- member can create, assign, and complete tasks. Hard-delete OK.

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  due_date date,
  assigned_to uuid references public.profiles(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  completed_at timestamptz,                         -- null = open, set = done
  completed_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index tasks_assigned_to_idx on public.tasks (assigned_to);
create index tasks_completed_at_idx on public.tasks (completed_at);
create index tasks_due_date_idx on public.tasks (due_date);
create index tasks_created_at_idx on public.tasks (created_at desc);

alter table public.tasks enable row level security;

-- Same sharing model as documents/phases: three organizers, everything shared.
create policy "authenticated read tasks"
  on public.tasks for select
  to authenticated
  using (true);

create policy "authenticated insert tasks"
  on public.tasks for insert
  to authenticated
  with check (true);

create policy "authenticated update tasks"
  on public.tasks for update
  to authenticated
  using (true) with check (true);

create policy "authenticated delete tasks"
  on public.tasks for delete
  to authenticated
  using (true);

create trigger tasks_set_updated_at
  before update on public.tasks
  for each row execute function public.set_updated_at();
