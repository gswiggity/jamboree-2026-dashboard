-- Act status pipeline: a first-class state machine for act management, the
-- spine of post-judging outreach. Today the only outreach signal is
-- submissions.first_emailed_at (one boolean-ish step). This adds an explicit
-- pipeline: team_yes → emailed → accepted | declined | ghosted → programmed.
--
-- Only meaningful for type='act'. Reads stay open to the authed team via the
-- existing "authenticated read submissions" policy. Transitions go through
-- set_act_status(), a SECURITY DEFINER function that stamps
-- act_status_changed_by = auth.uid() so ownership can't be spoofed and the
-- transition guard can't be bypassed from the client (judgments-shape intent,
-- enforced at the DB layer rather than a column-scoped RLS check).

create type public.act_status as enum (
  'team_yes', 'emailed', 'accepted', 'declined', 'ghosted', 'programmed'
);

alter table public.submissions
  add column if not exists act_status public.act_status,
  add column if not exists act_status_changed_at timestamptz,
  add column if not exists act_status_changed_by uuid
    references auth.users(id) on delete set null;

-- Backfill from consensus tier. "locked" = 2+ yes votes with zero opposition
-- (see lib/lineup-tiers.ts) — the acts the team has committed to. Those that
-- have already been emailed land at 'emailed', the rest at 'team_yes'. Every
-- other act stays null (not in the pipeline yet). changed_by is left null for
-- the system backfill.
update public.submissions s
set
  act_status = case
    when s.first_emailed_at is not null then 'emailed'::public.act_status
    else 'team_yes'::public.act_status
  end,
  act_status_changed_at = coalesce(s.first_emailed_at, now())
from public.submission_verdict_counts vc
where vc.submission_id = s.id
  and s.type = 'act'
  and s.deleted_at is null
  and vc.yes_count >= 2
  and vc.no_count = 0;

create index if not exists submissions_act_status_idx
  on public.submissions(act_status, type)
  where type = 'act';

-- Authoritative transition. Adjacency guard lives here so the client can't
-- skip steps; p_reset bypasses it for deliberate corrections (e.g. the
-- programmed → team_yes reset called out in the spec). changed_by is always
-- the caller's uid.
create or replace function public.set_act_status(
  p_submission_id uuid,
  p_next public.act_status,
  p_reset boolean default false
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_type text;
  v_current public.act_status;
  v_allowed boolean;
begin
  if v_uid is null then
    raise exception 'Not authenticated.';
  end if;

  select type, act_status into v_type, v_current
  from public.submissions
  where id = p_submission_id;

  if v_type is null then
    raise exception 'Submission not found.';
  end if;
  if v_type <> 'act' then
    raise exception 'Act status only applies to acts.';
  end if;

  if not p_reset and v_current is distinct from p_next then
    if v_current is null then
      v_allowed := p_next = 'team_yes';
    else
      v_allowed := case v_current
        when 'team_yes'   then p_next in ('emailed')
        when 'emailed'    then p_next in ('accepted', 'declined', 'ghosted', 'team_yes')
        when 'accepted'   then p_next in ('programmed', 'emailed')
        when 'declined'   then p_next in ('emailed')
        when 'ghosted'    then p_next in ('emailed', 'accepted')
        when 'programmed' then p_next in ('accepted')
        else false
      end;
    end if;
    if not v_allowed then
      raise exception 'Illegal act-status transition: % → %',
        coalesce(v_current::text, '(none)'), p_next;
    end if;
  end if;

  update public.submissions
  set act_status = p_next,
      act_status_changed_at = now(),
      act_status_changed_by = v_uid
  where id = p_submission_id;
end;
$$;

-- Remove an act from the pipeline entirely (back to no status). Same auth +
-- act-only guard; ownership stamp cleared alongside.
create or replace function public.clear_act_status(p_submission_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_type text;
begin
  if v_uid is null then
    raise exception 'Not authenticated.';
  end if;

  select type into v_type from public.submissions where id = p_submission_id;
  if v_type is null then
    raise exception 'Submission not found.';
  end if;
  if v_type <> 'act' then
    raise exception 'Act status only applies to acts.';
  end if;

  update public.submissions
  set act_status = null,
      act_status_changed_at = now(),
      act_status_changed_by = v_uid
  where id = p_submission_id;
end;
$$;

revoke all on function public.set_act_status(uuid, public.act_status, boolean) from public;
revoke all on function public.clear_act_status(uuid) from public;
grant execute on function public.set_act_status(uuid, public.act_status, boolean) to authenticated;
grant execute on function public.clear_act_status(uuid) to authenticated;
