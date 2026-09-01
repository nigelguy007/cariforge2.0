-- PR A6: publish/promote for real. Additive, defaulted — every existing
-- saved blueprint version becomes Draft (its true prior state; nothing
-- claimed Published before this release existed).
ALTER TABLE "CanvasBlueprint" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'Draft';
