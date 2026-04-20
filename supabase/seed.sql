-- Seeds the initial admin allowlist entry.
-- Additional team members can be added via the Settings page (admin-only) once built.
insert into public.allowed_emails (email) values
  ('gabandgoof@gmail.com')
on conflict (email) do nothing;
