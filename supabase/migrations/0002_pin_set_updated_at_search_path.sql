-- Pin search_path on public.set_updated_at to satisfy the Supabase linter.
-- Not security-critical (no security definer), but removes the warning.

create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
