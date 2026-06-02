# Pre-Ship Checklist — Jamboree Dashboard

> Run this before any user-facing launch or significant production change, and
> before the festival judging window opens. Full rationale:
> [`ENGINEERING_BASELINES.md`](./ENGINEERING_BASELINES.md).
> `[ ]` items are **gates** — don't ship with one unchecked unless the board signs
> off on the exception (record it).

## Security (baseline 1)
- [ ] Every new/changed table has an RLS policy matching the access-control matrix.
- [ ] `judgments` writes still require `user_id = auth.uid()`; `allowed_emails` stays admin-only.
- [ ] No mutation trusts a client-sent role; admin/ownership checks are server-side.
- [ ] No secret has a `NEXT_PUBLIC_` prefix except the Supabase URL + publishable key.
- [ ] No service-role key in client code; every secret-bearing call runs server-side.
- [ ] `/login` + `/auth/callback` (and any new public route) are IP rate-limited.
- [ ] CSV upload + all Server Action args validated with a schema; no raw SQL interpolation.
- [ ] `git diff` shows no committed secrets.

## Production-readiness (baseline 2)
- [ ] No `select('*')` on any query path that grows.
- [ ] Indexes exist for filtered / sorted / joined columns.
- [ ] Dashboard/analysis aggregates use the view + caching; no per-render N+1 counts.
- [ ] Heavy import/export work is bounded or moved off the request path.
- [ ] Load-tested import with a full-size CSV and the dashboard at full submission count.
- [ ] `npm run build` passes locally.

## Backup / DR (baseline 3)
- [ ] Product RPO is recorded in `ENGINEERING_BASELINES.md`.
- [ ] Backup tier matching the RPO is running (PITR enabled before judging opens).
- [ ] Pre-/post-import manual dump habit confirmed for bulk CSV imports.
- [ ] At least one backup copy is cross-region.
- [ ] A restore has been tested.

## Infra cost (baseline 4 — guidance)
- [ ] Infra is the simplest option that meets the RPO/scale need.
- [ ] Any new recurring spend is recorded with its reason in `ENGINEERING_BASELINES.md`.
