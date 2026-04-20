-- Promote festival phases from a hardcoded check-constraint list into a
-- first-class table so they can be CRUD'd from the settings UI.

create table public.phases (
  key text primary key,
  label text not null,
  short text not null,
  blurb text not null default '',
  sort_order integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Seed the existing five phases (kept in sync with the old lib/phases.ts).
insert into public.phases (key, label, short, blurb, sort_order) values
  ('submissions', 'Submissions open', 'Submissions', 'Acts, volunteers, and workshops are still rolling in.', 1),
  ('judging',     'Judging',          'Judging',     'Team is casting verdicts on everything in the inbox.', 2),
  ('programming', 'Programming',      'Programming', 'Approved acts are being slotted into the schedule.', 3),
  ('live',        'Festival live',    'Live',        'Shows are happening. Focus is on-site execution.', 4),
  ('wrap',        'Wrap-up',          'Wrap-up',     'Post-event reconciliation, thank-yous, and retros.', 5);

-- Swap the old check constraint on festival_settings.phase for a real FK.
-- ON UPDATE CASCADE so renaming a phase's key propagates.
-- ON DELETE RESTRICT so the currently-active phase can't be deleted out from under us.
alter table public.festival_settings
  drop constraint if exists festival_settings_phase_check;

alter table public.festival_settings
  add constraint festival_settings_phase_fkey
  foreign key (phase) references public.phases(key)
  on update cascade on delete restrict;

-- RLS: every authenticated member can read and edit phases. There are only
-- three organizers and phases are a shared team concept.
alter table public.phases enable row level security;

create policy "authenticated read phases"
  on public.phases for select
  to authenticated
  using (true);

create policy "authenticated insert phases"
  on public.phases for insert
  to authenticated
  with check (true);

create policy "authenticated update phases"
  on public.phases for update
  to authenticated
  using (true) with check (true);

create policy "authenticated delete phases"
  on public.phases for delete
  to authenticated
  using (true);

create trigger phases_set_updated_at
  before update on public.phases
  for each row execute function public.set_updated_at();
