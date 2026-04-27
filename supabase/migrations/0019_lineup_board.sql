-- Lineup board: free-form sticky-note view for organizing approved acts
-- before committing them to programming. Three-organizer team, all
-- authenticated members can create/move/edit columns and cards (same
-- sharing model as tasks).

create table public.lineup_columns (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  position int not null default 0,
  color text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index lineup_columns_position_idx on public.lineup_columns(position);

create trigger lineup_columns_set_updated_at
  before update on public.lineup_columns
  for each row execute function public.set_updated_at();

create table public.lineup_cards (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.submissions(id) on delete cascade,
  -- Null column = the implicit "Unsorted" pile. Cards land here when their
  -- column is deleted, or when an act first becomes approved.
  column_id uuid references public.lineup_columns(id) on delete set null,
  position int not null default 0,
  set_length_minutes int check (set_length_minutes is null or set_length_minutes >= 0),
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (submission_id)
);

create index lineup_cards_column_idx on public.lineup_cards(column_id);
create index lineup_cards_submission_idx on public.lineup_cards(submission_id);

create trigger lineup_cards_set_updated_at
  before update on public.lineup_cards
  for each row execute function public.set_updated_at();

alter table public.lineup_columns enable row level security;
alter table public.lineup_cards enable row level security;

-- Same sharing model as tasks: 3-person team, everyone can do everything.
create policy "authenticated read lineup_columns"
  on public.lineup_columns for select to authenticated using (true);
create policy "authenticated insert lineup_columns"
  on public.lineup_columns for insert to authenticated with check (true);
create policy "authenticated update lineup_columns"
  on public.lineup_columns for update to authenticated using (true) with check (true);
create policy "authenticated delete lineup_columns"
  on public.lineup_columns for delete to authenticated using (true);

create policy "authenticated read lineup_cards"
  on public.lineup_cards for select to authenticated using (true);
create policy "authenticated insert lineup_cards"
  on public.lineup_cards for insert to authenticated with check (true);
create policy "authenticated update lineup_cards"
  on public.lineup_cards for update to authenticated using (true) with check (true);
create policy "authenticated delete lineup_cards"
  on public.lineup_cards for delete to authenticated using (true);
