-- Publish-verdicts gate: each user opts in to sharing their verdicts with the team.

alter table public.profiles
  add column verdicts_published boolean not null default false;

-- Tighten judgments select: visible to the owner always, to others only when the
-- owner has opted in to publishing.
drop policy if exists "authenticated read judgments" on public.judgments;

create policy "users read own judgments"
  on public.judgments for select to authenticated
  using (user_id = auth.uid());

create policy "read published judgments"
  on public.judgments for select to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = judgments.user_id and p.verdicts_published
    )
  );
