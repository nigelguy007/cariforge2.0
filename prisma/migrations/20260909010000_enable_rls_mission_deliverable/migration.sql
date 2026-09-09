-- Fix Supabase security lint: "RLS Disabled in Public" on public."MissionDeliverable".
--
-- Investigation (2026-09-09): MissionDeliverable has no user/owner column at
-- all (id, missionId, kind, content, createdAt) — the only relationship is
-- missionId -> Mission (soft FK by project convention, no DB constraint).
-- Confirmed via grep (same finding as SoftwareBuildJob): this app never uses
-- @supabase/supabase-js or the Data API anywhere in its source. All access
-- is server-side Prisma (src/lib/business/forge/deliverables.ts) over a
-- direct Postgres connection as the `postgres` role, which has
-- BYPASSRLS = true. No legitimate client-side (anon/authenticated) access
-- path exists for this table.
--
-- Confirmed via information_schema.role_table_grants: anon/authenticated
-- held full privileges (SELECT/INSERT/UPDATE/DELETE/TRUNCATE) with RLS
-- disabled — the same live Data-API exposure found on SoftwareBuildJob.
--
-- Fix: server-only pattern, identical to SoftwareBuildJob — revoke
-- Data-API-facing grants, enable RLS, no policies (none needed; a
-- USING (true) or invented ownership policy would be broader access than
-- this table actually requires).
--
-- Applied live via Supabase MCP on 2026-09-09; this file + the
-- _prisma_migrations backfill keep `prisma migrate deploy` in sync.
-- Verified via Supabase's security advisor: rls_disabled_in_public no
-- longer lists any table (both this fix and the prior SoftwareBuildJob
-- fix together clear the last two ERROR-level findings).

revoke all on public."MissionDeliverable" from anon, authenticated;

alter table public."MissionDeliverable" enable row level security;
