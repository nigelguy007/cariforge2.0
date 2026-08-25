// @polsia:user-owned — shared zod contract for the telemetry surface.
// Single source of truth for /api/forge/missions/:id/telemetry,
// /api/forge/admin/telemetry, and the islands that consume them. No
// server-only imports (safe for the client bundle).

import { z } from 'zod';
import { STAGE_NAMES } from './forge';

// === Enums (mirror prisma) ===================================================

export const RELEASE_ACTOR_VALUES = ['AIOnly', 'Human', 'Hybrid'] as const;
export type ReleaseActorT = (typeof RELEASE_ACTOR_VALUES)[number];

export const CREDIT_SOURCE_VALUES = [
  'StripeCharge',
  'ManualTopUp',
  'ModelUsage',
  'ChatUsage',
  'Refund',
] as const;
export type CreditSourceT = (typeof CREDIT_SOURCE_VALUES)[number];

// === Actor kind (matches ApprovalActorTag.actorKind) ========================

export const ACTOR_KIND_VALUES = ['AI', 'Human'] as const;
export type ActorKindT = (typeof ACTOR_KIND_VALUES)[number];

// === Gate decision counts ====================================================

export const GateDecisionCount = z.object({
  gateIndex: z.number().int().min(0).max(4),
  stage: z.enum(STAGE_NAMES),
  approved: z.number().int().nonnegative(),
  edited: z.number().int().nonnegative(),
  rejected: z.number().int().nonnegative(),
  aiOnlyApprovals: z.number().int().nonnegative(),
  humanApprovals: z.number().int().nonnegative(),
});
export type GateDecisionCountT = z.infer<typeof GateDecisionCount>;

export const MissionAutonomy = z.object({
  missionId: z.string(),
  missionSlug: z.string(),
  status: z.string(), // MissionStatus enum from forge.ts; kept loose here to avoid coupling
  currentStageIndex: z.number().int(),
  gates: z.array(GateDecisionCount),
  releaseActor: z.enum(RELEASE_ACTOR_VALUES),
  draftAge: z.object({
    daysOld: z.number().int().nonnegative(),
    bucket: z.enum(['<1d', '1-3d', '3-7d', '7+d']),
    isAwaiting: z.boolean(),
  }),
});
export type MissionAutonomyT = z.infer<typeof MissionAutonomy>;

// === Mission cost rollup ====================================================

export const MissionCostByDay = z.object({
  day: z.string(), // YYYY-MM-DD
  cents: z.number().int(),
  messages: z.number().int().nonnegative(),
});
export type MissionCostByDayT = z.infer<typeof MissionCostByDay>;

export const MissionCost = z.object({
  missionId: z.string(),
  modelCents: z.number().int(),
  chatCents: z.number().int(),
  blendedCents: z.number().int(),
  hasUnknownCost: z.boolean(),
  byDay: z.array(MissionCostByDay),
});
export type MissionCostT = z.infer<typeof MissionCost>;

export const MissionTelemetryRead = z.object({
  autonomy: MissionAutonomy,
  cost: MissionCost,
});
export type MissionTelemetryReadT = z.infer<typeof MissionTelemetryRead>;

// === Operator control plane row (admin) ====================================

export const OperatorControlPlaneRow = z.object({
  missionId: z.string(),
  missionSlug: z.string(),
  missionName: z.string(),
  missionStatus: z.string(),
  currentStageIndex: z.number().int(),
  releaseActor: z.enum(RELEASE_ACTOR_VALUES),
  draftAgeBucket: z.enum(['<1d', '1-3d', '3-7d', '7+d']),
  isAwaiting: z.boolean(),
  latestGateState: z.enum(['Awaiting', 'Approved', 'Returned', 'Refused']),
  blendedCents: z.number().int(),
  hasUnknownCost: z.boolean(),
});
export type OperatorControlPlaneRowT = z.infer<typeof OperatorControlPlaneRow>;

export const OperatorControlPlane = z.object({
  rows: z.array(OperatorControlPlaneRow),
});
export type OperatorControlPlaneT = z.infer<typeof OperatorControlPlane>;

// === Admin overview =========================================================

export const AutonomyLadderRow = z.object({
  gateIndex: z.number().int().min(0).max(4),
  stage: z.enum(STAGE_NAMES),
  approvedTotal: z.number().int().nonnegative(),
  editedTotal: z.number().int().nonnegative(),
  rejectedTotal: z.number().int().nonnegative(),
  aiOnlyShare: z.number().min(0).max(1),
});
export type AutonomyLadderRowT = z.infer<typeof AutonomyLadderRow>;

export const CompanyCredit = z.object({
  companyId: z.string(),
  netCents: z.number().int(), // signed net (debits net negative; credits positive)
  credits: z.number().int().nonnegative(),
  debits: z.number().int().nonnegative(),
});
export type CompanyCreditT = z.infer<typeof CompanyCredit>;

export const ChatCostByDay = z.object({
  day: z.string(),
  cents: z.number().int(),
  messages: z.number().int().nonnegative(),
  hasUnknownCost: z.boolean(),
});
export type ChatCostByDayT = z.infer<typeof ChatCostByDay>;

export const AdminTelemetryOverview = z.object({
  autonomyLadder: z.array(AutonomyLadderRow),
  perCompanyCredit: z.array(CompanyCredit),
  chatCostByDay: z.array(ChatCostByDay),
});
export type AdminTelemetryOverviewT = z.infer<typeof AdminTelemetryOverview>;

// === Write shapes (POST bodies) =============================================

export const ModelUsageWrite = z.object({
  model: z.string().trim().min(1).max(200),
  provider: z.string().trim().min(1).max(80),
  promptTokens: z.number().int().nonnegative().max(100_000_000),
  completionTokens: z.number().int().nonnegative().max(100_000_000),
  attributedActor: z.enum(RELEASE_ACTOR_VALUES).default('AIOnly'),
  taskId: z.string().trim().min(1).max(80).optional(),
  occurredAt: z
    .string()
    .datetime()
    .optional()
    .transform((v) => v ?? undefined),
});
export type ModelUsageWriteT = z.infer<typeof ModelUsageWrite>;

export const ChatUsageWrite = z.object({
  scope: z.enum(['platform', 'mission', 'company']),
  model: z.string().trim().min(1).max(200),
  messageCount: z.number().int().min(0).max(1_000_000),
  companyId: z.string().trim().max(80).optional(),
  windowStart: z.string().datetime(),
  windowEnd: z.string().datetime(),
});
export type ChatUsageWriteT = z.infer<typeof ChatUsageWrite>;

export const UsageRecordWrite = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('model'), data: ModelUsageWrite }),
  z.object({ kind: z.literal('chat'), data: ChatUsageWrite }),
]);
export type UsageRecordWriteT = z.infer<typeof UsageRecordWrite>;

export const ReleaseSourceActorInput = z.object({
  actor: z.enum(RELEASE_ACTOR_VALUES),
  decidedById: z.string().trim().min(1).max(80).optional(),
  reasonText: z.string().trim().min(1).max(2000).optional(),
});
export type ReleaseSourceActorInputT = z.infer<typeof ReleaseSourceActorInput>;

export const UsageRecordRead = z.object({
  id: z.string(),
  kind: z.enum(['model', 'chat']),
  unknownCost: z.boolean(),
  costCents: z.number().int(),
});
export type UsageRecordReadT = z.infer<typeof UsageRecordRead>;
