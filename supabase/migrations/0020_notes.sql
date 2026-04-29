-- Notes: shared bulletin board for the 3-organizer team. Quick comments
-- and notes that don't belong on a task or a submission. Pinned notes
-- float to the top.

create table public.notes (
  id uuid primary key default gen_random_uuid(),
  body text not null check (length(body) > 0),
  created_by uuid references public.profiles(id) on delete set null,
  pinned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index notes_created_at_idx on public.notes (created_at desc);
create index notes_pinned_idx on public.notes (pinned) where pinned;

alter table public.notes enable row level security;

-- Same sharing model as tasks: 3 organizers, everything shared.
create policy "authenticated read notes"
  on public.notes for select
  to authenticated
  using (true);

create policy "authenticated insert notes"
  on public.notes for insert
  to authenticated
  with check (true);

create policy "authenticated update notes"
  on public.notes for update
  to authenticated
  using (true) with check (true);

create policy "authenticated delete notes"
  on public.notes for delete
  to authenticated
  using (true);

create trigger notes_set_updated_at
  before update on public.notes
  for each row execute function public.set_updated_at();
