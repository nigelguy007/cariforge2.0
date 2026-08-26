// @polsia:user-owned — shared zod contract for the Forge control plane.
// Single source of truth shared between /api/forge/* handlers (server) and
// every client island under src/components/custom/missions/*. Keep this file
// client-importable: zod only, no server-only imports.

import { z } from 'zod';

// === Lifecycle enums (mirror Prisma enums) ====================================

export const MissionStatusValues = [
  'Draft',
  'InDiscovery',
  'InReadiness',
  'InWorkflow',
  'InGovernance',
  'InBuild',
  'AwaitingApproval',
  'Paused',
  'Blocked',
  'Rejected',
  'Completed',
  'WalkedAway',
  'RolledBack',
] as const;
export type MissionStatus = (typeof MissionStatusValues)[number];

export const StageNameValues = [
  'Discovery',
  'Readiness',
  'Workflow',
  'Governance',
  'SoftwareBuild',
] as const;
export type StageName = (typeof StageNameValues)[number];
export const STAGE_NAMES = StageNameValues;

export const GATE_REASON_CODES = [
  'EvidenceRequested',
  'ScopeMismatch',
  'GovernanceViolation',
  'DemandUnverified',
  'WalkAway',
  'StaleInformation',
  'OrderingCorrected',
  'Replanned',
  'UserCorrection',
  'ReplayRequired',
  'InsufficientConfidence',
  'Approved',
  'Other',
] as const;
export type ReasonCode = (typeof GATE_REASON_CODES)[number];

export const APPROVAL_DECISION_VALUES = ['Approve', 'Return', 'Refuse'] as const;
export type ApprovalDecision = (typeof APPROVAL_DECISION_VALUES)[number];

export const TOOL_SCOPE_VALUES = ['Internal', 'External'] as const;
export type ToolActionScope = (typeof TOOL_SCOPE_VALUES)[number];

export const TOOL_DECISION_VALUES = ['Approved', 'Denied'] as const;
export type ToolActionDecision = (typeof TOOL_DECISION_VALUES)[number];

export const EVIDENCE_KIND_VALUES = [
  'Text',
  'File',
  'Url',
  'TestRun',
  'Attestation',
  'ExternalRef',
] as const;
export type EvidenceKind = (typeof EVIDENCE_KIND_VALUES)[number];

export const OBJECTION_RESOLUTION_VALUES = [
  'Overruled',
  'CarriedForward',
  'OwnerResolved',
  'Closed',
] as const;
export type ObjectionResolution = (typeof OBJECTION_RESOLUTION_VALUES)[number];

// === TAG Oracle Council (TAG Caribbean pilot) =================================
// Five named human gates of The Oracles. One named human "Elder Oracle" must
// sign gates 0 (Need Discovery) and 4 (Software Build); the other three gates
// are signed by the named specialist for that stage. Specialist voice is one
// of Risk / Demand / Growth / Competition / Money — the same five roles the
// council already argues in.

export const ORACLE_ROLE_VALUES = [
  'NeedOracle',
  'ReadinessOracle',
  'WorkflowOracle',
  'GovernanceOracle',
  'BuildOracle',
  'ElderOracle',
] as const;
export type OracleRole = (typeof ORACLE_ROLE_VALUES)[number];

export const SPECIALIST_ROLE_VALUES = ['Risk', 'Demand', 'Growth', 'Competition', 'Money'] as const;
export type SpecialistRole = (typeof SPECIALIST_ROLE_VALUES)[number];

// Gate indexes where the Elder Oracle must be the approver.
export const ELDER_ORACLE_GATE_INDEXES = [0, 4] as const;

// === Gates ==================================================================

export interface GateDef {
  readonly id: number; // 0..4
  readonly stage: StageName;
  readonly name: string;
  readonly predecessorStage: StageName | null;
  readonly purpose: string;
  readonly allowedReasonCodes: readonly ReasonCode[];
}

