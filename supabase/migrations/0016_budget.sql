-- Budget: high-level planning + tracking for festival income & expenses.
-- Same sharing model as tasks/volunteers: three organizers, everything shared.
--
-- Two tables:
--   budget_categories — the catalog of buckets (income or expense)
--   budget_items      — individual line items with planned/actual amounts
--
-- Money is stored as integer cents (bigint) — avoids floating-point drift
-- and is trivially summed at the DB. The UI formats to dollars for display.

-- ————————————————————————————————————————————————————————————
-- budget_categories
-- ————————————————————————————————————————————————————————————

create table public.budget_categories (
  key text primary key check (key = lower(key) and length(key) between 1 and 48),
  label text not null,
  kind text not null check (kind in ('income', 'expense')),
  sort_order int not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index budget_categories_kind_sort_idx
  on public.budget_categories (kind, sort_order, label);

alter table public.budget_categories enable row level security;

create policy "authenticated read budget_categories"
  on public.budget_categories for select
  to authenticated
  using (true);

create policy "authenticated insert budget_categories"
  on public.budget_categories for insert
  to authenticated
  with check (true);

create policy "authenticated update budget_categories"
  on public.budget_categories for update
  to authenticated
  using (true) with check (true);

create policy "authenticated delete budget_categories"
  on public.budget_categories for delete
  to authenticated
  using (true);

create trigger budget_categories_set_updated_at
  before update on public.budget_categories
  for each row execute function public.set_updated_at();

-- Seed sensible festival defaults. Organizers can add/rename/reorder later.
insert into public.budget_categories (key, label, kind, sort_order) values
  -- Income
  ('tickets',        'Ticket sales',          'income',  10),
  ('sponsorships',   'Sponsorships',          'income',  20),
  ('grants',         'Grants',                'income',  30),
  ('merch',          'Merch',                 'income',  40),
  ('donations',      'Donations',             'income',  50),
  -- Expense
  ('venue',          'Venue',                 'expense', 10),
  ('performers',     'Performer stipends',    'expense', 20),
  ('production',     'Production & tech',     'expense', 30),
  ('marketing',      'Marketing',             'expense', 40),
  ('hospitality',    'Hospitality & green room','expense', 50),
  ('travel',         'Travel & lodging',      'expense', 60),
  ('supplies',       'Supplies',              'expense', 70),
  ('fees',           'Fees & licenses',       'expense', 80)
on conflict (key) do nothing;

-- ————————————————————————————————————————————————————————————
-- budget_items
-- ————————————————————————————————————————————————————————————
--
-- planned_cents is required (that's the budget line). actual_cents is
-- nullable — null means "not yet paid/received", set means the real
-- number landed. incurred_at is nullable too, set when actual lands.

create table public.budget_items (
  id uuid primary key default gen_random_uuid(),
  category_key text not null references public.budget_categories(key)
    on update cascade on delete restrict,
  description text not null,
  planned_cents bigint not null check (planned_cents >= 0),
  actual_cents bigint check (actual_cents is null or actual_cents >= 0),
  incurred_at date,
  notes text not null default '',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index budget_items_category_idx on public.budget_items (category_key);
create index budget_items_incurred_at_idx on public.budget_items (incurred_at);
create index budget_items_created_at_idx on public.budget_items (created_at desc);

alter table public.budget_items enable row level security;

create policy "authenticated read budget_items"
  on public.budget_items for select
  to authenticated
  using (true);

create policy "authenticated insert budget_items"
  on public.budget_items for insert
  to authenticated
  with check (true);

create policy "authenticated update budget_items"
  on public.budget_items for update
  to authenticated
  using (true) with check (true);

create policy "authenticated delete budget_items"
  on public.budget_items for delete
  to authenticated
  using (true);

create trigger budget_items_set_updated_at
  before update on public.budget_items
  for each row execute function public.set_updated_at();
