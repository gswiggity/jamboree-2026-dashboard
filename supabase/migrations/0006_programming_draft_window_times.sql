alter table public.programming_drafts
  add column window_start_time time not null default '09:00:00',
  add column window_end_time time not null default '24:00:00';

alter table public.programming_drafts
  add constraint programming_drafts_window_valid
  check (window_end_time > window_start_time);
