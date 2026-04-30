-- Link documents to a submission so a single document table can hold both
-- general festival assets and per-act/workshop marketing photos. NULL means
-- the document isn't tied to any submission (the existing default).
alter table public.documents
  add column if not exists submission_id uuid
    references public.submissions(id) on delete cascade;

create index if not exists documents_submission_id_idx
  on public.documents (submission_id)
  where submission_id is not null;