// Pure constant table — referenced by API + business modules. The numeric
// gateIndex matches `stage -> gate binding` so `gateIndexFor('Readiness') === 1`.
export const GATE_DEFS: readonly GateDef[] = [
  {
    id: 0,
    stage: 'Discovery',
    name: 'Need accepted',
    predecessorStage: null,
    purpose: 'Confirm the plain-English need is real, scoped, and worth pursuing.',
    allowedReasonCodes: [
      'Approved',
      'EvidenceRequested',
      'ScopeMismatch',
      'DemandUnverified',
      'WalkAway',
      'UserCorrection',
    ],
  },
  {
    id: 1,
    stage: 'Readiness',
    name: 'Ready for workflow',
    predecessorStage: 'Discovery',
    purpose: 'Confirm enough evidence (intake, stakeholders, constraints) to lock workflow.',
    allowedReasonCodes: [
      'Approved',
      'EvidenceRequested',
      'ScopeMismatch',
      'GovernanceViolation',
      'UserCorrection',
    ],
  },
  {
    id: 2,
    stage: 'Workflow',
    name: 'Workflow approved',
    predecessorStage: 'Readiness',
    purpose: 'Confirm the chosen workflow, owners, and acceptance criteria.',
    allowedReasonCodes: [
      'Approved',
      'EvidenceRequested',
      'ScopeMismatch',
      'UserCorrection',
      'Replanned',
    ],
  },
  {
    id: 3,
    stage: 'Governance',
    name: 'Governance clear',
    predecessorStage: 'Workflow',
    purpose: 'Confirm governance approval (compliance, procurement, audit obligations).',
    allowedReasonCodes: [
      'Approved',
      'GovernanceViolation',
      'ScopeMismatch',
      'UserCorrection',
      'WalkAway',
    ],
  },
  {
    id: 4,
    // R5 (mission pipeline rebuild, low-effort half): this gate's actual
    // output (MissionBlueprintView + MissionRunbookView) is a pair of
    // schema-versioned *specification* documents, not deployable code — the
    // reference platform's equivalent (Prototype) really does generate a
    // downloadable multi-file app + test report, so "Build complete" was a
    // real, checkable mismatch between this name and what crossing it
    // produces. Deliberately NOT renaming the underlying `stage` enum value
    // ('SoftwareBuild') here — it's a native Postgres enum threaded through
    // ~15 business-logic files, prisma/schema/forge.prisma, and db/01-schema.sql;
    // that's the doc's "Longer term (high effort)" option, scoped separately.
    stage: 'SoftwareBuild',
    name: 'Prototype spec approved',
    predecessorStage: 'Governance',
    purpose:
      'Confirm the prototype spec (Blueprint + Runbook) matches acceptance criteria and is approved to hand off — not yet a deployable build.',
    allowedReasonCodes: [
      'Approved',
      'InsufficientConfidence',
      'EvidenceRequested',
      'UserCorrection',
      'Other',
    ],
  },
] as const;

export function gateIndexFor(stage: StageName): number {
  const idx = GATE_DEFS.findIndex((g) => g.stage === stage);
  if (idx < 0) throw new Error(`FORGE_GATE_UNKNOWN_STAGE: ${stage}`);
  return idx;
}

// === Write shapes (request bodies) ==========================================

// === Intake structure (nine attribution fields) =============================

const intakeField = z
  .string()
  .trim()
  .min(1, 'Required field — describe what you know.')
  .max(2000, 'Field is too long — cap at 2000 characters.');

export const MissionIntakeStructure = z.object({
  need: intakeField,
  intendedOutcome: intakeField,
  constraints: intakeField,
  authorityBoundary: intakeField,
  dataClassification: intakeField,
  retentionPolicy: intakeField,
  acceptanceCriteria: intakeField,
  nonGoals: intakeField,
  missionOwner: z
    .string()
    .trim()
    .max(120)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
});
export type MissionIntakeStructureT = z.infer<typeof MissionIntakeStructure>;

export const MissionCreate = z.object({
  intake: z
    .string()
    .trim()
    .min(20, 'Brief is too short — give us at least one sentence.')
    .max(5000, 'Intake is too long — please cap at 5000 characters.'),
  name: z
    .string()
    .trim()
    .max(120, 'Mission name is too long.')
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
  normalizedNeed: z
    .string()
    .trim()
    .max(1000)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : '')),
  intakeStructured: MissionIntakeStructure.optional(),
  missingInformation: z
    .array(z.string().trim().min(1).max(200))
    .max(20)
    .optional()
    .transform((v) => v ?? []),
  domainTags: z
    .array(z.string().trim().min(1).max(40))
    .max(12)
    .optional()
    .transform((v) => v ?? []),
  email: z
    .union([z.string().email('That email looks off.'), z.literal('')])
    .optional()
    .transform((v) => (v ? v : undefined)),
});

