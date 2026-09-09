-- Fix Supabase security lint: "RLS Disabled in Public" on public."SoftwareBuildJob".
--
-- Investigation (2026-09-09): SoftwareBuildJob has no organizationId/userId
-- FK beyond Mission.createdById (a single creating user; no team/org
-- concept exists anywhere in this schema). No DB-level foreign keys are
-- declared on this table (missionId/createdById are scalar FKs by project
-- convention, enforced in application code, not the database).
--
-- Confirmed via grep: this app never uses @supabase/supabase-js or the
-- Supabase Data API (PostgREST) anywhere in its source — all access goes
-- through Prisma over a direct Postgres connection using the `postgres`
-- role, which has BYPASSRLS = true (confirmed via pg_roles). This table is
-- backend-only: enabling RLS with zero policies cannot break the app,
-- because the app's own DB connection bypasses RLS by role attribute, not
-- by policy.
--
-- Confirmed via information_schema.role_table_grants: `anon` and
-- `authenticated` currently hold FULL privileges (SELECT, INSERT, UPDATE,
-- DELETE, TRUNCATE, REFERENCES, TRIGGER) on this table — a real, live
-- exposure: with RLS disabled, any caller with the public anon key could
-- read or destroy every build job directly via the Data API, bypassing the
-- Next.js app entirely. This is Supabase's default new-table grant
-- behavior, not something the app intentionally opted into.
--
-- Fix: revoke all Data-API-facing privileges from anon/authenticated (this
-- table was never meant to be client-accessible), then enable RLS as
-- defense in depth so even a future accidental grant can't expose rows
-- without an explicit policy. No policies are added: there is no
-- legitimate client-side (anon/authenticated) use case for this table
-- today, and a permissive `true` policy would defeat the purpose entirely.
-- Applied live via Supabase MCP on 2026-09-09; this file records it for
-- prisma migrate deploy / drift-checking (see _prisma_migrations backfill
-- convention documented in prior migrations in this directory).

revoke all on public."SoftwareBuildJob" from anon, authenticated;

alter table public."SoftwareBuildJob" enable row level security;
