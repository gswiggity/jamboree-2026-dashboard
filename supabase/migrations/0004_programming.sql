-- Programming: drafts hold a set of show blocks. Exactly one draft may be
-- published at a time; everyone sees the published one on /programming and
-- can comment per-block. Admins own draft CRUD + publish.

create table public.programming_drafts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid references public.profiles(id) on delete set null,
  is_published boolean not null default false,
  published_at timestamptz,
  published_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- At most one published draft at a time.
create unique index programming_drafts_one_published
  on public.programming_drafts ((true)) where is_published;

create trigger programming_drafts_set_updated_at
  before update on public.programming_drafts
  for each row execute function public.set_updated_at();

create table public.show_blocks (
  id uuid primary key default gen_random_uuid(),
  draft_id uuid not null references public.programming_drafts(id) on delete cascade,
  day date not null,
  start_time time not null,
  end_time time not null,
  title text,
  location text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint show_blocks_end_after_start check (end_time > start_time)
);

create index show_blocks_draft_idx on public.show_blocks(draft_id);

create trigger show_blocks_set_updated_at
  before update on public.show_blocks
  for each row execute function public.set_updated_at();

create table public.show_block_submissions (
  block_id uuid not null references public.show_blocks(id) on delete cascade,
  submission_id uuid not null references public.submissions(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (block_id, submission_id)
);

create index show_block_submissions_submission_idx
  on public.show_block_submissions(submission_id);

create table public.show_block_comments (
  id uuid primary key default gen_random_uuid(),
  block_id uuid not null references public.show_blocks(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index show_block_comments_block_idx on public.show_block_comments(block_id);

create trigger show_block_comments_set_updated_at
  before update on public.show_block_comments
  for each row execute function public.set_updated_at();

-- RLS -------------------------------------------------------------------------

alter table public.programming_drafts enable row level security;
alter table public.show_blocks enable row level security;
alter table public.show_block_submissions enable row level security;
alter table public.show_block_comments enable row level security;

-- Helper: is the caller an admin?
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  );
$$;

-- programming_drafts: everyone authed reads; admins write.
create policy "drafts read all authed"
  on public.programming_drafts for select to authenticated using (true);
create policy "drafts admin insert"
  on public.programming_drafts for insert to authenticated
  with check (public.is_admin());
create policy "drafts admin update"
  on public.programming_drafts for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy "drafts admin delete"
  on public.programming_drafts for delete to authenticated
  using (public.is_admin());

-- show_blocks: everyone authed reads; admins write.
create policy "blocks read all authed"
  on public.show_blocks for select to authenticated using (true);
create policy "blocks admin insert"
  on public.show_blocks for insert to authenticated
  with check (public.is_admin());
create policy "blocks admin update"
  on public.show_blocks for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy "blocks admin delete"
  on public.show_blocks for delete to authenticated
  using (public.is_admin());

-- show_block_submissions: read all authed; write admins only.
create policy "block_submissions read all authed"
  on public.show_block_submissions for select to authenticated using (true);
create policy "block_submissions admin insert"
  on public.show_block_submissions for insert to authenticated
  with check (public.is_admin());
create policy "block_submissions admin delete"
  on public.show_block_submissions for delete to authenticated
  using (public.is_admin());

-- show_block_comments: read all authed; insert/update/delete own only, and
-- only on a block that belongs to the currently-published draft.
create policy "comments read all authed"
  on public.show_block_comments for select to authenticated using (true);
create policy "comments insert own on published"
  on public.show_block_comments for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.show_blocks b
      join public.programming_drafts d on d.id = b.draft_id
      where b.id = block_id and d.is_published
    )
  );
create policy "comments update own"
  on public.show_block_comments for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "comments delete own"
  on public.show_block_comments for delete to authenticated
  using (user_id = auth.uid());
