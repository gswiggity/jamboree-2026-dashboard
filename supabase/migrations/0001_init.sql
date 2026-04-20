-- Initial schema for Jamboree dashboard.
-- Applied via Supabase MCP; stored here for version control.

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  avatar_url text,
  role text not null default 'member' check (role in ('admin', 'member')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.allowed_emails (
  email text primary key check (email = lower(email)),
  invited_by uuid references public.profiles(id) on delete set null,
  invited_at timestamptz not null default now()
);

create table public.imports (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('act', 'volunteer', 'workshop')),
  uploaded_by uuid references public.profiles(id) on delete set null,
  uploaded_at timestamptz not null default now(),
  file_name text,
  row_count int not null default 0,
  new_rows int not null default 0,
  updated_rows int not null default 0
);

create table public.submissions (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('act', 'volunteer', 'workshop')),
  external_id text not null,
  name text,
  email text,
  submitted_at timestamptz,
  data jsonb not null default '{}'::jsonb,
  source_import_id uuid references public.imports(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (type, external_id)
);

create table public.judgments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  submission_id uuid not null references public.submissions(id) on delete cascade,
  verdict text check (verdict in ('yes', 'no', 'maybe')),
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, submission_id)
);

create index submissions_type_idx on public.submissions(type);
create index submissions_submitted_at_idx on public.submissions(submitted_at desc);
create index judgments_submission_id_idx on public.judgments(submission_id);
create index judgments_user_id_idx on public.judgments(user_id);
create index imports_uploaded_at_idx on public.imports(uploaded_at desc);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger submissions_set_updated_at before update on public.submissions
  for each row execute function public.set_updated_at();
create trigger judgments_set_updated_at before update on public.judgments
  for each row execute function public.set_updated_at();

-- On Google OAuth sign-in, enforce allowlist + create profile.
create or replace function public.handle_new_user()
returns trigger security definer set search_path = public language plpgsql as $$
declare
  v_email text := lower(new.email);
begin
  if not exists (select 1 from public.allowed_emails where email = v_email) then
    raise exception 'Email % is not on the invite allowlist.', new.email;
  end if;

  insert into public.profiles (id, email, full_name, avatar_url, role)
  values (
    new.id,
    v_email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    new.raw_user_meta_data->>'avatar_url',
    case when (select count(*) from public.profiles) = 0 then 'admin' else 'member' end
  );

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.allowed_emails enable row level security;
alter table public.submissions enable row level security;
alter table public.imports enable row level security;
alter table public.judgments enable row level security;

create policy "authenticated read profiles"
  on public.profiles for select to authenticated using (true);
create policy "users update own profile"
  on public.profiles for update to authenticated
  using (auth.uid() = id) with check (auth.uid() = id);

create policy "admin read allowed_emails"
  on public.allowed_emails for select to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));
create policy "admin insert allowed_emails"
  on public.allowed_emails for insert to authenticated
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));
create policy "admin delete allowed_emails"
  on public.allowed_emails for delete to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

create policy "authenticated read submissions"
  on public.submissions for select to authenticated using (true);
create policy "authenticated insert submissions"
  on public.submissions for insert to authenticated with check (true);
create policy "authenticated update submissions"
  on public.submissions for update to authenticated using (true);

create policy "authenticated read imports"
  on public.imports for select to authenticated using (true);
create policy "authenticated insert imports"
  on public.imports for insert to authenticated with check (uploaded_by = auth.uid());

create policy "authenticated read judgments"
  on public.judgments for select to authenticated using (true);
create policy "users insert own judgments"
  on public.judgments for insert to authenticated with check (user_id = auth.uid());
create policy "users update own judgments"
  on public.judgments for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "users delete own judgments"
  on public.judgments for delete to authenticated using (user_id = auth.uid());

create or replace view public.submission_verdict_counts
with (security_invoker = true) as
select
  s.id as submission_id,
  s.type,
  count(*) filter (where j.verdict = 'yes') as yes_count,
  count(*) filter (where j.verdict = 'no') as no_count,
  count(*) filter (where j.verdict = 'maybe') as maybe_count,
  count(j.id) as total_judgments
from public.submissions s
left join public.judgments j on j.submission_id = s.id
group by s.id, s.type;

grant select on public.submission_verdict_counts to authenticated;
