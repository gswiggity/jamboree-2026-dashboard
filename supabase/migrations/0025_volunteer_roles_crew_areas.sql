-- Replace the sign-up role catalog with the festival's operational staffing
-- areas (the color-coded crew schedule). Roles stay user-editable.

-- Removing roles is ON DELETE RESTRICT, so first clear any shifts that
-- reference the roles being retired (covers the lone "test" shift in prod;
-- a no-op on a fresh database).
delete from volunteer_shifts
where role_key in (
  'front-of-house','workshop-support','setup-teardown','tech-booth','admin-comms'
);

insert into volunteer_roles (key, label, sort_order) values
  ('proscenium',   'Proscenium',   10),
  ('p-p',          'P+P',          20),
  ('door-check',   'Door check',   30),
  ('office-merch', 'Office/merch',  40),
  ('green-room',   'Green room',   50),
  ('tech',         'Tech',         60),
  ('tear-down',    'Tear Down',    70)
on conflict (key) do update
  set label = excluded.label, sort_order = excluded.sort_order;

delete from volunteer_roles
where key not in (
  'proscenium','p-p','door-check','office-merch','green-room','tech','tear-down'
);
