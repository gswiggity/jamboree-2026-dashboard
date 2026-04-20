-- Let admins update anyone's profile (previously only self-update was allowed).
-- Used by the admin role-toggle in /settings.

create policy "admins update profiles" on public.profiles
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());
