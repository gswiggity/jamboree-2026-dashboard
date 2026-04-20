<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Jamboree

Event organization dashboard for the Swear Jar Jamboree Comedy Improv
Festival 2026 (3-person organizing team). Tracks act/volunteer/workshop
submissions imported from Squarespace CSVs, enables team judging with
private-write/team-read verdicts, and provides summary analysis.

## Stack

- **Next.js 16** (App Router, Server Components, Server Actions, React 19, Turbopack)
- TypeScript · Tailwind v4 · shadcn/ui
- **Supabase** (Postgres + Auth w/ Google OAuth + RLS) via `@supabase/ssr`
- papaparse (CSV) · recharts (charts) · sonner (toasts)
- Vercel deployment

## Commands

```
npm run dev         # http://localhost:3000
npm run build       # prod build
npm run lint
```

DB migrations go through Supabase MCP (`apply_migration`). Regen types after
schema changes:

```
npx supabase gen types typescript --project-id rvbjqcgbynuwgatuflbj > lib/database.types.ts
```

## Routes

```
/                          redirect based on auth
/login                     Google OAuth sign-in
/auth/callback             OAuth code exchange
/auth/error                allowlist-aware error page
/(app)/dashboard           counts, judging progress, recent imports
/(app)/submissions         tabs (act|volunteer|workshop) + verdict filters
/(app)/submissions/[id]    full data + judging form + team verdicts
/(app)/upload              CSV parse + import
/(app)/analysis            recharts: timeline + verdict breakdown
/(app)/settings            admin-only; team + allowlist
```

`(app)` route group owns the auth-gated layout with the top nav. Auth is
enforced in three places:

1. [proxy.ts](proxy.ts) — cookie refresh + coarse redirect for protected routes
2. [app/(app)/layout.tsx](app/(app)/layout.tsx) — session check + profile load
3. Data queries — RLS is the actual authorization

## Conventions

- Server Components by default. `"use client"` only when a component holds
  state or handles events.
- Mutations via **Server Actions** (`"use server"`), not API routes.
- Supabase clients: [lib/supabase/server.ts](lib/supabase/server.ts) (SSR)
  and [lib/supabase/client.ts](lib/supabase/client.ts) (browser). Never use
  a service-role key in client code.
- DB types in [lib/database.types.ts](lib/database.types.ts). Regen after
  every migration.

## Auth

- Google OAuth only. Allowlist enforced by a Postgres trigger
  (`handle_new_user`) on `auth.users` insert. If the email isn't in
  `allowed_emails`, the trigger raises and signup is rejected.
- First profile gets `role='admin'`; everyone else is `'member'`.
- Allowlist is seeded via SQL; invite-management UI not built yet. Admin
  sees the list on `/settings` with a manual-add SQL snippet.

## Data model

See [supabase/migrations/0001_init.sql](supabase/migrations/0001_init.sql).

- `submissions.data` is `jsonb` — CSV columns vary per type, shape is
  flexible. `name`, `email`, `submitted_at` are extracted to top-level cols
  when present (field map in [lib/csv.ts](lib/csv.ts)).
- `submissions` has `unique (type, external_id)`. `external_id` is SHA-256
  of `email|submitted_at` (fallback: row hash). Re-uploads upsert on this,
  so `submissions.id` stays stable and attached judgments survive.
- `judgments` has `unique (user_id, submission_id)`. Verdicts are
  **team-readable** but **owner-writable** — RLS enforces.
- Aggregate analysis uses the `submission_verdict_counts` **view** (with
  `security_invoker = true`).

## Upload flow

1. Client picks type + file on `/upload`
2. papaparse parses client-side → preview first 10 rows
3. On "Import" → Server Action `importSubmissions` in
   [app/(app)/upload/actions.ts](app/(app)/upload/actions.ts):
   - Create `imports` row (audit)
   - Normalize each row (extract name/email/date, hash external_id)
   - Upsert `submissions` on `(type, external_id)`
   - Count new vs updated, patch the `imports` row

Re-uploading the same CSV is idempotent.

## Squarespace CSV quirks

- **acts**: name column is `"Primary Contact 11"`, email column is
  `"Primary Contact"` (yes, backwards). Date format: `M/D/YYYY`.
- **volunteers** + **workshops**: `Name`, `Email`, `Submitted On`. Date
  format: `MM/DD/YYYY HH:MM:SS`.

Field maps live in [lib/csv.ts](lib/csv.ts) — update there if the form
changes.

## RLS invariants (don't break these)

- `allowed_emails` is admin-only for select and write.
- `judgments` insert/update requires `user_id = auth.uid()`. Read is open to
  all authed users — team needs visibility.
- `submissions` and `imports` are read+insert by all authed users.
- Never bypass RLS from client code. Server-side use of the publishable key
  goes through the same RLS as the browser — that's the point.

## Future (not built)

Ticket tracking · marketing attribution · digital asset sharing · budget ·
production schedule · invite-management UI · blind-judging mode ·
rubric-based scoring.
