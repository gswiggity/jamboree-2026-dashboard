alter table public.submissions
  add column if not exists first_emailed_at timestamptz,
  add column if not exists first_emailed_by uuid references auth.users(id) on delete set null;

create index if not exists submissions_first_emailed_at_idx
  on public.submissions(first_emailed_at)
  where first_emailed_at is not null;
