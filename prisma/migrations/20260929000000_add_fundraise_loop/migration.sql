-- CreateTable
CREATE TABLE "FundraiseLoopConfig" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "batchSize" INTEGER NOT NULL DEFAULT 40,
    "minSegmentShare" DOUBLE PRECISION NOT NULL DEFAULT 0.1,
    "explorationFloor" DOUBLE PRECISION NOT NULL DEFAULT 0.05,
    "minTrialsBeforeCut" INTEGER NOT NULL DEFAULT 100,
    "minWeeksRunway" INTEGER NOT NULL DEFAULT 8,
    "sendingEnabled" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FundraiseLoopConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FundraiseSegment" (
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'vc',
    "estUniverse" INTEGER NOT NULL,
    "lagDays" INTEGER NOT NULL DEFAULT 21,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FundraiseSegment_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "FundraiseBatch" (
    "id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING_APPROVAL',
    "plan" JSONB NOT NULL,
    "note" TEXT,
    "decidedBy" TEXT,
    "decidedAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FundraiseBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FundraiseProspect" (
    "id" TEXT NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "segmentKey" TEXT NOT NULL,
    "batchId" TEXT,
    "fullName" TEXT NOT NULL,
    "firm" TEXT,
    "title" TEXT,
    "linkedinUrl" TEXT,
    "email" TEXT,
    "sourceRef" TEXT,
    "lane" TEXT NOT NULL DEFAULT 'COLD',
    "warmPath" TEXT,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FundraiseProspect_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FundraiseEvent" (
    "id" TEXT NOT NULL,
    "prospectId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FundraiseEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FundraiseIdentity" (
    "key" TEXT NOT NULL,
    "prospectId" TEXT NOT NULL,

    CONSTRAINT "FundraiseIdentity_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "FundraiseBatch_status_createdAt_idx" ON "FundraiseBatch"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "FundraiseProspect_dedupeKey_key" ON "FundraiseProspect"("dedupeKey");

-- CreateIndex
CREATE INDEX "FundraiseProspect_segmentKey_status_idx" ON "FundraiseProspect"("segmentKey", "status");

-- CreateIndex
CREATE INDEX "FundraiseProspect_batchId_idx" ON "FundraiseProspect"("batchId");

-- CreateIndex
CREATE INDEX "FundraiseEvent_type_idx" ON "FundraiseEvent"("type");

-- CreateIndex
CREATE UNIQUE INDEX "FundraiseEvent_prospectId_type_key" ON "FundraiseEvent"("prospectId", "type");

-- CreateIndex
CREATE INDEX "FundraiseIdentity_prospectId_idx" ON "FundraiseIdentity"("prospectId");

-- AddForeignKey
ALTER TABLE "FundraiseProspect" ADD CONSTRAINT "FundraiseProspect_segmentKey_fkey" FOREIGN KEY ("segmentKey") REFERENCES "FundraiseSegment"("key") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FundraiseProspect" ADD CONSTRAINT "FundraiseProspect_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "FundraiseBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FundraiseEvent" ADD CONSTRAINT "FundraiseEvent_prospectId_fkey" FOREIGN KEY ("prospectId") REFERENCES "FundraiseProspect"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FundraiseIdentity" ADD CONSTRAINT "FundraiseIdentity_prospectId_fkey" FOREIGN KEY ("prospectId") REFERENCES "FundraiseProspect"("id") ON DELETE CASCADE ON UPDATE CASCADE;

