-- Volunteers: shift scheduling + role management. The volunteer pool itself
-- lives in `submissions` where `type = 'volunteer'` (imported from CSV).
-- This migration adds three tables:
--
--   volunteer_roles        — reusable role catalog (usher, stage-manager, etc.)
--   volunteer_shifts       — when + where + which role is needed
--   volunteer_shift_assignments — join: which volunteer is on which shift
--
-- Same sharing model as tasks/documents: three organizers, everything shared.

-- ————————————————————————————————————————————————————————————
-- volunteer_roles
-- ————————————————————————————————————————————————————————————

create table public.volunteer_roles (
  key text primary key check (key = lower(key) and length(key) between 1 and 48),
  label text not null,
  sort_order int not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index volunteer_roles_sort_idx
  on public.volunteer_roles (sort_order, label);

alter table public.volunteer_roles enable row level security;

create policy "authenticated read volunteer_roles"
  on public.volunteer_roles for select
  to authenticated
  using (true);

create policy "authenticated insert volunteer_roles"
  on public.volunteer_roles for insert
  to authenticated
  with check (true);

create policy "authenticated update volunteer_roles"
  on public.volunteer_roles for update
  to authenticated
  using (true) with check (true);

create policy "authenticated delete volunteer_roles"
  on public.volunteer_roles for delete
  to authenticated
  using (true);

create trigger volunteer_roles_set_updated_at
  before update on public.volunteer_roles
  for each row execute function public.set_updated_at();

-- Seed a sensible starter set. Admins can add more free-text in the UI.
insert into public.volunteer_roles (key, label, sort_order) values
  ('front-of-house', 'Front of house', 10),
  ('usher',          'Usher',          20),
  ('greeter',        'Greeter',        30),
  ('stage-manager',  'Stage manager',  40),
  ('tech-assist',    'Tech assist',    50),
  ('green-room',     'Green room',     60)
on conflict (key) do nothing;

-- ————————————————————————————————————————————————————————————
-- volunteer_shifts
-- ————————————————————————————————————————————————————————————

create table public.volunteer_shifts (
  id uuid primary key default gen_random_uuid(),
  role_key text not null references public.volunteer_roles(key)
    on update cascade on delete restrict,
  day date not null,
  start_time time not null,
  end_time time not null,
  required_count int not null default 1 check (required_count >= 1),
  location text not null default '',
  notes text not null default '',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_time > start_time)
);

create index volunteer_shifts_day_idx
  on public.volunteer_shifts (day, start_time);
create index volunteer_shifts_role_key_idx
  on public.volunteer_shifts (role_key);

alter table public.volunteer_shifts enable row level security;

create policy "authenticated read volunteer_shifts"
  on public.volunteer_shifts for select
  to authenticated
  using (true);

create policy "authenticated insert volunteer_shifts"
  on public.volunteer_shifts for insert
  to authenticated
  with check (true);

create policy "authenticated update volunteer_shifts"
  on public.volunteer_shifts for update
  to authenticated
  using (true) with check (true);

create policy "authenticated delete volunteer_shifts"
  on public.volunteer_shifts for delete
  to authenticated
  using (true);

create trigger volunteer_shifts_set_updated_at
  before update on public.volunteer_shifts
  for each row execute function public.set_updated_at();

-- ————————————————————————————————————————————————————————————
-- volunteer_shift_assignments (join)
-- ————————————————————————————————————————————————————————————
--
-- volunteer_id references public.submissions.id. A trigger enforces that
-- the referenced submission has type='volunteer' — we can't express that
-- with a straight FK or check. On shift delete we cascade; on volunteer
-- delete we cascade (if you remove a volunteer submission you lose their
-- shift rows too).

create table public.volunteer_shift_assignments (
  shift_id uuid not null references public.volunteer_shifts(id) on delete cascade,
  volunteer_id uuid not null references public.submissions(id) on delete cascade,
  assigned_by uuid references public.profiles(id) on delete set null,
  assigned_at timestamptz not null default now(),
  primary key (shift_id, volunteer_id)
);

create index volunteer_shift_assignments_volunteer_idx
  on public.volunteer_shift_assignments (volunteer_id);

alter table public.volunteer_shift_assignments enable row level security;

create policy "authenticated read volunteer_shift_assignments"
  on public.volunteer_shift_assignments for select
  to authenticated
  using (true);

create policy "authenticated insert volunteer_shift_assignments"
  on public.volunteer_shift_assignments for insert
  to authenticated
  with check (true);

create policy "authenticated update volunteer_shift_assignments"
  on public.volunteer_shift_assignments for update
  to authenticated
  using (true) with check (true);

create policy "authenticated delete volunteer_shift_assignments"
  on public.volunteer_shift_assignments for delete
  to authenticated
  using (true);

-- Ensure the submission referenced is a volunteer, not an act/workshop.
create or replace function public.assert_volunteer_assignment()
returns trigger language plpgsql as $$
declare
  s_type text;
begin
  select type into s_type
    from public.submissions
    where id = new.volunteer_id;
  if s_type is null then
    raise exception 'submission % does not exist', new.volunteer_id;
  end if;
  if s_type <> 'volunteer' then
    raise exception 'submission % is type %, expected volunteer', new.volunteer_id, s_type;
  end if;
  return new;
end;
$$;

create trigger volunteer_shift_assignments_assert_type
  before insert or update on public.volunteer_shift_assignments
  for each row execute function public.assert_volunteer_assignment();
