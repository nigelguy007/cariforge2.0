-- CreateEnum
CREATE TYPE "SoftwareBuildJobStatus" AS ENUM ('Planning', 'Generating', 'Finalizing', 'Done', 'Failed');

-- CreateTable
CREATE TABLE "SoftwareBuildJob" (
    "id" TEXT NOT NULL,
    "missionId" TEXT NOT NULL,
    "status" "SoftwareBuildJobStatus" NOT NULL DEFAULT 'Planning',
    "plan" JSONB,
    "files" JSONB NOT NULL DEFAULT '[]',
    "nextFileIndex" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SoftwareBuildJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SoftwareBuildJob_missionId_createdAt_idx" ON "SoftwareBuildJob"("missionId", "createdAt");
