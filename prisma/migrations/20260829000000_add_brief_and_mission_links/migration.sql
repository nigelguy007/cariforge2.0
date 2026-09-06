-- UX review fixes C1 + C2 (wireframe v2, 2026-08-29): purely additive.
-- C1: a mission converted from a public brief keeps the Lead id so the
--     CF-XXXX reference follows it into the pipeline.
-- C2: a blueprint created from a mission's Software Build gate stays
--     linked to that mission.

ALTER TABLE "Mission" ADD COLUMN "sourceLeadId" TEXT;
CREATE INDEX "Mission_sourceLeadId_idx" ON "Mission"("sourceLeadId");

ALTER TABLE "CanvasBlueprint" ADD COLUMN "missionId" TEXT;
CREATE INDEX "CanvasBlueprint_missionId_idx" ON "CanvasBlueprint"("missionId");