export const MissionIntakeUpdate = z.object({
  intake: z.string().trim().min(20).max(5000),
  normalizedNeed: z
    .string()
    .trim()
    .max(1000)
    .optional()
    .transform((v) => v ?? ''),
  intakeStructured: MissionIntakeStructure.optional(),
  missingInformation: z
    .array(z.string().trim().min(1).max(200))
    .max(20)
    .optional()
    .transform((v) => v ?? []),
});

export const HandoffCreate = z.object({
  stage: z.enum(StageNameValues),
  payload: z.unknown().transform((v) => (v ?? {}) as Record<string, unknown>),
  confidence: z.number().min(0).max(1),
  missingEvidence: z
    .array(z.unknown())
    .max(20)
    .optional()
    .transform((v) => v ?? []),
  toolRefs: z
    .array(z.string())
    .max(50)
    .optional()
    .transform((v) => v ?? []),
  parentVersionId: z.string().optional(),
});

export const HandoffCorrect = z.object({
  payload: z.unknown().transform((v) => (v ?? {}) as Record<string, unknown>),
  confidence: z.number().min(0).max(1),
  missingEvidence: z
    .array(z.unknown())
    .max(20)
    .optional()
    .transform((v) => v ?? []),
  reasonCode: z.enum(GATE_REASON_CODES),
  reasonText: z.string().trim().min(1),
});

export const GateDecide = z.object({
  decision: z.enum(APPROVAL_DECISION_VALUES),
  reasonCode: z.enum(GATE_REASON_CODES),
  reasonText: z.string().trim().min(1, 'Reason text is required for attribution.'),
  stageHandoffId: z.string(),
});

export const TransitionStart = z.object({
  triggerReasonCode: z.enum(GATE_REASON_CODES).optional(),
});

export const PauseRequest = z.object({
  reasonCode: z.enum(GATE_REASON_CODES),
  reasonText: z.string().trim().min(1),
});

export const ResumeRequest = z.object({
  reasonCode: z.enum(GATE_REASON_CODES),
  reasonText: z.string().trim().min(1),
});

export const ReplayRequest = z.object({
  fromStageIndex: z.number().int().min(0).max(4),
  reasonCode: z.enum(GATE_REASON_CODES).default('ReplayRequired'),
  reasonText: z.string().trim().min(1),
});

export const RollbackRequest = z.object({
  toStageHandoffId: z.string(),
  reasonCode: z.enum(GATE_REASON_CODES).default('StaleInformation'),
  reasonText: z.string().trim().min(1),
});

export const EvidenceCreate = z.object({
  kind: z.enum(EVIDENCE_KIND_VALUES),
  ref: z.string().trim().min(1).max(2000),
  label: z.string().trim().min(1).max(200),
  attachedToStageHandoffId: z.string().optional(),
});

export const ObjectionCreate = z.object({
  stageHandoffId: z.string(),
  raisedByRole: z.string().trim().min(1).max(120),
  text: z.string().trim().min(1).max(4000),
  evidenceRefId: z.string().optional(),
});

export const ObjectionResolutionInput = z.object({
  resolution: z.enum(OBJECTION_RESOLUTION_VALUES),
  resolutionText: z.string().trim().min(1).max(2000),
});

export const ToolActionCreate = z.object({
  tool: z.string().trim().min(1).max(120),
  scope: z.enum(TOOL_SCOPE_VALUES),
  payload: z.unknown().transform((v) => (v ?? {}) as Record<string, unknown>),
  requiresGateApproval: z.boolean().optional().default(false),
});

export const ToolActionDecide = z.object({
  decision: z.enum(TOOL_DECISION_VALUES),
  reasonCode: z.enum(GATE_REASON_CODES),
});

export const ToolActionExecute = z.object({
  resultRef: z.string().trim().max(2000).optional(),
});

export const ToolActionRollback = z.object({
  rollbackOfToolActionId: z.string(),
  reasonCode: z.enum(GATE_REASON_CODES).default('StaleInformation'),
  reasonText: z.string().trim().min(1),
});

// === TAG Oracle Council write shapes ========================================
// MissionElderOracleAssign — admin-only appointment of the named Elder
// Oracle for a mission. Upsert on (missionId, 'ElderOracle').
export const MissionElderOracleAssign = z.object({
  userId: z.string().trim().min(1),
});

// HandoffSpecialistAttesterAdd — any authed user adds themselves as a
// typed specialist attester on a handoff (the per-Oracle "specialist voice"
// for that gate). Idempotent on (handoffId, userId).
export const HandoffSpecialistAttesterAdd = z.object({
  userId: z.string().trim().min(1),
  role: z.enum(SPECIALIST_ROLE_VALUES),
});

