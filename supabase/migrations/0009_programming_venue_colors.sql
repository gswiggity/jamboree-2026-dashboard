-- Per-venue fill color for schedule blocks on a draft.
-- Shape: { [venueName: text]: hexColor }, e.g. {"Side Stage": "#f87171"}.

alter table public.programming_drafts
  add column venue_colors jsonb not null default '{}'::jsonb;
