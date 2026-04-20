-- Documents: shared assets for the team (contracts, agreements, marketing
-- images, invoices, etc.). File bytes live in a private Supabase Storage
-- bucket; metadata lives in `public.documents`.

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  name text not null,                           -- display name, defaults to file_name on upload
  file_name text not null,                      -- original upload filename (for user reference)
  storage_path text not null unique,            -- path inside the storage bucket
  mime_type text not null default 'application/octet-stream',
  size_bytes bigint not null default 0,
  category text not null default 'other',       -- free-form; starter set seeded client-side
  description text not null default '',
  uploaded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index documents_category_idx on public.documents (category);
create index documents_created_at_idx on public.documents (created_at desc);

alter table public.documents enable row level security;

-- Any authenticated team member can read and mutate documents. This mirrors
-- the phases / festival_settings model — three organizers, everything shared.
create policy "authenticated read documents"
  on public.documents for select
  to authenticated
  using (true);

create policy "authenticated insert documents"
  on public.documents for insert
  to authenticated
  with check (true);

create policy "authenticated update documents"
  on public.documents for update
  to authenticated
  using (true) with check (true);

create policy "authenticated delete documents"
  on public.documents for delete
  to authenticated
  using (true);

create trigger documents_set_updated_at
  before update on public.documents
  for each row execute function public.set_updated_at();

-- Storage: private bucket, 50 MB per file, any MIME type.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('documents', 'documents', false, 52428800, null)
on conflict (id) do nothing;

-- Storage policies: all authenticated users can read/write objects in this
-- bucket. Downloads go through signed URLs from the server action.
create policy "authenticated read storage documents"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'documents');

create policy "authenticated upload to storage documents"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'documents');

create policy "authenticated update storage documents"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'documents')
  with check (bucket_id = 'documents');

create policy "authenticated delete storage documents"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'documents');