// === Read shapes =============================================================

export const MissionListItem = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  status: z.enum(MissionStatusValues),
  currentStageIndex: z.number().int(),
  confidence: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
  domainTags: z.array(z.string()),
  elderOracleUserId: z.string().nullable(),
});

export const MissionList = z.object({ items: z.array(MissionListItem) });

export const HandoffItem = z.object({
  id: z.string(),
  stage: z.enum(StageNameValues),
  version: z.number().int(),
  parentVersionId: z.string().nullable(),
  correctionOfId: z.string().nullable(),
  supersededById: z.string().nullable(),
  replayOfMissionId: z.string().nullable(),
  invalidationReasonCode: z.string().nullable(),
  confidence: z.number(),
  gateIndexThatApproves: z.number().int(),
  payload: z.record(z.unknown()),
  missingEvidence: z.array(z.unknown()),
  toolRefs: z.array(z.string()),
  producedByToolActionId: z.string().nullable(),
  createdById: z.string(),
  createdAt: z.string(),
});

export const ApprovalItem = z.object({
  id: z.string(),
  gateIndex: z.number().int(),
  stageHandoffId: z.string(),
  approverUserId: z.string().nullable(),
  decision: z.enum(APPROVAL_DECISION_VALUES),
  reasonCode: z.enum(GATE_REASON_CODES),
  reasonText: z.string(),
  supersedesApprovalId: z.string().nullable(),
  replayOfApprovalId: z.string().nullable(),
  at: z.string(),
  oracleRole: z.enum(ORACLE_ROLE_VALUES).nullable(),
  approverMatchedElder: z.boolean(),
  attesterUserIds: z.array(z.string()),
});

export const ObjectionItem = z.object({
  id: z.string(),
  stageHandoffId: z.string(),
  raisedByRole: z.string(),
  text: z.string(),
  evidenceRefId: z.string().nullable(),
  raisedAt: z.string(),
  resolution: z.enum(OBJECTION_RESOLUTION_VALUES).nullable(),
  resolutionText: z.string().nullable(),
});

export const EvidenceItemRead = z.object({
  id: z.string(),
  attachedToStageHandoffId: z.string().nullable(),
  kind: z.enum(EVIDENCE_KIND_VALUES),
  ref: z.string(),
  label: z.string(),
  capturedAt: z.string(),
  capturedById: z.string(),
});

export const ToolActionItem = z.object({
  id: z.string(),
  tool: z.string(),
  scope: z.enum(TOOL_SCOPE_VALUES),
  payload: z.record(z.unknown()),
  requiresGateApproval: z.boolean(),
  approvedGateIndex: z.number().int().nullable(),
  decidedById: z.string().nullable(),
  decision: z.enum(TOOL_DECISION_VALUES).nullable(),
  decisionReasonCode: z.enum(GATE_REASON_CODES).nullable(),
  decidedAt: z.string().nullable(),
  rejectedAt: z.string().nullable(),
  executedAt: z.string().nullable(),
  resultRef: z.string().nullable(),
  rollbackOfToolActionId: z.string().nullable(),
  producedStageHandoffId: z.string().nullable(),
  createdAt: z.string(),
});

export const MissionAuditItem = z.object({
  id: z.string(),
  event: z.string(),
  payload: z.record(z.unknown()),
  at: z.string(),
  actorId: z.string().nullable(),
  missionVersionAtEvent: z.number().int(),
});

export const GateState = z.object({
  missionId: z.string(),
  gateIndex: z.number().int(),
  stage: z.enum(StageNameValues),
  state: z.enum(['Awaiting', 'Approved', 'Returned', 'Refused']),
  currentStageHandoffId: z.string().nullable(),
  currentHandoffVersion: z.number().int().nullable(),
  lastApprovalId: z.string().nullable(),
  allowedReasonCodes: z.array(z.enum(GATE_REASON_CODES)),
});

// === TAG Oracle Council read shapes =========================================

export const MissionOracleAssignmentItem = z.object({
  id: z.string(),
  missionId: z.string(),
  role: z.enum(ORACLE_ROLE_VALUES),
  userId: z.string(),
  appointedById: z.string(),
  appointedAt: z.string(),
});
export type MissionOracleAssignmentItemT = z.infer<typeof MissionOracleAssignmentItem>;

