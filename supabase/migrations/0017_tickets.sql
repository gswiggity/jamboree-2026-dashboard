-- Tickets: catalog of ticket types (shows, passes, VIP, etc.) + a log of
-- sales. Same sharing model as tasks/volunteers/budget: three organizers,
-- everything shared.
--
-- Two tables:
--   ticket_types — the catalog (name, price, capacity, optional date/time)
--   ticket_sales — per-transaction log with channel + unit price snapshot
--
-- Money stored as integer cents. Each sale row captures the unit price at
-- the time of sale so historical math stays correct if the type's price
-- changes later.

-- ————————————————————————————————————————————————————————————
-- ticket_types
-- ————————————————————————————————————————————————————————————

create table public.ticket_types (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  price_cents bigint not null check (price_cents >= 0),
  capacity int check (capacity is null or capacity > 0),
  on_date date,           -- optional: single-night tickets get a date
  start_time time,        -- optional: door time for that date
  sort_order int not null default 100,
  archived_at timestamptz,  -- soft hide; preserves sales history
  notes text not null default '',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index ticket_types_sort_idx
  on public.ticket_types (archived_at nulls first, sort_order, name);
create index ticket_types_on_date_idx
  on public.ticket_types (on_date);

alter table public.ticket_types enable row level security;

create policy "authenticated read ticket_types"
  on public.ticket_types for select
  to authenticated
  using (true);

create policy "authenticated insert ticket_types"
  on public.ticket_types for insert
  to authenticated
  with check (true);

create policy "authenticated update ticket_types"
  on public.ticket_types for update
  to authenticated
  using (true) with check (true);

create policy "authenticated delete ticket_types"
  on public.ticket_types for delete
  to authenticated
  using (true);

create trigger ticket_types_set_updated_at
  before update on public.ticket_types
  for each row execute function public.set_updated_at();

-- ————————————————————————————————————————————————————————————
-- ticket_sales
-- ————————————————————————————————————————————————————————————

create table public.ticket_sales (
  id uuid primary key default gen_random_uuid(),
  type_id uuid not null references public.ticket_types(id) on delete cascade,
  quantity int not null check (quantity > 0),
  unit_price_cents bigint not null check (unit_price_cents >= 0),
  channel text not null default 'other'
    check (channel in ('door', 'eventbrite', 'squarespace', 'comp', 'other')),
  sold_at timestamptz not null default now(),
  buyer_name text not null default '',
  buyer_email text not null default '',
  reference text not null default '',
  notes text not null default '',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index ticket_sales_type_id_idx on public.ticket_sales (type_id);
create index ticket_sales_sold_at_idx on public.ticket_sales (sold_at desc);
create index ticket_sales_channel_idx on public.ticket_sales (channel);

alter table public.ticket_sales enable row level security;

create policy "authenticated read ticket_sales"
  on public.ticket_sales for select
  to authenticated
  using (true);

create policy "authenticated insert ticket_sales"
  on public.ticket_sales for insert
  to authenticated
  with check (true);

create policy "authenticated update ticket_sales"
  on public.ticket_sales for update
  to authenticated
  using (true) with check (true);

create policy "authenticated delete ticket_sales"
  on public.ticket_sales for delete
  to authenticated
  using (true);

create trigger ticket_sales_set_updated_at
  before update on public.ticket_sales
  for each row execute function public.set_updated_at();
