-- @polsia:user-owned — R4 (mission pipeline rebuild): 4th gate outcome,
-- approve-with-controls. Purely additive: a new enum value + a nullable
-- text column. Forward-only, idempotent (safe to re-run against a
-- partially-applied DB), matching this repo's existing migration style.

-- AlterEnum
ALTER TYPE "ApprovalDecision" ADD VALUE IF NOT EXISTS 'ApproveWithControls';

-- AlterTable
ALTER TABLE "Approval" ADD COLUMN IF NOT EXISTS "controls" TEXT;
