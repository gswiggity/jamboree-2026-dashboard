-- Editable festival-wide settings. Singleton table (id is the literal boolean
-- true) so there's always exactly one row. All authed members can read and
-- update the current phase; we don't gate this to admins because the team is
-- small and phase changes are coordinated.

create table public.festival_settings (
  id boolean primary key default true check (id = true),
  phase text not null default 'submissions' check (
    phase in ('submissions', 'judging', 'programming', 'live', 'wrap')
  ),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null
);

insert into public.festival_settings (id, phase) values (true, 'submissions')
  on conflict (id) do nothing;

alter table public.festival_settings enable row level security;

create policy "authenticated read festival_settings"
  on public.festival_settings for select to authenticated using (true);

create policy "authenticated update festival_settings"
  on public.festival_settings for update to authenticated
  using (true) with check (true);

create trigger festival_settings_set_updated_at
  before update on public.festival_settings
  for each row execute function public.set_updated_at();
