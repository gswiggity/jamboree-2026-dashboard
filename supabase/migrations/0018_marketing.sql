-- Marketing attribution: catalog of campaigns (a poster run, an Instagram
-- push, an email blast, etc.) with cost and date window. Ticket sales can
-- optionally point at a campaign so we can see which efforts actually moved
-- tickets vs. just burned money.
--
-- Campaigns are soft-archivable so historical attribution survives once a
-- campaign is no longer live. Hard delete only allowed when no sales are
-- attributed. Same shared-RLS model as the other Ops pillars.

-- ————————————————————————————————————————————————————————————
-- marketing_campaigns
-- ————————————————————————————————————————————————————————————

create table public.marketing_campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  kind text not null default 'other'
    check (kind in (
      'social',      -- Instagram, TikTok, Facebook, etc.
      'email',       -- newsletter, direct email
      'print',       -- flyers, posters, stickers
      'press',       -- podcast mentions, interviews, write-ups
      'referral',    -- word-of-mouth, performer networks
      'paid_ads',    -- Meta/Google/etc. paid placements
      'other'
    )),
  cost_cents bigint not null default 0 check (cost_cents >= 0),
  started_on date,
  ended_on date check (ended_on is null or started_on is null or ended_on >= started_on),
  notes text not null default '',
  archived_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index marketing_campaigns_sort_idx
  on public.marketing_campaigns (archived_at nulls first, kind, name);
create index marketing_campaigns_started_on_idx
  on public.marketing_campaigns (started_on);

alter table public.marketing_campaigns enable row level security;

create policy "authenticated read marketing_campaigns"
  on public.marketing_campaigns for select
  to authenticated
  using (true);

create policy "authenticated insert marketing_campaigns"
  on public.marketing_campaigns for insert
  to authenticated
  with check (true);

create policy "authenticated update marketing_campaigns"
  on public.marketing_campaigns for update
  to authenticated
  using (true) with check (true);

create policy "authenticated delete marketing_campaigns"
  on public.marketing_campaigns for delete
  to authenticated
  using (true);

create trigger marketing_campaigns_set_updated_at
  before update on public.marketing_campaigns
  for each row execute function public.set_updated_at();

-- ————————————————————————————————————————————————————————————
-- ticket_sales.campaign_id
-- ————————————————————————————————————————————————————————————
-- Nullable: not every sale has a known attribution. SET NULL on campaign
-- delete so hard-deleting an unused campaign doesn't cascade-destroy sales.

alter table public.ticket_sales
  add column campaign_id uuid references public.marketing_campaigns(id) on delete set null;

create index ticket_sales_campaign_id_idx
  on public.ticket_sales (campaign_id);
