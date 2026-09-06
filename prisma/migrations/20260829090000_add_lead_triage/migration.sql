-- Product decision (2026-08-29): the front-door brief's first response is a
-- fully-automated Discovery-agent read, stored so the confirmation UI (and
-- later the dashboard's open-brief card) can render it. Additive, nullable.

ALTER TABLE "Lead" ADD COLUMN "triage" JSONB;