export const MissionOracleRoster = z.object({
  items: z.array(MissionOracleAssignmentItem),
});
export type MissionOracleRosterT = z.infer<typeof MissionOracleRoster>;

export const StageHandoffAttesterItem = z.object({
  id: z.string(),
  handoffId: z.string(),
  userId: z.string(),
  role: z.enum(SPECIALIST_ROLE_VALUES),
  signedAt: z.string(),
});
export type StageHandoffAttesterItemT = z.infer<typeof StageHandoffAttesterItem>;

export const StageHandoffAttesterList = z.object({
  items: z.array(StageHandoffAttesterItem),
});
export type StageHandoffAttesterListT = z.infer<typeof StageHandoffAttesterList>;

// === Work items ==============================================================

export const WORK_ITEM_STATUS_VALUES = [
  'Open',
  'InProgress',
  'InTest',
  'Rework',
  'Passed',
  'Failed',
  'Deferred',
] as const;
export type WorkItemStatusT = (typeof WORK_ITEM_STATUS_VALUES)[number];

export const WorkItemWrite = z.object({
  parentStageHandoffId: z.string(),
  title: z.string().trim().min(1).max(200),
  scope: z.string().trim().min(1).max(2000),
  acceptanceCriteria: z.string().trim().min(1).max(2000),
  ownerUserId: z
    .string()
    .trim()
    .max(120)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
});
export type WorkItemWriteT = z.infer<typeof WorkItemWrite>;

export const WorkItemStatusTransition = z.object({
  status: z.enum(WORK_ITEM_STATUS_VALUES),
  reasonText: z.string().trim().min(1).max(2000),
  reasonCode: z.enum(GATE_REASON_CODES).default('UserCorrection'),
});
export type WorkItemStatusTransitionT = z.infer<typeof WorkItemStatusTransition>;

export const WorkItemTestEvidenceAttach = z.object({
  evidenceRefId: z.string().trim().min(1),
});
export type WorkItemTestEvidenceAttachT = z.infer<typeof WorkItemTestEvidenceAttach>;

export const WorkItemRead = z.object({
  id: z.string(),
  missionId: z.string(),
  parentStageHandoffId: z.string(),
  title: z.string(),
  scope: z.string(),
  acceptanceCriteria: z.string(),
  ownerUserId: z.string().nullable(),
  status: z.enum(WORK_ITEM_STATUS_VALUES),
  openedAt: z.string(),
  closedAt: z.string().nullable(),
  testEvidenceRefIds: z.array(z.string()),
  supersededById: z.string().nullable(),
});
export type WorkItemReadT = z.infer<typeof WorkItemRead>;

export const WorkItemList = z.object({ items: z.array(WorkItemRead) });
export type WorkItemListT = z.infer<typeof WorkItemList>;

// === Blueprint + runbook (SoftwareBuild-stage handoff payloads) ==============

export const BlueprintBlock = z.object({
  heading: z.string().trim().min(1).max(200),
  body: z.string().trim().min(0).max(4000),
  sourceStage: z.enum(StageNameValues),
});
export type BlueprintBlockT = z.infer<typeof BlueprintBlock>;

export const BlueprintPayload = z.object({
  missionId: z.string(),
  missionName: z.string(),
  generatedAt: z.string(),
  title: z.string(),
  summary: z.string(),
  blocks: z.array(BlueprintBlock).min(1),
  reuseSignals: z.array(z.string()),
});
export type BlueprintPayloadT = z.infer<typeof BlueprintPayload>;

export const BlueprintRead = BlueprintPayload.extend({
  schemaVersion: z.string(),
});
export type BlueprintReadT = z.infer<typeof BlueprintRead>;

export const RunbookSection = z.object({
  heading: z.string().trim().min(1).max(200),
  body: z.string().trim().min(0).max(4000),
  orderIndex: z.number().int(),
});
export type RunbookSectionT = z.infer<typeof RunbookSection>;

export const RunbookPayload = z.object({
  missionId: z.string(),
  missionName: z.string(),
  generatedAt: z.string(),
  title: z.string(),
  steps: z.array(RunbookSection).min(1),
  escalationContacts: z.array(
    z.object({ role: z.string().trim().min(1), contact: z.string().trim().min(1) }),
  ),
});
export type RunbookPayloadT = z.infer<typeof RunbookPayload>;

export const RunbookRead = RunbookPayload.extend({
  schemaVersion: z.string(),
});
export type RunbookReadT = z.infer<typeof RunbookRead>;

