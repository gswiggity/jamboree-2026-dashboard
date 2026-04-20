alter table public.programming_drafts
  add column venues text[] not null default '{}';
