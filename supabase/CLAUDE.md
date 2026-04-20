# Supabase

Schema lives in [migrations/0001_init.sql](migrations/0001_init.sql). The
migrations folder is the source of truth for version control, but the
actual DB is managed through the Supabase MCP — apply changes with
`mcp__…__apply_migration`, not the Supabase CLI.

## Project

- Project ref: `rvbjqcgbynuwgatuflbj`
- Region: us-east-1
- URL in `.env.local` as `NEXT_PUBLIC_SUPABASE_URL`

## Tables

- `profiles` — one row per auth user; created automatically by the
  `handle_new_user` trigger. `role` is `'admin' | 'member'`.
- `allowed_emails` — invite allowlist. Trigger rejects signups whose email
  isn't here.
- `submissions` — type + external_id + name/email/submitted_at + `data jsonb`.
  Unique on `(type, external_id)` for idempotent re-import.
- `imports` — audit row per CSV upload.
- `judgments` — per-user verdicts on submissions. Unique on
  `(user_id, submission_id)`.

## View

- `submission_verdict_counts` — aggregate yes/no/maybe counts per
  submission. Declared with `security_invoker = true`, so it respects the
  caller's RLS on the underlying `judgments` table.

## Auth trigger

`public.handle_new_user()` runs `security definer` on
`auth.users` insert:
1. Lowercase the email, check it's in `allowed_emails` — raise otherwise.
2. Insert a `profiles` row. The first profile ever created becomes admin.

## RLS shape

- `profiles`: all authed users can read; update self only.
- `allowed_emails`: only `role='admin'` can read/write.
- `submissions`, `imports`: all authed users can read/insert.
- `judgments`: all authed users can read (team visibility); insert/update/
  delete only allowed where `user_id = auth.uid()` (private ownership).

## Regenerating types

After any migration:

```
npx supabase gen types typescript --project-id rvbjqcgbynuwgatuflbj \
  > lib/database.types.ts
```

## Seeding

[seed.sql](seed.sql) adds the initial admin email. Not run automatically —
execute via the SQL editor or MCP `execute_sql` the first time.
