-- @polsia:user-owned — TAG Caribbean pilot Oracle Council migration.
-- Adds the OracleRole + SpecialistRole enums and the two governance tables
-- (MissionOracleAssignment, StageHandoffSpecialistAttester) that round out
-- the Elder-attestation rules. Forward-only: idempotent via the
-- DO block so re-running against a partially-applied DB is safe.

-- CreateEnum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'OracleRole') THEN
    CREATE TYPE "OracleRole" AS ENUM (
      'NeedOracle',
      'ReadinessOracle',
      'WorkflowOracle',
      'GovernanceOracle',
      'BuildOracle',
      'ElderOracle'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SpecialistRole') THEN
    CREATE TYPE "SpecialistRole" AS ENUM (
      'Risk',
      'Demand',
      'Growth',
      'Competition',
      'Money'
    );
  END IF;
END $$;

-- CreateTable: MissionOracleAssignment
CREATE TABLE IF NOT EXISTS "MissionOracleAssignment" (
    "id"            TEXT NOT NULL,
    "missionId"     TEXT NOT NULL,
    "role"          "OracleRole" NOT NULL,
    "userId"        TEXT NOT NULL,
    "appointedById" TEXT NOT NULL,
    "appointedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MissionOracleAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable: StageHandoffSpecialistAttester
CREATE TABLE IF NOT EXISTS "StageHandoffSpecialistAttester" (
    "id"        TEXT NOT NULL,
    "handoffId" TEXT NOT NULL,
    "userId"    TEXT NOT NULL,
    "role"      "SpecialistRole" NOT NULL,
    "signedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StageHandoffSpecialistAttester_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: MissionOracleAssignment
CREATE UNIQUE INDEX IF NOT EXISTS "MissionOracleAssignment_missionId_role_key"
  ON "MissionOracleAssignment"("missionId", "role");
CREATE INDEX IF NOT EXISTS "MissionOracleAssignment_missionId_idx"
  ON "MissionOracleAssignment"("missionId");
CREATE INDEX IF NOT EXISTS "MissionOracleAssignment_userId_idx"
  ON "MissionOracleAssignment"("userId");

-- CreateIndex: StageHandoffSpecialistAttester
CREATE UNIQUE INDEX IF NOT EXISTS "StageHandoffSpecialistAttester_handoffId_userId_key"
  ON "StageHandoffSpecialistAttester"("handoffId", "userId");
CREATE INDEX IF NOT EXISTS "StageHandoffSpecialistAttester_handoffId_idx"
  ON "StageHandoffSpecialistAttester"("handoffId");
