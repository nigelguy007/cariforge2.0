-- @polsia:framework-owned - DO NOT EDIT. Code installed by polsia/modules/better-auth@0.3.0. Drift = commit rejected.
-- Forward-only, idempotent (safe to re-run against a partially-applied DB,
-- matching this repo's existing migration style).
--
-- Adds `issuer` to "account": the installed `better-auth` package (1.7.1)
-- added a required `issuer` field + a unique (issuer, accountId) index to its
-- core Account schema (@better-auth/core/dist/db/schema/account.mjs), used to
-- key local vs. OAuth accounts. Every account.create() call — including plain
-- email/password sign-up — now sets it, so its absence made sign-up 500 with
-- `PrismaClientValidationError: Unknown argument issuer`.
--
-- IF NOT EXISTS / backfill-then-constrain: some rows may already have a
-- nullable "issuer" set from an earlier ad-hoc `prisma db push` against a
-- schema that briefly carried this field outside of migration history.

-- AlterTable
ALTER TABLE "account" ADD COLUMN IF NOT EXISTS "issuer" TEXT;

-- Backfill any existing rows. This app only has emailAndPassword enabled
-- (see src/lib/auth-config.ts — no social providers), so every pre-existing
-- account row is a local credential account; mirror better-auth's own
-- createLocalAccountIssuer(providerId) = `local:${providerId}` convention.
UPDATE "account" SET "issuer" = 'local:' || "providerId" WHERE "issuer" IS NULL;

-- AlterColumn
ALTER TABLE "account" ALTER COLUMN "issuer" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "account_issuer_accountId_key" ON "account"("issuer", "accountId");
