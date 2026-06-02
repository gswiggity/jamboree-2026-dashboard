# Engineering Baselines — Jamboree Dashboard

> **Standing engineering discipline for every coder agent on this repo.**
> Source: NIB-49 (board-approved via NIB-47). These are NibbleWare's house rules,
> adapted to our stack (Next.js 16 App Router · React 19 · TypeScript · Tailwind v4 ·
> shadcn/ui · Supabase/Postgres + Auth + RLS · Vercel).
>
> Baselines 1–3 are **enforced** (treat a violation as a bug). Baseline 4 is
> **documented guidance** — make it a conscious, recorded trade.
>
> Before shipping anything user-facing, run [`SHIP_CHECKLIST.md`](./SHIP_CHECKLIST.md).

---

## 1. Security-by-context (ENFORCED)

AI-written code is insecure mostly because it lacks *project* context, not because
it writes bad code. So the contract lives here. This formalizes the existing
"RLS invariants" in [`AGENTS.md`](../AGENTS.md) — RLS is the real authorization
boundary; the proxy and layout checks are convenience layers.

### Access-control matrix

| Caller | Can read | Can write | Notes |
|--------|----------|-----------|-------|
| **Anonymous** (no session) | nothing (only `/login`, `/auth/*`) | nothing | All `(app)` routes are auth-gated. |
| **Member** (authed, on `allowed_emails`) | All `submissions` & `imports`; **all** `judgments` (team needs visibility); the `submission_verdict_counts` view | Insert `submissions` & `imports`; insert/update **own** `judgments` (`user_id = auth.uid()`) | Verdicts are team-readable, owner-writable. A member can never edit another member's verdict. |
| **Admin** (first profile / `role='admin'`) | Everything members can, plus `allowed_emails` | Everything members can, plus manage `allowed_emails` and team on `/settings` | `allowed_emails` is admin-only for both read and write. Admin status comes from the `profiles.role` column, derived server-side — never a client flag. |

**Enforce with RLS in the migration that adds the table** — an unprotected table is
a shipping blocker. Allowlist is enforced by the `handle_new_user` Postgres trigger
on `auth.users` insert; don't move that gate into app code.

### Secrets & credentials
- Secrets in **env vars only** (`.env.local`, Vercel project env). Never in source or
  the client bundle.
- **`NEXT_PUBLIC_*` ships to the browser.** Only the Supabase URL + publishable/anon
  key may carry it. The service-role key is server-only and, per AGENTS.md, **must
  never appear in client code.**
- **Any call using a secret runs server-side** (Server Component / Server Action /
  route handler). Server-side use of the publishable key still goes through RLS —
  that's the point; don't reach for service-role to "make it work."
- Prefer short-lived credentials; Supabase sessions are short-lived — keep them so.

### Public endpoints
- The app surface is auth-gated, so the live public endpoints are `/login` and
  `/auth/callback`. Rate-limit them (Vercel WAF / IP limiter) to blunt OAuth-callback
  and login abuse. If we ever add a public/unauthenticated route (webhook, public
  share link), it must be IP rate-limited from day one.
- Pure *user-based* limiting is weak for **unauthenticated** endpoints — key on IP.

### Input validation
- Validate/sanitize at every boundary: **CSV uploads first and foremost** (papaparse
  output is untrusted — Squarespace columns shift; see `lib/csv.ts`), Server Action
  args, and route params. Use a schema (Zod) at the Server Action boundary.
- Never interpolate user/CSV input into raw SQL — use the query builder / parameterized
  RPC. The `jsonb` `submissions.data` blob must not be trusted as structured input.

---

## 2. Production-readiness (ENFORCED) — see SHIP_CHECKLIST.md

- **No `select('*')`.** Select the columns you render. Index every column you filter,
  sort, or join on — `submissions(type, external_id)` (already unique), `judgments
  (user_id, submission_id)`, and the columns the dashboard/analysis pages sort by.
- **Cache repeated computation.** The dashboard counts, judging-progress, and analysis
  aggregates are recomputed often — use the `submission_verdict_counts` view plus
  Next.js caching (`unstable_cache` / `revalidateTag`) and React `cache()`. Don't run
  N+1 verdict counts per render.
- **Heavy work off the request path.** Large CSV imports, exports, and any future
  email/notification work → background (Supabase edge function / queue), not a
  synchronous Server Action that can hit Vercel's function timeout. The current import
  is interactive and bounded; if festival CSVs grow large, move the upsert loop to a
  background job.
- **Load-test before launch.** Before the festival's judging window opens, test import
  with a full-size CSV and the dashboard/analysis pages with the full submission set.

---

## 3. Backup / disaster recovery (ENFORCED)

Pick an explicit **RPO** (max acceptable data loss) and match the tier:

| RPO | Tier |
|-----|------|
| ~1 week | Weekly `pg_dump` → object storage in a **different region** |
| ~1 hour | Daily automated backup **+** hourly differential/dump |
| minutes | WAL / point-in-time recovery (PITR) |

**Jamboree's chosen RPO: ~1 hour during the active import/judging window; ~24h
otherwise.** The judging verdicts are produced once, by hand, by a 3-person team —
they are effectively irreplaceable mid-festival, so the live window gets the tighter
RPO.
- Off-season / setup: Supabase **daily** automated backups (Pro) + a weekly `pg_dump`
  to a **cross-region** bucket.
- During the festival judging window: enable **PITR** (minutes RPO) for the run, and
  take a manual `pg_dump` **before and after each bulk CSV import** (cheap insurance
  against a bad upsert).

**Requirements:** RPO consciously chosen and recorded here; at least one backup copy
**cross-region**; a restore tested before the festival opens.

---

## 4. Infra-cost lens (GUIDANCE — make it a conscious, recorded trade)

Default to the **simplest infra that meets the RPO/scale need.** A 3-person dashboard
for a time-boxed festival does not need dedicated compute or autoscaling — managed
PaaS (Vercel + Supabase) is correct and cheap, and it maximizes shipping speed.

The one conscious spend: **Supabase Pro (~$25/mo)** for daily backups + PITR during
the festival window — clearly worth it given the verdicts are irreplaceable. It can be
downgraded off-season. Record infra spend decisions here with the reason.

---

## Pushback / flags
- **Cross-region backups aren't free on Supabase.** Built-in backups are same-region;
  cross-region needs the external scheduled `pg_dump` job (or a read replica). Small
  job + storage — budget it.
- **PITR is a paid add-on** and only needs to be on for the festival window; remember
  to enable it *before* judging opens, not after a data-loss scare.
- The interactive CSV import is fine at current scale; the background-queue rule only
  bites if festival submission volume jumps. Flagging so we don't over-engineer early.

*Owner: Soren (Head of Engineering). Last updated 2026-06-01 (NIB-49).*
