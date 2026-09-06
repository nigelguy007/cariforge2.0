-- Baseline migration for modules that were never migrated: forge.prisma,
-- forge-telemetry.prisma, leads.prisma, testimonials.prisma, work-items.prisma,
-- council-runs.prisma. These tables/enums existed in local dev (created via an
-- earlier ad-hoc `prisma db push` or uncommitted `migrate dev` run) but had no
-- corresponding migration file in this repo, so a fresh database could never
-- build this schema from scratch. Generated via `prisma migrate diff` against
-- the live post-migration-3 database state, then trimmed to exclude the
-- ApproveWithControls enum value and account.issuer column/index, which the
-- existing 20260826020000_add_approve_with_controls and
-- 20260826120000_add_account_issuer migrations already handle idempotently.

-- CreateEnum
CREATE TYPE "RunStatus" AS ENUM ('Pending', 'Running', 'Succeeded', 'Failed', 'WalkedAway');

-- CreateEnum
CREATE TYPE "Verdict" AS ENUM ('Build', 'TestFirst', 'WalkAway');

-- CreateEnum
CREATE TYPE "ReleaseActor" AS ENUM ('AIOnly', 'Human', 'Hybrid');

-- CreateEnum
CREATE TYPE "CreditSource" AS ENUM ('StripeCharge', 'ManualTopUp', 'ModelUsage', 'ChatUsage', 'Refund');

-- CreateEnum
CREATE TYPE "MissionStatus" AS ENUM ('Draft', 'InDiscovery', 'InReadiness', 'InWorkflow', 'InGovernance', 'InBuild', 'AwaitingApproval', 'Paused', 'Blocked', 'Rejected', 'Completed', 'WalkedAway', 'RolledBack');

-- CreateEnum
CREATE TYPE "StageName" AS ENUM ('Discovery', 'Readiness', 'Workflow', 'Governance', 'SoftwareBuild');

-- CreateEnum
CREATE TYPE "ApprovalDecision" AS ENUM ('Approve', 'Return', 'Refuse');

-- CreateEnum
CREATE TYPE "ObjectionResolution" AS ENUM ('Overruled', 'CarriedForward', 'OwnerResolved', 'Closed');

-- CreateEnum
CREATE TYPE "EvidenceKind" AS ENUM ('Text', 'File', 'Url', 'TestRun', 'Attestation', 'ExternalRef');

-- CreateEnum
CREATE TYPE "ToolScope" AS ENUM ('Internal', 'External');

-- CreateEnum
CREATE TYPE "ToolDecision" AS ENUM ('Approved', 'Denied');

-- CreateEnum
CREATE TYPE "TestimonialSector" AS ENUM ('FinancialServices', 'Insurance', 'PublicSector', 'Healthcare');

-- CreateEnum
CREATE TYPE "WorkItemStatus" AS ENUM ('Open', 'InProgress', 'InTest', 'Rework', 'Passed', 'Failed', 'Deferred');

