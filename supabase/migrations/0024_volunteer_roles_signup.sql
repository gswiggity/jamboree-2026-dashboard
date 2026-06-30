-- Reseed volunteer_roles to match the public sign-up form's role options so a
-- volunteer's "interested in" selections map cleanly onto staffing roles.
-- Safe to replace: no shifts reference the old generic roles yet.

insert into volunteer_roles (key, label, sort_order) values
  ('front-of-house', 'Front of House / Check-in', 10),
  ('workshop-support', 'Workshop Support', 20),
  ('green-room', 'Performer Support / Green Room', 30),
  ('setup-teardown', 'Set up & Tear Down', 40),
  ('tech-booth', 'Tech Booth / Lighting / Sound', 50),
  ('admin-comms', 'Admin / Communication Support', 60)
on conflict (key) do update
  set label = excluded.label,
      sort_order = excluded.sort_order;

-- Drop the old generic roles no longer in the catalog. The FK from
-- volunteer_shifts is ON DELETE RESTRICT, so this only succeeds while no shift
-- references them (true at reseed time).
delete from volunteer_roles
where key not in (
  'front-of-house','workshop-support','green-room',
  'setup-teardown','tech-booth','admin-comms'
);
