// @polsia:user-owned — shared zod contract for the fundraise loop. Imported by
// the /api/admin/fundraise/* and /api/fundraise-loop/runner/* handlers AND the
// /admin/fundraise client island. Client-importable: zod only.

import { z } from 'zod';

export const BATCH_STATUSES = ['PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'SENT'] as const;
export const BatchStatus = z.enum(BATCH_STATUSES);
export type BatchStatus = z.infer<typeof BatchStatus>;

export const EVENT_TYPES = [
  'REPLY',
  'MEETING',
  'SECOND_MEETING',
  'TERM_SHEET',
  'PASS',
  'BOUNCE',
] as const;
export const EventType = z.enum(EVENT_TYPES);
export type EventType = z.infer<typeof EventType>;

export const Lane = z.enum(['COLD', 'WARM']);
export const ProspectStatus = z.enum(['QUEUED', 'SKIPPED', 'SENT', 'INTRO_REQUESTED']);
export const SegmentStatus = z.enum(['ACTIVE', 'PAUSED']);

// ── Runner: batch ingest (from the scheduled Claude routine) ───────────────
export const ProspectInput = z
  .object({
    segmentKey: z.string().min(1),
    fullName: z.string().trim().min(1).max(200),
    firm: z.string().trim().max(200).optional(),
    title: z.string().trim().max(200).optional(),
    linkedinUrl: z.string().trim().max(500).optional(),
    email: z.string().trim().email().optional(),
    sourceRef: z.string().trim().max(200).optional(),
    warmPath: z.string().trim().max(500).optional(),
  })
  .strict();
export type ProspectInput = z.infer<typeof ProspectInput>;

export const BatchIngest = z.object({
  prospects: z.array(ProspectInput).min(1).max(500),
  note: z.string().max(2000).optional(),
});
export type BatchIngest = z.infer<typeof BatchIngest>;

export const BatchIngestResult = z.object({
  batchId: z.string().nullable(),
  created: z.number().int(),
  duplicates: z.number().int(),
  warm: z.number().int(),
  unknownSegment: z.number().int(),
  // Rows with no usable identity (no LinkedIn handle, email, or name+firm):
  // rejected, since they could never be deduped.
  invalid: z.number().int(),
});
export type BatchIngestResult = z.infer<typeof BatchIngestResult>;

// ── Events (runner or admin import) ────────────────────────────────────────
// A prospect is identified by any identifier the dedupe normaliser accepts.
export const EventInput = z.object({
  identifier: z.string().trim().min(1).max(500),
  type: EventType,
  occurredAt: z.coerce.date(),
  note: z.string().max(1000).optional(),
});
export type EventInput = z.infer<typeof EventInput>;

export const EventIngest = z.object({ events: z.array(EventInput).min(1).max(1000) });
export const EventIngestResult = z.object({
  recorded: z.number().int(),
  alreadyRecorded: z.number().int(),
  unmatched: z.array(z.string()),
});
export type EventIngestResult = z.infer<typeof EventIngestResult>;

// ── Allocation / summary ───────────────────────────────────────────────────
export const Recommendation = z.enum([
  'insufficient-data',
  'keep',
  'lean-in',
  'consider-pausing',
  'exhausted',
]);

export const SegmentStats = z.object({
  key: z.string(),
  label: z.string(),
  query: z.string(),
  mode: z.string(),
  status: SegmentStatus,
  estUniverse: z.number().int(),
  lagDays: z.number().int(),
  contacted: z.number().int(),
  maturedTrials: z.number().int(),
  replies: z.number().int(),
  meetings: z.number().int(),
  posteriorMean: z.number(),
  probBest: z.number(),
  allocation: z.number().int(),
  burnPct: z.number(),
  weeksOfMarketLeft: z.number().nullable(),
  recommendation: Recommendation,
});
export type SegmentStats = z.infer<typeof SegmentStats>;

export const LoopPlan = z.object({
  generatedAt: z.string(),
  batchSize: z.number().int(),
  sendingEnabled: z.boolean(),
  segments: z.array(SegmentStats),
});
export type LoopPlan = z.infer<typeof LoopPlan>;

export const ProspectView = z.object({
  id: z.string(),
  segmentKey: z.string(),
  fullName: z.string(),
  firm: z.string().nullable(),
  title: z.string().nullable(),
  linkedinUrl: z.string().nullable(),
  sourceRef: z.string().nullable(),
  lane: Lane,
  warmPath: z.string().nullable(),
  status: ProspectStatus,
});
export type ProspectView = z.infer<typeof ProspectView>;

export const BatchView = z.object({
  id: z.string(),
  status: BatchStatus,
  note: z.string().nullable(),
  createdAt: z.string(),
  decidedBy: z.string().nullable(),
  decidedAt: z.string().nullable(),
  sentAt: z.string().nullable(),
  prospects: z.array(ProspectView),
});
export type BatchView = z.infer<typeof BatchView>;

export const LoopSummary = z.object({
  plan: LoopPlan,
  totals: z.object({
    contacted: z.number().int(),
    replies: z.number().int(),
    meetings: z.number().int(),
    pendingApproval: z.number().int(),
    warmIntros: z.number().int(),
  }),
  batches: z.array(BatchView),
  warmIntros: z.array(ProspectView),
});
export type LoopSummary = z.infer<typeof LoopSummary>;

// ── Admin mutations ────────────────────────────────────────────────────────
export const BatchDecision = z.discriminatedUnion('action', [
  z.object({ action: z.literal('approve'), note: z.string().max(2000).optional() }),
  z.object({ action: z.literal('reject'), note: z.string().max(2000).optional() }),
  z.object({ action: z.literal('skip'), prospectIds: z.array(z.string()).min(1) }),
]);
export type BatchDecision = z.infer<typeof BatchDecision>;

export const SegmentUpsert = z.object({
  key: z.string().regex(/^[a-z][a-z0-9-]{1,48}$/, 'Use a lowercase slug, e.g. caribbean-seed-vc'),
  label: z.string().trim().min(2).max(120),
  query: z.string().trim().min(10).max(1000),
  mode: z.enum(['vc', 'lp', 'real_estate', 'ria']),
  estUniverse: z.coerce.number().int().min(1).max(100000),
  lagDays: z.coerce.number().int().min(1).max(180),
  status: SegmentStatus,
});
export type SegmentUpsert = z.infer<typeof SegmentUpsert>;

export const ConfigUpdate = z.object({
  batchSize: z.coerce.number().int().min(1).max(500).optional(),
  minSegmentShare: z.coerce.number().min(0).max(0.5).optional(),
  explorationFloor: z.coerce.number().min(0).max(0.5).optional(),
  minTrialsBeforeCut: z.coerce.number().int().min(10).max(10000).optional(),
  minWeeksRunway: z.coerce.number().int().min(1).max(104).optional(),
  sendingEnabled: z.boolean().optional(),
});
export type ConfigUpdate = z.infer<typeof ConfigUpdate>;
