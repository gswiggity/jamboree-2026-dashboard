-- Security hardening.
--
-- 1) Block non-admins from changing profiles.role.
--    The existing "users update own profile" policy allows column-unrestricted
--    self-update, so a member could self-promote by calling
--      supabase.from("profiles").update({ role: "admin" }).eq("id", myId)
--    directly from the browser with their session's publishable key. Close
--    that door with a trigger.
--
-- 2) Tighten submissions DML. Before this, "authenticated update/insert
--    submissions" policies used `using (true)` / `with check (true)`, letting
--    any authed user overwrite or inject arbitrary submission rows from the
--    browser. Scope to: original uploader of the target import, or an admin.
--    Note: cross-member re-uploads (teammate B re-uploads a CSV teammate A
--    originally imported) will not update A's rows — re-uploads across team
--    members require an admin to perform them.

-- Role guard -----------------------------------------------------------------

create or replace function public.enforce_profile_role_guard()
returns trigger security definer set search_path = '' language plpgsql as $$
begin
  if new.role is distinct from old.role and not public.is_admin() then
    raise exception 'Only admins can change role.';
  end if;
  return new;
end;
$$;

create trigger profiles_role_guard
  before update of role on public.profiles
  for each row execute function public.enforce_profile_role_guard();

-- Submissions DML scoping ----------------------------------------------------

drop policy "authenticated insert submissions" on public.submissions;
drop policy "authenticated update submissions" on public.submissions;

create policy "uploader insert submissions"
  on public.submissions for insert to authenticated
  with check (
    public.is_admin() or exists (
      select 1 from public.imports i
      where i.id = source_import_id and i.uploaded_by = auth.uid()
    )
  );

create policy "uploader update submissions"
  on public.submissions for update to authenticated
  using (
    public.is_admin() or exists (
      select 1 from public.imports i
      where i.id = source_import_id and i.uploaded_by = auth.uid()
    )
  )
  with check (
    public.is_admin() or exists (
      select 1 from public.imports i
      where i.id = source_import_id and i.uploaded_by = auth.uid()
    )
  );