// === Next action view =========================================================

export const NextActionView = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('ApproveGate'),
    gateIndex: z.number().int(),
    stage: z.enum(StageNameValues),
    title: z.string(),
    rationale: z.string(),
  }),
  z.object({
    kind: z.literal('ResolveObjection'),
    id: z.string(),
    raisedByRole: z.string(),
    title: z.string(),
    rationale: z.string(),
  }),
  z.object({
    kind: z.literal('DecideToolAction'),
    id: z.string(),
    tool: z.string(),
    scope: z.enum(TOOL_SCOPE_VALUES),
    title: z.string(),
    rationale: z.string(),
  }),
  z.object({ kind: z.literal('Pause'), reason: z.string(), title: z.string() }),
  z.object({ kind: z.literal('Replay'), fromStageIndex: z.number().int(), title: z.string() }),
  z.object({ kind: z.literal('Resume'), title: z.string() }),
  z.object({ kind: z.literal('ArrangeWorkItem'), itemId: z.string(), title: z.string() }),
  z.object({ kind: z.literal('Released'), title: z.string() }),
  z.object({ kind: z.literal('Complete'), title: z.string() }),
  z.object({ kind: z.literal('Idle'), title: z.string() }),
]);
export type NextActionViewT = z.infer<typeof NextActionView>;

export const NextActionResponse = z.object({
  view: NextActionView,
  blockers: z.array(z.string()),
  isTerminal: z.boolean(),
});
export type NextActionResponseT = z.infer<typeof NextActionResponse>;

// === Release readout =========================================================

export const ReleaseRead = z.object({
  releaseStatus: z.enum([
    'Released',
    'BuildApprovedNotReleased',
    'Paused',
    'RolledBack',
    'WalkedAway',
    'Blocked',
    'InProgress',
  ]),
  releaseReadoutAt: z.string().nullable(),
  completedAt: z.string().nullable(),
  lastApproval: ApprovalItem.nullable(),
  lastToolActionExecutedAt: z.string().nullable(),
  summary: z.string(),
});
export type ReleaseReadT = z.infer<typeof ReleaseRead>;

export const MissionDetail = z.object({
  mission: MissionListItem.extend({
    intake: z.string(),
    normalizedNeed: z.string(),
    currentDraftVersion: z.number().int().nullable(),
    pausedAt: z.string().nullable(),
    completedAt: z.string().nullable(),
    rolledBackAt: z.string().nullable(),
    previousStatus: z.enum(MissionStatusValues).nullable(),
    createdById: z.string(),
    releaseReadoutAt: z.string().nullable().optional(),
  }),
  handoffs: z.array(HandoffItem),
  approvals: z.array(ApprovalItem),
  objections: z.array(ObjectionItem),
  evidence: z.array(EvidenceItemRead),
  toolActions: z.array(ToolActionItem),
  audits: z.array(MissionAuditItem),
  gates: z.array(GateState),
  workItems: z.array(WorkItemRead),
  oracleRoster: z.array(MissionOracleAssignmentItem),
  handoffAttesters: z.array(StageHandoffAttesterItem),
});

// === Helpers =================================================================

export function parseList<T>(schema: z.ZodType<T>, raw: unknown): T {
  return schema.parse(raw);
}

// === Inferred types ==========================================================

export type MissionCreate = z.infer<typeof MissionCreate>;
export type HandoffCreateInput = z.infer<typeof HandoffCreate>;
export type HandoffCorrectInput = z.infer<typeof HandoffCorrect>;
export type GateDecideInput = z.infer<typeof GateDecide>;
export type MissionListItemT = z.infer<typeof MissionListItem>;
export type MissionDetailT = z.infer<typeof MissionDetail>;
export type HandoffItemT = z.infer<typeof HandoffItem>;
export type ApprovalItemT = z.infer<typeof ApprovalItem>;
export type ObjectionItemT = z.infer<typeof ObjectionItem>;
export type EvidenceItemReadT = z.infer<typeof EvidenceItemRead>;
export type ToolActionItemT = z.infer<typeof ToolActionItem>;
export type MissionAuditItemT = z.infer<typeof MissionAuditItem>;
export type GateStateT = z.infer<typeof GateState>;
export type MissionElderOracleAssignInput = z.infer<typeof MissionElderOracleAssign>;
export type HandoffSpecialistAttesterAddInput = z.infer<typeof HandoffSpecialistAttesterAdd>;