-- CreateTable
CREATE TABLE "CouncilRun" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "status" "RunStatus" NOT NULL DEFAULT 'Pending',
    "verdict" "Verdict",
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "error" TEXT,

    CONSTRAINT "CouncilRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReleaseSource" (
    "id" TEXT NOT NULL,
    "missionId" TEXT NOT NULL,
    "actor" "ReleaseActor" NOT NULL,
    "decidedById" TEXT,
    "draftCapturedAt" TIMESTAMP(3) NOT NULL,
    "releasedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reasonText" TEXT,

    CONSTRAINT "ReleaseSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModelUsageRecord" (
    "id" TEXT NOT NULL,
    "missionId" TEXT,
    "taskId" TEXT,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "promptTokens" INTEGER NOT NULL,
    "completionTokens" INTEGER NOT NULL,
    "costCents" INTEGER NOT NULL,
    "unknownCost" BOOLEAN NOT NULL DEFAULT false,
    "attributedActor" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModelUsageRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatUsageRecord" (
    "id" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "companyId" TEXT,
    "missionId" TEXT,
    "messageCount" INTEGER NOT NULL,
    "model" TEXT NOT NULL,
    "costCents" INTEGER NOT NULL,
    "unknownCost" BOOLEAN NOT NULL DEFAULT false,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "windowEnd" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChatUsageRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditLedgerEntry" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "source" "CreditSource" NOT NULL,
    "attribution" JSONB,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreditLedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApprovalActorTag" (
    "id" TEXT NOT NULL,
    "approvalId" TEXT NOT NULL,
    "actorKind" TEXT NOT NULL,
    "actorLabel" TEXT,
    "taggedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApprovalActorTag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Mission" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "intake" TEXT NOT NULL,
    "normalizedNeed" TEXT NOT NULL,
    "status" "MissionStatus" NOT NULL DEFAULT 'Draft',
    "currentStageIndex" INTEGER NOT NULL DEFAULT 0,
    "currentDraftVersion" INTEGER,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "pausedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "rolledBackAt" TIMESTAMP(3),
    "previousStatus" "MissionStatus",
    "intakeStructured" JSONB,
    "releaseReadoutAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "domainTags" TEXT[],

    CONSTRAINT "Mission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StageHandoff" (
    "id" TEXT NOT NULL,
    "missionId" TEXT NOT NULL,
    "stage" "StageName" NOT NULL,
    "version" INTEGER NOT NULL,
    "parentVersionId" TEXT,
    "correctionOfId" TEXT,
    "supersededById" TEXT,
    "replayOfMissionId" TEXT,
    "payload" JSONB NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "missingEvidence" JSONB NOT NULL,
    "toolRefs" TEXT[],
    "producedByToolActionId" TEXT,
    "gateIndexThatApproves" INTEGER NOT NULL,
    "invalidationReasonCode" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StageHandoff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Approval" (
    "id" TEXT NOT NULL,
    "missionId" TEXT NOT NULL,
    "gateIndex" INTEGER NOT NULL,
    "stageHandoffId" TEXT NOT NULL,
    "approverUserId" TEXT,
    "decision" "ApprovalDecision" NOT NULL,
    "controls" TEXT,
    "reasonCode" TEXT NOT NULL,
    "reasonText" TEXT NOT NULL,
    "supersedesApprovalId" TEXT,
    "replayOfApprovalId" TEXT,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Approval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Objection" (
    "id" TEXT NOT NULL,
    "missionId" TEXT NOT NULL,
    "stageHandoffId" TEXT NOT NULL,
    "raisedByRole" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "evidenceRefId" TEXT,
    "raisedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolution" "ObjectionResolution",
    "resolutionText" TEXT,

    CONSTRAINT "Objection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvidenceItem" (
    "id" TEXT NOT NULL,
    "missionId" TEXT NOT NULL,
    "attachedToStageHandoffId" TEXT,
    "kind" "EvidenceKind" NOT NULL,
    "ref" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "capturedById" TEXT NOT NULL,

    CONSTRAINT "EvidenceItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ToolAction" (
    "id" TEXT NOT NULL,
    "missionId" TEXT NOT NULL,
    "tool" TEXT NOT NULL,
    "scope" "ToolScope" NOT NULL,
    "payload" JSONB NOT NULL,
    "requestedById" TEXT NOT NULL,
    "decidedById" TEXT,
    "decision" "ToolDecision",
    "decisionReasonCode" TEXT,
    "requiresGateApproval" BOOLEAN NOT NULL DEFAULT false,
    "approvedGateIndex" INTEGER,
    "decidedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "executedAt" TIMESTAMP(3),
    "resultRef" TEXT,
    "rollbackOfToolActionId" TEXT,
    "producedStageHandoffId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ToolAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MissionAudit" (
    "id" TEXT NOT NULL,
    "missionId" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actorId" TEXT,
    "missionVersionAtEvent" INTEGER NOT NULL,

    CONSTRAINT "MissionAudit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "brief" TEXT NOT NULL,
    "email" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notifiedAt" TIMESTAMP(3),
    "source" TEXT,
    "payload" TEXT,
    "notes" TEXT,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Testimonial" (
    "id" TEXT NOT NULL,
    "sector" "TestimonialSector" NOT NULL,
    "quote" TEXT NOT NULL,
    "attributedRole" TEXT NOT NULL,
    "organisation" TEXT NOT NULL,
    "contact" TEXT,
    "quoteDate" TIMESTAMP(3) NOT NULL,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Testimonial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkItem" (
    "id" TEXT NOT NULL,
    "missionId" TEXT NOT NULL,
    "parentStageHandoffId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "acceptanceCriteria" TEXT NOT NULL,
    "ownerUserId" TEXT,
    "status" "WorkItemStatus" NOT NULL DEFAULT 'Open',
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "testEvidenceRefIds" TEXT[],
    "supersededById" TEXT,

    CONSTRAINT "WorkItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CouncilRun_leadId_idx" ON "CouncilRun"("leadId");

-- CreateIndex
CREATE INDEX "CouncilRun_status_idx" ON "CouncilRun"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ReleaseSource_missionId_key" ON "ReleaseSource"("missionId");

-- CreateIndex
CREATE INDEX "ReleaseSource_actor_idx" ON "ReleaseSource"("actor");

-- CreateIndex
CREATE INDEX "ReleaseSource_releasedAt_idx" ON "ReleaseSource"("releasedAt");

-- CreateIndex
CREATE INDEX "ModelUsageRecord_missionId_occurredAt_idx" ON "ModelUsageRecord"("missionId", "occurredAt");

-- CreateIndex
CREATE INDEX "ModelUsageRecord_model_idx" ON "ModelUsageRecord"("model");

-- CreateIndex
CREATE INDEX "ModelUsageRecord_occurredAt_idx" ON "ModelUsageRecord"("occurredAt");

-- CreateIndex
CREATE INDEX "ChatUsageRecord_scope_windowStart_idx" ON "ChatUsageRecord"("scope", "windowStart");

-- CreateIndex
CREATE INDEX "ChatUsageRecord_companyId_windowStart_idx" ON "ChatUsageRecord"("companyId", "windowStart");

-- CreateIndex
CREATE INDEX "CreditLedgerEntry_companyId_at_idx" ON "CreditLedgerEntry"("companyId", "at");

-- CreateIndex
CREATE INDEX "CreditLedgerEntry_source_idx" ON "CreditLedgerEntry"("source");

-- CreateIndex
CREATE INDEX "ApprovalActorTag_approvalId_idx" ON "ApprovalActorTag"("approvalId");

-- CreateIndex
CREATE INDEX "ApprovalActorTag_actorKind_idx" ON "ApprovalActorTag"("actorKind");

-- CreateIndex
CREATE UNIQUE INDEX "Mission_slug_key" ON "Mission"("slug");

-- CreateIndex
CREATE INDEX "Mission_createdById_idx" ON "Mission"("createdById");

-- CreateIndex
CREATE INDEX "Mission_status_idx" ON "Mission"("status");

-- CreateIndex
CREATE INDEX "StageHandoff_missionId_stage_version_idx" ON "StageHandoff"("missionId", "stage", "version");

-- CreateIndex
CREATE INDEX "StageHandoff_missionId_stage_idx" ON "StageHandoff"("missionId", "stage");

-- CreateIndex
CREATE INDEX "StageHandoff_missionId_createdAt_idx" ON "StageHandoff"("missionId", "createdAt");

-- CreateIndex
CREATE INDEX "Approval_missionId_gateIndex_idx" ON "Approval"("missionId", "gateIndex");

-- CreateIndex
CREATE INDEX "Approval_missionId_at_idx" ON "Approval"("missionId", "at");

-- CreateIndex
CREATE UNIQUE INDEX "Approval_missionId_gateIndex_stageHandoffId_key" ON "Approval"("missionId", "gateIndex", "stageHandoffId");

-- CreateIndex
CREATE INDEX "Objection_missionId_raisedAt_idx" ON "Objection"("missionId", "raisedAt");

-- CreateIndex
CREATE INDEX "EvidenceItem_missionId_capturedAt_idx" ON "EvidenceItem"("missionId", "capturedAt");

-- CreateIndex
CREATE INDEX "EvidenceItem_missionId_idx" ON "EvidenceItem"("missionId");

-- CreateIndex
CREATE INDEX "ToolAction_missionId_createdAt_idx" ON "ToolAction"("missionId", "createdAt");

-- CreateIndex
CREATE INDEX "ToolAction_missionId_idx" ON "ToolAction"("missionId");

-- CreateIndex
CREATE INDEX "MissionAudit_missionId_at_idx" ON "MissionAudit"("missionId", "at");

-- CreateIndex
CREATE INDEX "Lead_createdAt_idx" ON "Lead"("createdAt");

-- CreateIndex
CREATE INDEX "Testimonial_published_sector_idx" ON "Testimonial"("published", "sector");

-- CreateIndex
CREATE INDEX "WorkItem_missionId_status_idx" ON "WorkItem"("missionId", "status");

-- CreateIndex
CREATE INDEX "WorkItem_missionId_parentStageHandoffId_idx" ON "WorkItem"("missionId", "parentStageHandoffId");

