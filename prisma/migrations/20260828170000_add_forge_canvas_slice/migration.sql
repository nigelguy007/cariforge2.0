-- CreateTable
CREATE TABLE "CanvasAgentDefinition" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "riskClass" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Published',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CanvasAgentDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CanvasBlueprint" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "definition" JSONB NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CanvasBlueprint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CanvasRun" (
    "id" TEXT NOT NULL,
    "blueprintId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "state" JSONB NOT NULL,
    "currentNodeId" TEXT,
    "createdById" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "CanvasRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CanvasNodeRun" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "ordinal" INTEGER NOT NULL,
    "nodeId" TEXT NOT NULL,
    "nodeType" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "input" JSONB NOT NULL,
    "output" JSONB,
    "error" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "CanvasNodeRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CanvasTask" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Open',
    "reasonText" TEXT,
    "decidedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),

    CONSTRAINT "CanvasTask_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CanvasAgentDefinition_slug_key" ON "CanvasAgentDefinition"("slug");

-- CreateIndex
CREATE INDEX "CanvasBlueprint_slug_idx" ON "CanvasBlueprint"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "CanvasBlueprint_slug_version_key" ON "CanvasBlueprint"("slug", "version");

-- CreateIndex
CREATE INDEX "CanvasRun_createdById_startedAt_idx" ON "CanvasRun"("createdById", "startedAt");

-- CreateIndex
CREATE INDEX "CanvasNodeRun_runId_ordinal_idx" ON "CanvasNodeRun"("runId", "ordinal");

-- CreateIndex
CREATE INDEX "CanvasTask_status_createdAt_idx" ON "CanvasTask"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "CanvasRun" ADD CONSTRAINT "CanvasRun_blueprintId_fkey" FOREIGN KEY ("blueprintId") REFERENCES "CanvasBlueprint"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CanvasNodeRun" ADD CONSTRAINT "CanvasNodeRun_runId_fkey" FOREIGN KEY ("runId") REFERENCES "CanvasRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CanvasTask" ADD CONSTRAINT "CanvasTask_runId_fkey" FOREIGN KEY ("runId") REFERENCES "CanvasRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

