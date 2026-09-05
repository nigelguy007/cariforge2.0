// @polsia:user-owned — server-side forge service. Single seam every
// /api/forge/* route handler calls into for DB reads / audit / status
// transitions. Pure helpers live in src/lib/business/forge/index.ts — this
// file threads them together with persistence.

import 'server-only';
import { Prisma } from '@prisma/client';
import {
  type ApprovalDecision,
  GATE_DEFS,
  isApproveDecision,
  type MissionDetailT,
  type MissionListItemT,
  type MissionStatus,
  type ObjectionResolution,
  type ReasonCode,
  type StageName,
  type ToolActionDecision,
  type ToolActionScope,
  type WorkItemReadT,
  type WorkItemStatusT,
} from '@/lib/contracts/forge';
import { prisma } from '@/lib/db';
// 2026-09-04: switched from the framework's src/lib/email/send.ts to the
// user-owned Resend-backed transport (identical interface) — see
// send-resend.ts's header for why: the framework module's target
// (POLSIA_EMAIL_PROXY_URL) is a confirmed-dead https://email-proxy.invalid
// placeholder, so gate-decision emails were silently never actually
// sending (swallowed by this function's own catch below).
import { sendEmail } from '@/lib/email/send-resend';
import { tagOracleGateDecisionEmail } from '@/lib/email/templates/tag-oracle-gate-decision';
import { computeNextVersion, markDownstreamInvalidated, validateParent } from './handoffs';
import {
  assertElderOracleAttested,
  assertSpecialistAttestersPresent,
  isElderGate,
} from './oracle-council';
import { assertAttribution, assertNonApproveAttribution, assertReasonAllowed } from './policy';
import {
  FORGE_ERROR_CODES,
  ForgeError,
  gateIndexFor,
  nextStageFor,
  recomputeConfidence,
} from './state-machine';
import { assertExternalApproved, assertRollbackLink, assertScopeDenied } from './tool-actions';
import { isValidWorkItemTransition, progressSummary, type WorkItemRecord } from './work-items';

function slugify(input: string): string {
  const base = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  const suffix = Math.random().toString(36).slice(2, 8);
  return base ? `${base}-${suffix}` : `mission-${suffix}`;
}

function toIso(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

function missionListItem(row: {
  id: string;
  slug: string;
  name: string;
  status: MissionStatus;
  currentStageIndex: number;
  confidence: number;
  createdAt: Date;
  updatedAt: Date;
  domainTags: string[];
  elderOracleUserId?: string | null;
  sourceLeadId?: string | null;
  hasOpenConcern?: boolean;
}): MissionListItemT {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    status: row.status,
    currentStageIndex: row.currentStageIndex,
    confidence: row.confidence,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    domainTags: row.domainTags,
    elderOracleUserId: row.elderOracleUserId ?? null,
    sourceLeadId: row.sourceLeadId ?? null,
    hasOpenConcern: row.hasOpenConcern ?? false,
  };
}

function missionAuditPayload(payload: Record<string, unknown>): Prisma.InputJsonValue {
  return payload as Prisma.InputJsonValue;
}

// === Read seams =============================================================

export async function listMissionsForUser(userId: string): Promise<MissionListItemT[]> {
  const rows = await prisma.mission.findMany({
    where: { createdById: userId },
    orderBy: { updatedAt: 'desc' },
  });
  return enrichMissionsWithElderOracle(rows);
}

export async function listAllMissions(): Promise<MissionListItemT[]> {
  const rows = await prisma.mission.findMany({ orderBy: { updatedAt: 'desc' } });
  return enrichMissionsWithElderOracle(rows);
}

async function enrichMissionsWithElderOracle(
  rows: Array<{
    id: string;
    slug: string;
    name: string;
    status: MissionStatus;
    currentStageIndex: number;
    confidence: number;
    createdAt: Date;
    updatedAt: Date;
    domainTags: string[];
    sourceLeadId?: string | null;
  }>,
): Promise<MissionListItemT[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);
  const [assignments, openObjections] = await Promise.all([
    prisma.missionOracleAssignment.findMany({
      where: { missionId: { in: ids }, role: 'ElderOracle' },
    }),
    // Real bug fix (2026-09-05): mission.status alone can't tell a caller
    // "this needs your attention" — it only changes on an actual gate
    // decision (decideGate), never on drafting/review activity. A brand-new
    // project sitting on a real, AI-raised objection stayed 'Draft'
    // forever and never showed up in Approvals. One cheap distinct query
    // (Objection has its own scalar missionId, no join needed) rather than
    // a per-mission detail fetch.
    prisma.objection.findMany({
      where: { missionId: { in: ids }, resolution: null },
      select: { missionId: true },
      distinct: ['missionId'],
    }),
  ]);
  const elderByMission = new Map<string, string>(
    assignments.map((a) => [a.missionId, a.userId] as const),
  );
  const concernByMission = new Set(openObjections.map((o) => o.missionId));
  return rows.map((r) =>
    missionListItem({
      ...r,
      elderOracleUserId: elderByMission.get(r.id) ?? null,
      hasOpenConcern: concernByMission.has(r.id),
    }),
  );
}

export async function getMissionDetail(
  missionId: string,
  userId: string,
  isAdmin: boolean,
): Promise<MissionDetailT | null> {
  const mission = await prisma.mission.findUnique({ where: { id: missionId } });
  if (!mission) return null;
  if (!isAdmin && mission.createdById !== userId) {
    throw new Error('FORGE_FORBIDDEN');
  }
  const [
    handoffs,
    approvals,
    objections,
    evidence,
    toolActions,
    audits,
    workItems,
    oracleAssignments,
  ] = await Promise.all([
    prisma.stageHandoff.findMany({
      where: { missionId },
      orderBy: [{ stage: 'asc' }, { version: 'desc' }],
    }),
    prisma.approval.findMany({ where: { missionId }, orderBy: { at: 'desc' } }),
    prisma.objection.findMany({ where: { missionId }, orderBy: { raisedAt: 'desc' } }),
    prisma.evidenceItem.findMany({ where: { missionId }, orderBy: { capturedAt: 'desc' } }),
    prisma.toolAction.findMany({ where: { missionId }, orderBy: { decidedAt: 'desc' } }),
    prisma.missionAudit.findMany({ where: { missionId }, orderBy: { at: 'desc' } }),
    prisma.workItem.findMany({ where: { missionId }, orderBy: { openedAt: 'asc' } }),
    prisma.missionOracleAssignment.findMany({ where: { missionId } }),
  ]);

  const handoffIds = handoffs.map((h) => h.id);
  const handoffAttesters =
    handoffIds.length === 0
      ? []
      : await prisma.stageHandoffSpecialistAttester.findMany({
          where: { handoffId: { in: handoffIds } },
        });
  const attestersByHandoff = new Map<string, string[]>();
  for (const a of handoffAttesters) {
    const arr = attestersByHandoff.get(a.handoffId) ?? [];
    arr.push(a.userId);
    attestersByHandoff.set(a.handoffId, arr);
  }
  const elderOracleUserId = oracleAssignments.find((a) => a.role === 'ElderOracle')?.userId ?? null;

  const gateStates = computeGateStates(mission.id, handoffs, approvals);

  // UX review H1: resolve approver display names once so the gate rail can
  // stamp "who · when" without a per-approval lookup client-side.
  const approverIds = [
    ...new Set(approvals.map((a) => a.approverUserId).filter((id): id is string => !!id)),
  ];
  const approverUsers =
    approverIds.length === 0
      ? []
      : await prisma.user.findMany({
          where: { id: { in: approverIds } },
          select: { id: true, name: true },
        });
  const approverNameById = new Map(approverUsers.map((u) => [u.id, u.name] as const));

  const missionShape = mission as typeof mission & {
    previousStatus?: MissionStatus | null;
    intakeStructured?: unknown;
    releaseReadoutAt?: Date | null;
    sourceLeadId?: string | null;
  };
  return {
    mission: {
      id: mission.id,
      slug: mission.slug,
      name: mission.name,
      intake: mission.intake,
      normalizedNeed: mission.normalizedNeed,
      status: mission.status,
      currentStageIndex: mission.currentStageIndex,
      currentDraftVersion: mission.currentDraftVersion ?? null,
      confidence: mission.confidence,
      pausedAt: toIso(mission.pausedAt),
      completedAt: toIso(mission.completedAt),
      rolledBackAt: toIso(mission.rolledBackAt),
      previousStatus: missionShape.previousStatus ?? null,
      createdById: mission.createdById,
      createdAt: mission.createdAt.toISOString(),
      updatedAt: mission.updatedAt.toISOString(),
      domainTags: mission.domainTags,
      elderOracleUserId,
      sourceLeadId: missionShape.sourceLeadId ?? null,
      releaseReadoutAt: missionShape.releaseReadoutAt
        ? (missionShape.releaseReadoutAt as Date).toISOString()
        : null,
    },
    handoffs: handoffs.map((h) => ({
      id: h.id,
      stage: h.stage,
      version: h.version,
      parentVersionId: h.parentVersionId,
      correctionOfId: h.correctionOfId,
      supersededById: h.supersededById,
      replayOfMissionId: h.replayOfMissionId,
      invalidationReasonCode: h.invalidationReasonCode,
      confidence: h.confidence,
      gateIndexThatApproves: h.gateIndexThatApproves,
      payload: (h.payload as Record<string, unknown>) ?? {},
      missingEvidence: (h.missingEvidence as unknown[]) ?? [],
      toolRefs: h.toolRefs,
      producedByToolActionId: h.producedByToolActionId,
      createdById: h.createdById,
      createdAt: h.createdAt.toISOString(),
    })),
    approvals: approvals.map((a) => {
      const attestersForHandoff = attestersByHandoff.get(a.stageHandoffId) ?? [];
      const isElderGate = a.gateIndex === 0 || a.gateIndex === 4;
      return {
        id: a.id,
        gateIndex: a.gateIndex,
        stageHandoffId: a.stageHandoffId,
        approverUserId: a.approverUserId,
        approverName: a.approverUserId ? (approverNameById.get(a.approverUserId) ?? null) : null,
        decision: a.decision,
        controls: a.controls,
        reasonCode: a.reasonCode as ReasonCode,
        reasonText: a.reasonText,
        supersedesApprovalId: a.supersedesApprovalId,
        replayOfApprovalId: a.replayOfApprovalId,
        at: a.at.toISOString(),
        oracleRole: resolveOracleRoleForApproval(a.gateIndex, a.approverUserId, elderOracleUserId),
        approverMatchedElder:
          isElderGate && a.approverUserId !== null && a.approverUserId === elderOracleUserId,
        attesterUserIds: attestersForHandoff,
      };
    }),
    objections: objections.map((o) => ({
      id: o.id,
      stageHandoffId: o.stageHandoffId,
      raisedByRole: o.raisedByRole,
      text: o.text,
      evidenceRefId: o.evidenceRefId,
      raisedAt: o.raisedAt.toISOString(),
      resolution: o.resolution as ObjectionResolution | null,
      resolutionText: o.resolutionText,
    })),
    evidence: evidence.map((e) => ({
      id: e.id,
      attachedToStageHandoffId: e.attachedToStageHandoffId,
      kind: e.kind,
      ref: e.ref,
      label: e.label,
      capturedAt: e.capturedAt.toISOString(),
      capturedById: e.capturedById,
    })),
    toolActions: toolActions.map((t) => ({
      id: t.id,
      tool: t.tool,
      scope: t.scope as ToolActionScope,
      payload: (t.payload as Record<string, unknown>) ?? {},
      requiresGateApproval: t.requiresGateApproval,
      approvedGateIndex: t.approvedGateIndex,
      decidedById: t.decidedById,
      decision: t.decision as ToolActionDecision | null,
      decisionReasonCode: t.decisionReasonCode as ReasonCode | null,
      decidedAt: toIso(t.decidedAt),
      rejectedAt: toIso(t.rejectedAt),
      executedAt: toIso(t.executedAt),
      resultRef: t.resultRef,
      rollbackOfToolActionId: t.rollbackOfToolActionId,
      producedStageHandoffId: t.producedStageHandoffId,
      createdAt: new Date(t.decidedAt ?? t.rejectedAt ?? Date.now()).toISOString(),
    })),
    audits: audits.map((au) => ({
      id: au.id,
      event: au.event,
      payload: (au.payload as Record<string, unknown>) ?? {},
      at: au.at.toISOString(),
      actorId: au.actorId,
      missionVersionAtEvent: au.missionVersionAtEvent,
    })),
    gates: gateStates,
    workItems: workItems.map(
      (w): WorkItemReadT => ({
        id: w.id,
        missionId: w.missionId,
        parentStageHandoffId: w.parentStageHandoffId,
        title: w.title,
        scope: w.scope,
        acceptanceCriteria: w.acceptanceCriteria,
        ownerUserId: w.ownerUserId ?? null,
        status: w.status as WorkItemStatusT,
        openedAt: w.openedAt.toISOString(),
        closedAt: w.closedAt ? w.closedAt.toISOString() : null,
        testEvidenceRefIds: w.testEvidenceRefIds,
        supersededById: w.supersededById ?? null,
      }),
    ),
    oracleRoster: oracleAssignments.map((a) => ({
      id: a.id,
      missionId: a.missionId,
      role: a.role as
        | 'NeedOracle'
        | 'ReadinessOracle'
        | 'WorkflowOracle'
        | 'GovernanceOracle'
        | 'BuildOracle'
        | 'ElderOracle',
      userId: a.userId,
      appointedById: a.appointedById,
      appointedAt: a.appointedAt.toISOString(),
    })),
    handoffAttesters: handoffAttesters.map((a) => ({
      id: a.id,
      handoffId: a.handoffId,
      userId: a.userId,
      role: a.role as 'Risk' | 'Demand' | 'Growth' | 'Competition' | 'Money',
      signedAt: a.signedAt.toISOString(),
    })),
  };
}

function resolveOracleRoleForApproval(
  gateIndex: number,
  approverUserId: string | null,
  elderOracleUserId: string | null,
):
  | 'NeedOracle'
  | 'ReadinessOracle'
  | 'WorkflowOracle'
  | 'GovernanceOracle'
  | 'BuildOracle'
  | 'ElderOracle'
  | null {
  if (!approverUserId) return null;
  if ((gateIndex === 0 || gateIndex === 4) && approverUserId === elderOracleUserId) {
    return 'ElderOracle';
  }
  switch (gateIndex) {
    case 0:
      return 'NeedOracle';
    case 1:
      return 'ReadinessOracle';
    case 2:
      return 'WorkflowOracle';
    case 3:
      return 'GovernanceOracle';
    case 4:
      return 'BuildOracle';
    default:
      return null;
  }
}

function computeGateStates(
  missionId: string,
  handoffs: Array<{ id: string; stage: StageName; version: number; supersededById: string | null }>,
  approvals: Array<{ id: string; gateIndex: number; decision: ApprovalDecision }>,
) {
  const allStages: StageName[] = [
    'Discovery',
    'Readiness',
    'Workflow',
    'Governance',
    'SoftwareBuild',
  ];
  return allStages.map((stage, gateIndex) => {
    const stageHandoffs = handoffs.filter((h) => h.stage === stage);
    const latest = stageHandoffs.find((h) => !h.supersededById) ?? stageHandoffs[0] ?? null;
    const apForGate = approvals.filter((a) => a.gateIndex === gateIndex);
    const lastApproval = apForGate[0] ?? null;
    let state: 'Awaiting' | 'Approved' | 'Returned' | 'Refused' = 'Awaiting';
    if (lastApproval) {
      if (isApproveDecision(lastApproval.decision)) state = 'Approved';
      else if (lastApproval.decision === 'Return') state = 'Returned';
      else state = 'Refused';
    }
    return {
      missionId,
      gateIndex,
      stage,
      state,
      currentStageHandoffId: latest ? latest.id : null,
      currentHandoffVersion: latest ? latest.version : null,
      lastApprovalId: lastApproval ? lastApproval.id : null,
      allowedReasonCodes: [...(GATE_DEFS[gateIndex]?.allowedReasonCodes ?? [])],
    };
  });
}

// === Write seams ============================================================

// === TAG Oracle Council write helpers ========================================
// These mirror the public mission detail shape; the /api/forge handlers call
// them after requireForgeAdmin / requireForgeAuth pass.

export async function assignElderOracle(args: {
  missionId: string;
  appointedById: string;
  userId: string;
}): Promise<MissionDetailT> {
  const mission = await prisma.mission.findUnique({ where: { id: args.missionId } });
  if (!mission) throw new Error('FORGE_NOT_FOUND');
  await prisma.missionOracleAssignment.upsert({
    where: { missionId_role: { missionId: args.missionId, role: 'ElderOracle' } },
    create: {
      missionId: args.missionId,
      role: 'ElderOracle',
      userId: args.userId,
      appointedById: args.appointedById,
    },
    update: { userId: args.userId, appointedById: args.appointedById, appointedAt: new Date() },
  });
  await prisma.missionAudit.create({
    data: {
      missionId: args.missionId,
      event: 'elder_oracle_assigned',
      payload: missionAuditPayload({ userId: args.userId }),
      actorId: args.appointedById,
      missionVersionAtEvent: mission.currentStageIndex,
    },
  });
  const detail = await getMissionDetail(args.missionId, args.appointedById, true);
  if (!detail) throw new Error('FORGE_NOT_FOUND');
  return detail;
}

export async function addHandoffAttester(args: {
  missionId: string;
  handoffId: string;
  userId: string;
  role: 'Risk' | 'Demand' | 'Growth' | 'Competition' | 'Money';
}): Promise<MissionDetailT> {
  const mission = await prisma.mission.findUnique({ where: { id: args.missionId } });
  if (!mission) throw new Error('FORGE_NOT_FOUND');
  const handoff = await prisma.stageHandoff.findUnique({ where: { id: args.handoffId } });
  if (!handoff || handoff.missionId !== args.missionId) throw new Error('FORGE_HANDOFF_NOT_FOUND');
  await prisma.stageHandoffSpecialistAttester.upsert({
    where: { handoffId_userId: { handoffId: args.handoffId, userId: args.userId } },
    create: {
      handoffId: args.handoffId,
      userId: args.userId,
      role: args.role,
    },
    update: { role: args.role, signedAt: new Date() },
  });
  await prisma.missionAudit.create({
    data: {
      missionId: args.missionId,
      event: 'specialist_attested',
      payload: missionAuditPayload({ handoffId: args.handoffId, role: args.role }),
      actorId: args.userId,
      missionVersionAtEvent: mission.currentStageIndex,
    },
  });
  // We've already proven the mission + handoff exist; the helper returns an
  // unscoped read so the attester can see the page after signing. The route
  // handler calls with auth.isAdmin, so the caller shape is unchanged.
  const detail = await getMissionDetail(args.missionId, args.userId, true);
  if (!detail) throw new Error('FORGE_NOT_FOUND');
  return detail;
}

async function writeAudit(
  tx: Prisma.TransactionClient,
  missionId: string,
  event: string,
  payload: Record<string, unknown>,
  actorId: string | null,
  version: number,
) {
  await tx.missionAudit.create({
    data: {
      missionId,
      event,
      payload: missionAuditPayload(payload),
      actorId,
      missionVersionAtEvent: version,
    },
  });
}

// Real user report (2026-09-05, live screenshots): "it says there are 3
// outstanding concerns unresolved .. yet the system says they are
// resolved". Root cause: neither submitHandoff nor correctHandoff ever
// touched the Objection table when superseding a handoff — an objection
// raised against a draft stays `resolution: null` FOREVER once that
// draft is redrafted away, even though the thing it was raised against no
// longer exists. nextActionFor's outstandingObjection check (and every
// "N concerns open" count) scans ALL objections mission-wide with no
// regard for which handoff they're attached to, so these orphaned
// objections could — and, on a mission redrafted this many times, did —
// permanently block the mission behind concerns about content that had
// already been replaced, while the Concerns list separately showed a
// long, confusing history of OTHER same-role objections (from other
// versions) already marked resolved. 'CarriedForward' already exists in
// OBJECTION_RESOLUTION_VALUES with real display copy (ui-terms.ts:
// "Carried forward, with the concern on record") and is already read by
// use-project-workspace.ts/evidence-view.ts — it was simply never
// written anywhere. This is that write path: called at the exact moment
// a handoff is superseded, inside the same transaction, so it can never
// race with a fresh objection landing on the NEW handoff a moment later.
async function carryForwardStaleObjections(
  tx: Prisma.TransactionClient,
  missionId: string,
  supersededHandoffId: string,
) {
  await tx.objection.updateMany({
    where: { missionId, stageHandoffId: supersededHandoffId, resolution: null },
    data: {
      resolution: 'CarriedForward',
      resolutionText:
        'Automatically carried forward: this step was redrafted before the concern was directly answered. The new draft will be reviewed fresh, and this will be raised again if it still applies.',
    },
  });
}

export async function createMission(args: {
  userId: string;
  intake: string;
  name?: string;
  normalizedNeed?: string;
  intakeStructured?: Record<string, unknown>;
  domainTags: string[];
  // UX review C1: Lead id this mission converts — caller (route) has
  // already verified the lead belongs to this user's email.
  sourceLeadId?: string;
}): Promise<MissionDetailT> {
  const slug = slugify(args.name ?? args.intake);
  // UX: a name wasn't required at intake (the front-door "What do you
  // want to build?" box only asks for the free-text need), but showing
  // the literal string "Untitled mission" back to the person who just
  // wrote it reads as broken, not as an intentional placeholder — same
  // "derive a name from the description" pattern as guide.ts's
  // suggestNameAndSlug(), just inlined here since only the name (not a
  // slug too) is needed.
  const derivedName = args.intake.trim().split(/\s+/).slice(0, 8).join(' ').slice(0, 120);
  const mission = await prisma.mission.create({
    data: {
      slug,
      name: args.name?.trim() || derivedName || 'Untitled mission',
      intake: args.intake,
      normalizedNeed: args.normalizedNeed ?? '',
      domainTags: args.domainTags,
      createdById: args.userId,
      intakeStructured: (args.intakeStructured ?? null) as Prisma.InputJsonValue,
      sourceLeadId: args.sourceLeadId ?? null,
    },
  });
  await prisma.missionAudit.create({
    data: {
      missionId: mission.id,
      event: 'created',
      payload: missionAuditPayload({
        intake: args.intake,
        hasStructuredIntake: !!args.intakeStructured,
        sourceLeadId: args.sourceLeadId ?? null,
      }),
      actorId: args.userId,
      missionVersionAtEvent: 0,
    },
  });
  const detail = await getMissionDetail(mission.id, args.userId, args.userId === '__admin__');
  if (!detail) throw new Error('FORGE_INTERNAL');
  return detail;
}

export async function updateMissionIntake(args: {
  missionId: string;
  userId: string;
  isAdmin: boolean;
  intake: string;
  normalizedNeed: string;
  intakeStructured?: Record<string, unknown>;
}): Promise<MissionDetailT> {
  const existing = await prisma.mission.findUnique({ where: { id: args.missionId } });
  if (!existing) throw new Error('FORGE_NOT_FOUND');
  if (!args.isAdmin && existing.createdById !== args.userId) throw new Error('FORGE_FORBIDDEN');
  if (existing.status !== 'Draft') {
    throw new Error('FORGE_INTAKE_LOCKED_OUT_OF_DRAFT');
  }
  await prisma.mission.update({
    where: { id: args.missionId },
    data: {
      intake: args.intake,
      normalizedNeed: args.normalizedNeed,
      intakeStructured: args.intakeStructured
        ? ((args.intakeStructured as Prisma.InputJsonValue) ?? Prisma.JsonNull)
        : Prisma.JsonNull,
    },
  });
  await prisma.missionAudit.create({
    data: {
      missionId: args.missionId,
      event: 'intake_refined',
      payload: missionAuditPayload({
        hasStructuredIntake: !!args.intakeStructured,
      }),
      actorId: args.userId,
      missionVersionAtEvent: existing.currentStageIndex,
    },
  });
  const detail = await getMissionDetail(args.missionId, args.userId, args.isAdmin);
  if (!detail) throw new Error('FORGE_NOT_FOUND');
  return detail;
}

export async function submitHandoff(args: {
  missionId: string;
  userId: string;
  isAdmin: boolean;
  stage: StageName;
  payload: Record<string, unknown>;
  confidence: number;
  missingEvidence: unknown[];
  toolRefs: string[];
  parentVersionId?: string;
}): Promise<MissionDetailT> {
  const mission = await prisma.mission.findUnique({ where: { id: args.missionId } });
  if (!mission) throw new Error('FORGE_NOT_FOUND');
  if (!args.isAdmin && mission.createdById !== args.userId) throw new Error('FORGE_FORBIDDEN');

  const newVersion = await prisma.$transaction(async (tx) => {
    // Defense in depth, added 2026-09-05 alongside the live governance-
    // bypass fix in the /draft route and use-project-workspace.ts's
    // currentGate: those fixed the UI/route path that was choosing which
    // stage to draft, but this — the actual write path every one of them
    // ultimately calls — had no floor of its own. Any other caller
    // (a future bug, a direct API call, the admin manual-handoff form)
    // could still submit a stage's FIRST handoff before its predecessor
    // gate was ever approved. A stage's own gate (gateIndexFor(stage))
    // is only legitimately startable once the PRIOR gate has a real
    // Approve-family decision on record — gate 0 (Discovery) has no
    // predecessor, so it's always allowed.
    const gateIdx = gateIndexFor(args.stage);
    if (gateIdx > 0) {
      const priorApproval = await tx.approval.findFirst({
        where: { missionId: args.missionId, gateIndex: gateIdx - 1 },
        orderBy: { at: 'desc' },
      });
      if (!priorApproval || !isApproveDecision(priorApproval.decision)) {
        throw new ForgeError(
          FORGE_ERROR_CODES.STAGE_MISMATCH,
          `Gate ${gateIdx - 1} must be approved before a ${args.stage} step output can be submitted.`,
        );
      }
    }

    const latestForStage = await tx.stageHandoff.findFirst({
      where: { missionId: args.missionId, stage: args.stage },
      orderBy: { version: 'desc' },
    });
    const version = computeNextVersion(
      latestForStage
        ? {
            id: latestForStage.id,
            stage: latestForStage.stage,
            version: latestForStage.version,
            parentVersionId: latestForStage.parentVersionId,
            correctionOfId: latestForStage.correctionOfId,
            supersededById: latestForStage.supersededById,
          }
        : null,
      args.stage,
    );
    const parentRow = args.parentVersionId
      ? await tx.stageHandoff.findUnique({ where: { id: args.parentVersionId } })
      : null;
    validateParent(
      {
        id: 'pending',
        stage: args.stage,
        version,
        parentVersionId: args.parentVersionId ?? null,
        correctionOfId: null,
        supersededById: null,
      },
      parentRow
        ? {
            id: parentRow.id,
            stage: parentRow.stage,
            version: parentRow.version,
            parentVersionId: parentRow.parentVersionId,
            correctionOfId: parentRow.correctionOfId,
            supersededById: parentRow.supersededById,
          }
        : null,
    );

    if (latestForStage && !latestForStage.supersededById) {
      await tx.stageHandoff.update({
        where: { id: latestForStage.id },
        data: { supersededById: 'pending-self-link' },
      });
    }

    const created = await tx.stageHandoff.create({
      data: {
        missionId: args.missionId,
        stage: args.stage,
        version,
        parentVersionId: args.parentVersionId ?? null,
        payload: args.payload as Prisma.InputJsonValue,
        confidence: args.confidence,
        missingEvidence: args.missingEvidence as Prisma.InputJsonValue,
        toolRefs: args.toolRefs,
        gateIndexThatApproves: gateIdx,
        createdById: args.userId,
      },
    });

    if (latestForStage) {
      await tx.stageHandoff.update({
        where: { id: latestForStage.id },
        data: { supersededById: created.id },
      });
      await carryForwardStaleObjections(tx, args.missionId, latestForStage.id);
    }

    await writeAudit(
      tx,
      args.missionId,
      'handoff_submitted',
      { stage: args.stage, version, confidence: args.confidence },
      args.userId,
      mission.currentStageIndex,
    );

    return created;
  });

  // Reflect handoff into mission state: advance currentStageIndex to gate bound
  await prisma.mission.update({
    where: { id: args.missionId },
    data: {
      currentStageIndex: Math.max(mission.currentStageIndex, gateIndexFor(args.stage) + 1),
      currentDraftVersion: newVersion.version,
      confidence: recomputeConfidence(args.confidence, args.missingEvidence.length),
    },
  });

  const detail = await getMissionDetail(args.missionId, args.userId, args.isAdmin);
  if (!detail) throw new Error('FORGE_NOT_FOUND');
  return detail;
}

export async function correctHandoff(args: {
  missionId: string;
  userId: string;
  isAdmin: boolean;
  handoffId: string;
  payload: Record<string, unknown>;
  confidence: number;
  missingEvidence: unknown[];
  reasonCode: ReasonCode;
  reasonText: string;
}): Promise<MissionDetailT> {
  const mission = await prisma.mission.findUnique({ where: { id: args.missionId } });
  if (!mission) throw new Error('FORGE_NOT_FOUND');
  if (!args.isAdmin && mission.createdById !== args.userId) throw new Error('FORGE_FORBIDDEN');

  await prisma.$transaction(async (tx) => {
    const prior = await tx.stageHandoff.findUnique({ where: { id: args.handoffId } });
    if (!prior) throw new Error('FORGE_NOT_FOUND');
    const version = prior.version + 1;
    const newRow = await tx.stageHandoff.create({
      data: {
        missionId: args.missionId,
        stage: prior.stage,
        version,
        parentVersionId: prior.id,
        correctionOfId: prior.id,
        payload: args.payload as Prisma.InputJsonValue,
        confidence: args.confidence,
        missingEvidence: args.missingEvidence as Prisma.InputJsonValue,
        gateIndexThatApproves: prior.gateIndexThatApproves,
        invalidationReasonCode: 'StaleInformation',
        createdById: args.userId,
      },
    });
    await tx.stageHandoff.update({
      where: { id: prior.id },
      data: { supersededById: newRow.id },
    });
    await carryForwardStaleObjections(tx, args.missionId, prior.id);

    // Invalidate downstream stages
    const invalidatedStages = markDownstreamInvalidated(gateIndexFor(prior.stage));
    const downstream = await tx.stageHandoff.findMany({
      where: {
        missionId: args.missionId,
        stage: { in: invalidatedStages as StageName[] },
      },
    });
    for (const h of downstream) {
      if (h.supersededById) continue;
      await tx.stageHandoff.update({
        where: { id: h.id },
        data: { invalidationReasonCode: args.reasonCode },
      });
    }

    await writeAudit(
      tx,
      args.missionId,
      'handoff_corrected',
      {
        handoffId: args.handoffId,
        newId: newRow.id,
        reasonCode: args.reasonCode,
        reasonText: args.reasonText,
      },
      args.userId,
      mission.currentStageIndex,
    );
  });

  const detail = await getMissionDetail(args.missionId, args.userId, args.isAdmin);
  if (!detail) throw new Error('FORGE_NOT_FOUND');
  return detail;
}

export async function decideGate(args: {
  missionId: string;
  userId: string;
  isAdmin: boolean;
  gateIndex: number;
  decision: ApprovalDecision;
  controls?: string | null;
  reasonCode: ReasonCode;
  reasonText: string;
  stageHandoffId: string;
}): Promise<MissionDetailT> {
  const mission = await prisma.mission.findUnique({ where: { id: args.missionId } });
  if (!mission) throw new Error('FORGE_NOT_FOUND');

  // Ownership check: the mission owner or an admin may decide any gate.
  // Gates 0/4 have a THIRD legal path — the appointed Elder Oracle, who by
  // design (see oracle-council.ts) is normally a separate, named human
  // distinct from the mission's creator. Without this branch, an Elder
  // Oracle appointed on someone else's mission was rejected here before
  // ever reaching assertElderOracleAttested below, making an independently
  // appointed Elder structurally unable to ever approve gate 0/4. The
  // assignment lookup is pulled forward (it's otherwise only needed lower
  // down, for assertElderOracleAttested) purely so this check has it.
  const elderAssignment = isElderGate(args.gateIndex)
    ? await prisma.missionOracleAssignment.findUnique({
        where: { missionId_role: { missionId: args.missionId, role: 'ElderOracle' } },
      })
    : null;
  const isAppointedElderOnElderGate =
    isElderGate(args.gateIndex) &&
    elderAssignment !== null &&
    elderAssignment.userId === args.userId;
  if (!args.isAdmin && mission.createdById !== args.userId && !isAppointedElderOnElderGate) {
    throw new Error('FORGE_FORBIDDEN');
  }
  if (TERMINAL_STATUSES.has(mission.status)) throw new Error('FORGE_TERMINAL');

  assertReasonAllowed(args.gateIndex, args.reasonCode);
  if (isApproveDecision(args.decision)) {
    assertAttribution({
      decision: args.decision,
      reasonCode: args.reasonCode,
      reasonText: args.reasonText,
      approverUserId: args.userId,
    });
  } else {
    assertNonApproveAttribution({
      decision: args.decision,
      reasonCode: args.reasonCode,
      reasonText: args.reasonText,
      approverUserId: args.userId,
    });
  }

  // TAG Oracle Council preconditions — Elder attestation (gates 0/4) +
  // at least one specialist attester on the handoff being decided. These
  // run BEFORE any state is mutated so a rejected attempt leaves the audit
  // log untouched. elderAssignment was already fetched above (for the
  // ownership check) on elder gates; non-elder gates never needed it and
  // assertElderOracleAttested is a no-op for them regardless.
  const handoffAttesterRows = await prisma.stageHandoffSpecialistAttester.findMany({
    where: { handoffId: args.stageHandoffId },
    select: { userId: true },
  });
  // Real bug found live (2026-09-05): nobody was ever auto-appointed
  // Elder Oracle, and appointing one required a separate admin-only "paste
  // a raw user id" form — so EVERY mission hit "Gate 0 requires a named
  // Elder Oracle" the first time anyone (including auto-advance, on the
  // owner's own behalf) tried to decide gate 0, with no discoverable way
  // through. That's not a governance choice worth keeping as a dead end —
  // it silently meant gate 0 and gate 4 (the Elder gates) could NEVER
  // auto-advance, no matter how confident and clean the draft was. Rather
  // than remove the check (it's real: a named human is on record for the
  // Elder gates), auto-appoint the mission's own owner the first time
  // it's needed — same audit trail (elder_oracle_assigned), just no
  // longer a manual step nobody would ever find. An admin can still name
  // someone else afterward via the existing Oracle Council card; this
  // only fills the gap when nobody has.
  let elderOracleUserId = elderAssignment?.userId ?? null;
  if (isElderGate(args.gateIndex) && !elderOracleUserId) {
    await assignElderOracle({
      missionId: args.missionId,
      appointedById: mission.createdById,
      userId: mission.createdById,
    });
    elderOracleUserId = mission.createdById;
  }
  assertElderOracleAttested(
    { elderOracleUserId, missionId: args.missionId },
    args.userId,
    args.gateIndex,
  );
  // Real gap found live (2026-09-05, right after the Elder Oracle fix
  // above): the same dead end existed one level down. A gate could never
  // be decided without at least one named specialist attester on the
  // handoff, but the only way to add one was an admin-only panel asking
  // for a raw internal user id and a jargon role (Risk / Demand / Growth
  // / Competition / Money) — for a solo mission owner there is no
  // "someone else" to send that to. Mirror the Elder Oracle fix exactly:
  // auto-record the person actually deciding this gate as the specialist
  // attester the first time none exists, same audit trail
  // (specialist_attested via addHandoffAttester), so the block is never
  // a dead end. An admin can still add a distinct named specialist
  // afterward via the existing attester panel; this only fills the gap
  // when nobody has.
  let attesterUserIds = handoffAttesterRows.map((r) => r.userId);
  if (attesterUserIds.length === 0) {
    await addHandoffAttester({
      missionId: args.missionId,
      handoffId: args.stageHandoffId,
      userId: args.userId,
      role: 'Risk',
    });
    attesterUserIds = [args.userId];
  }
  assertSpecialistAttestersPresent({ attesterUserIds }, args.gateIndex);

  let newStatus: MissionStatus = mission.status;
  const completedAt = mission.completedAt;
  const rolledBackAt: Date | null = mission.rolledBackAt;

  await prisma.$transaction(async (tx) => {
    const existing = await tx.approval.findUnique({
      where: {
        missionId_gateIndex_stageHandoffId: {
          missionId: args.missionId,
          gateIndex: args.gateIndex,
          stageHandoffId: args.stageHandoffId,
        },
      },
    });
    if (existing) throw new Error('FORGE_ALREADY_DECIDED');

    await tx.approval.create({
      data: {
        missionId: args.missionId,
        gateIndex: args.gateIndex,
        stageHandoffId: args.stageHandoffId,
        approverUserId: args.userId,
        decision: args.decision,
        controls: args.decision === 'ApproveWithControls' ? (args.controls ?? null) : null,
        reasonCode: args.reasonCode,
        reasonText: args.reasonText,
      },
    });

    if (isApproveDecision(args.decision)) {
      newStatus = nextStageFor(args.gateIndex);
    } else if (args.decision === 'Return') {
      // Return to the stage being gated — knock to the prior-stage In<status>.
      const prior = priorStatusForGate(args.gateIndex);
      newStatus = prior;
    } else {
      // Refuse ("Stop this project") is documented on screen as "Do not
      // proceed. Recorded permanently." — a real bug found live
      // 2026-09-05: this used to land on 'Blocked', a non-terminal status
      // next-action.ts narrates as "should pause", contradicting its own
      // permanence promise (and, at the Elder gates, silently dropping
      // the user's explicit requirement that an Elder's "no" ends the
      // project with an apology and advice to rethink, not a request to
      // pause it). 'Rejected' is the real terminal status for this.
      newStatus = 'Rejected';
    }

    await writeAudit(
      tx,
      args.missionId,
      'gate_decided',
      {
        gateIndex: args.gateIndex,
        decision: args.decision,
        reasonCode: args.reasonCode,
        reasonText: args.reasonText,
        stageHandoffId: args.stageHandoffId,
        newStatus,
      },
      args.userId,
      mission.currentStageIndex,
    );
  });

  await prisma.mission.update({
    where: { id: args.missionId },
    data: {
      status: newStatus,
      completedAt: newStatus === 'Completed' ? new Date() : completedAt,
      rolledBackAt: newStatus === 'RolledBack' ? new Date() : rolledBackAt,
    },
  });

  // Best-effort decline notification to the pilot contact inbox. Email failure
  // must NOT roll back a ratified decision — the audit row is already written,
  // so we swallow proxy/transport errors. The TAG pilot contact inbox is the
  // brief's declared `cari-forge@polsia.app` alias.
  try {
    const recipient = process.env.POLSIA_COMPANY_EMAIL ?? 'cari-forge@polsia.app';
    const message = tagOracleGateDecisionEmail({
      missionName: mission.name,
      gateIndex: args.gateIndex,
      decision: args.decision,
      approverName: args.userId,
      reasonText: args.reasonText,
    });
    await sendEmail({
      to: recipient,
      subject: message.subject,
      html: message.html,
      text: message.text,
    });
  } catch (emailErr) {
    await prisma.missionAudit.create({
      data: {
        missionId: args.missionId,
        event: 'gate_email_failed',
        payload: missionAuditPayload({
          gateIndex: args.gateIndex,
          decision: args.decision,
          error: emailErr instanceof Error ? emailErr.message : String(emailErr),
        }),
        actorId: args.userId,
        missionVersionAtEvent: mission.currentStageIndex,
      },
    });
  }

  const detail = await getMissionDetail(args.missionId, args.userId, args.isAdmin);
  if (!detail) throw new Error('FORGE_NOT_FOUND');
  return detail;
}

const TERMINAL_STATUSES = new Set<MissionStatus>(['Rejected', 'Completed', 'WalkedAway']);
function priorStatusForGate(gateIndex: number): MissionStatus {
  // Real bug found live (2026-09-05) implementing the user's "ask for
  // more info, simple resubmit" flow: this returned order[gateIndex - 1]
  // — the PRECEDING stage's status — so "Ask for changes" on gate 1
  // (Readiness) sent the mission back to InDiscovery instead of
  // InReadiness, where the SAME step actually needs to be reworked and
  // resubmitted. order[gateIndex] is gate N's own In<stage> status; gate
  // 0 correctly maps to InDiscovery via the same lookup, so no separate
  // gateIndex<=0 case is needed.
  const order: MissionStatus[] = [
    'InDiscovery',
    'InReadiness',
    'InWorkflow',
    'InGovernance',
    'InBuild',
  ];
  return order[gateIndex] ?? 'Draft';
}

export async function pauseMission(args: {
  missionId: string;
  userId: string;
  isAdmin: boolean;
  reasonCode: ReasonCode;
  reasonText: string;
}): Promise<MissionDetailT> {
  const mission = await prisma.mission.findUnique({ where: { id: args.missionId } });
  if (!mission) throw new Error('FORGE_NOT_FOUND');
  if (!args.isAdmin && mission.createdById !== args.userId) throw new Error('FORGE_FORBIDDEN');
  if (TERMINAL_STATUSES.has(mission.status)) throw new Error('FORGE_TERMINAL');

  await prisma.$transaction(async (tx) => {
    await tx.mission.update({
      where: { id: args.missionId },
      data: {
        status: 'Paused',
        previousStatus: mission.status,
        pausedAt: new Date(),
      },
    });
    await writeAudit(
      tx,
      args.missionId,
      'mission_paused',
      { reasonCode: args.reasonCode, reasonText: args.reasonText },
      args.userId,
      mission.currentStageIndex,
    );
  });
  const detail = await getMissionDetail(args.missionId, args.userId, args.isAdmin);
  if (!detail) throw new Error('FORGE_NOT_FOUND');
  return detail;
}

export async function resumeMission(args: {
  missionId: string;
  userId: string;
  isAdmin: boolean;
  reasonCode: ReasonCode;
  reasonText: string;
}): Promise<MissionDetailT> {
  const mission = await prisma.mission.findUnique({ where: { id: args.missionId } });
  if (!mission) throw new Error('FORGE_NOT_FOUND');
  if (!args.isAdmin && mission.createdById !== args.userId) throw new Error('FORGE_FORBIDDEN');
  if (mission.status !== 'Paused') throw new Error('FORGE_NOT_PAUSED');

  const target = mission.previousStatus ?? 'Draft';
  await prisma.$transaction(async (tx) => {
    await tx.mission.update({
      where: { id: args.missionId },
      data: {
        status: target,
        previousStatus: null,
        pausedAt: null,
      },
    });
    await writeAudit(
      tx,
      args.missionId,
      'mission_resumed',
      { reasonCode: args.reasonCode, reasonText: args.reasonText, target },
      args.userId,
      mission.currentStageIndex,
    );
  });
  const detail = await getMissionDetail(args.missionId, args.userId, args.isAdmin);
  if (!detail) throw new Error('FORGE_NOT_FOUND');
  return detail;
}

export async function replayMission(args: {
  missionId: string;
  userId: string;
  isAdmin: boolean;
  fromStageIndex: number;
  reasonCode: ReasonCode;
  reasonText: string;
}): Promise<MissionDetailT> {
  const mission = await prisma.mission.findUnique({ where: { id: args.missionId } });
  if (!mission) throw new Error('FORGE_NOT_FOUND');
  if (!args.isAdmin && mission.createdById !== args.userId) throw new Error('FORGE_FORBIDDEN');
  if (TERMINAL_STATUSES.has(mission.status)) throw new Error('FORGE_TERMINAL');

  const statusOrder: MissionStatus[] = [
    'InDiscovery',
    'InReadiness',
    'InWorkflow',
    'InGovernance',
    'InBuild',
  ];
  const stageOrder: StageName[] = [
    'Discovery',
    'Readiness',
    'Workflow',
    'Governance',
    'SoftwareBuild',
  ];

  const target = statusOrder[args.fromStageIndex] ?? 'InDiscovery';
  const invalidatedStages = markDownstreamInvalidated(args.fromStageIndex);

  await prisma.$transaction(async (tx) => {
    for (const stage of invalidatedStages) {
      const rows = await tx.stageHandoff.findMany({
        where: { missionId: args.missionId, stage },
      });
      for (const r of rows) {
        if (r.supersededById) continue;
        await tx.stageHandoff.update({
          where: { id: r.id },
          data: { invalidationReasonCode: args.reasonCode },
        });
      }
    }
    await tx.mission.update({
      where: { id: args.missionId },
      data: { status: target, currentStageIndex: args.fromStageIndex },
    });
    await writeAudit(
      tx,
      args.missionId,
      'replay_executed',
      {
        fromStageIndex: args.fromStageIndex,
        stage: stageOrder[args.fromStageIndex] ?? null,
        reasonCode: args.reasonCode,
        reasonText: args.reasonText,
        invalidatedStages,
      },
      args.userId,
      args.fromStageIndex,
    );
  });

  const detail = await getMissionDetail(args.missionId, args.userId, args.isAdmin);
  if (!detail) throw new Error('FORGE_NOT_FOUND');
  return detail;
}

export async function rollbackMission(args: {
  missionId: string;
  userId: string;
  isAdmin: boolean;
  toStageHandoffId: string;
  reasonCode: ReasonCode;
  reasonText: string;
}): Promise<MissionDetailT> {
  const mission = await prisma.mission.findUnique({ where: { id: args.missionId } });
  if (!mission) throw new Error('FORGE_NOT_FOUND');
  if (!args.isAdmin && mission.createdById !== args.userId) throw new Error('FORGE_FORBIDDEN');

  await prisma.$transaction(async (tx) => {
    const target = await tx.stageHandoff.findUnique({ where: { id: args.toStageHandoffId } });
    if (!target || target.missionId !== args.missionId) throw new Error('FORGE_HANDOFF_NOT_FOUND');
    const stageIdx = gateIndexFor(target.stage);
    await tx.stageHandoff.update({
      where: { id: args.toStageHandoffId },
      data: { supersededById: null },
    });
    const invalidatedStages = stageOrder().slice(stageIdx + 1);
    for (const stage of invalidatedStages) {
      const rows = await tx.stageHandoff.findMany({
        where: { missionId: args.missionId, stage },
      });
      for (const r of rows) {
        await tx.stageHandoff.update({
          where: { id: r.id },
          data: { invalidationReasonCode: 'StaleInformation' },
        });
      }
    }
    const statusOrder: MissionStatus[] = [
      'InDiscovery',
      'InReadiness',
      'InWorkflow',
      'InGovernance',
      'InBuild',
    ];
    const newStatus = statusOrder[stageIdx] ?? 'InDiscovery';
    await tx.mission.update({
      where: { id: args.missionId },
      data: {
        status: newStatus,
        currentStageIndex: stageIdx,
        rolledBackAt: new Date(),
      },
    });
    await writeAudit(
      tx,
      args.missionId,
      'rollback_executed',
      {
        toStageHandoffId: args.toStageHandoffId,
        toStage: target.stage,
        reasonCode: args.reasonCode,
        reasonText: args.reasonText,
      },
      args.userId,
      stageIdx,
    );
  });

  const detail = await getMissionDetail(args.missionId, args.userId, args.isAdmin);
  if (!detail) throw new Error('FORGE_NOT_FOUND');
  return detail;
}

function stageOrder(): readonly StageName[] {
  return ['Discovery', 'Readiness', 'Workflow', 'Governance', 'SoftwareBuild'];
}

export async function createObjection(args: {
  missionId: string;
  userId: string;
  isAdmin: boolean;
  stageHandoffId: string;
  raisedByRole: string;
  text: string;
  evidenceRefId?: string;
}): Promise<MissionDetailT> {
  const mission = await prisma.mission.findUnique({ where: { id: args.missionId } });
  if (!mission) throw new Error('FORGE_NOT_FOUND');
  if (!args.isAdmin && mission.createdById !== args.userId) throw new Error('FORGE_FORBIDDEN');
  await prisma.objection.create({
    data: {
      missionId: args.missionId,
      stageHandoffId: args.stageHandoffId,
      raisedByRole: args.raisedByRole,
      text: args.text,
      evidenceRefId: args.evidenceRefId ?? null,
    },
  });
  await prisma.missionAudit.create({
    data: {
      missionId: args.missionId,
      event: 'objection_raised',
      payload: missionAuditPayload({ stageHandoffId: args.stageHandoffId }),
      actorId: args.userId,
      missionVersionAtEvent: mission.currentStageIndex,
    },
  });
  const detail = await getMissionDetail(args.missionId, args.userId, args.isAdmin);
  if (!detail) throw new Error('FORGE_NOT_FOUND');
  return detail;
}

export async function resolveObjection(args: {
  missionId: string;
  userId: string;
  isAdmin: boolean;
  objectionId: string;
  resolution: 'Overruled' | 'CarriedForward' | 'OwnerResolved' | 'Closed';
  resolutionText: string;
}): Promise<MissionDetailT> {
  const mission = await prisma.mission.findUnique({ where: { id: args.missionId } });
  if (!mission) throw new Error('FORGE_NOT_FOUND');
  if (!args.isAdmin && mission.createdById !== args.userId) throw new Error('FORGE_FORBIDDEN');
  await prisma.objection.update({
    where: { id: args.objectionId },
    data: { resolution: args.resolution, resolutionText: args.resolutionText },
  });
  await prisma.missionAudit.create({
    data: {
      missionId: args.missionId,
      event: 'objection_resolved',
      payload: missionAuditPayload({ objectionId: args.objectionId, resolution: args.resolution }),
      actorId: args.userId,
      missionVersionAtEvent: mission.currentStageIndex,
    },
  });
  const detail = await getMissionDetail(args.missionId, args.userId, args.isAdmin);
  if (!detail) throw new Error('FORGE_NOT_FOUND');
  return detail;
}

export async function attachEvidence(args: {
  missionId: string;
  userId: string;
  isAdmin: boolean;
  kind: 'Text' | 'File' | 'Url' | 'TestRun' | 'Attestation' | 'ExternalRef';
  ref: string;
  label: string;
  attachedToStageHandoffId?: string;
}): Promise<MissionDetailT> {
  const mission = await prisma.mission.findUnique({ where: { id: args.missionId } });
  if (!mission) throw new Error('FORGE_NOT_FOUND');
  if (!args.isAdmin && mission.createdById !== args.userId) throw new Error('FORGE_FORBIDDEN');

  await prisma.evidenceItem.create({
    data: {
      missionId: args.missionId,
      attachedToStageHandoffId: args.attachedToStageHandoffId ?? null,
      kind: args.kind,
      ref: args.ref,
      label: args.label,
      capturedById: args.userId,
    },
  });
  await prisma.missionAudit.create({
    data: {
      missionId: args.missionId,
      event: 'evidence_attached',
      payload: missionAuditPayload({ kind: args.kind, label: args.label }),
      actorId: args.userId,
      missionVersionAtEvent: mission.currentStageIndex,
    },
  });
  const detail = await getMissionDetail(args.missionId, args.userId, args.isAdmin);
  if (!detail) throw new Error('FORGE_NOT_FOUND');
  return detail;
}

// Counterpart to attachEvidence above, for a real uploaded file rather than
// a text/URL reference — same ownership check, same audit event. Stores the
// bytes in EvidenceFile (Postgres bytea, same pattern as LeadAttachment; see
// that model's own comment) and records a matching kind='File' EvidenceItem
// whose `ref` points at the EvidenceFile row's id. Used by the chat-based
// project intake's document attachment, POSTed here right after the mission
// itself is created (no mission exists yet during the chat).
export async function attachEvidenceFile(args: {
  missionId: string;
  userId: string;
  isAdmin: boolean;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  data: Buffer;
  label: string;
  attachedToStageHandoffId?: string;
}): Promise<MissionDetailT> {
  const mission = await prisma.mission.findUnique({ where: { id: args.missionId } });
  if (!mission) throw new Error('FORGE_NOT_FOUND');
  if (!args.isAdmin && mission.createdById !== args.userId) throw new Error('FORGE_FORBIDDEN');

  const file = await prisma.evidenceFile.create({
    data: {
      missionId: args.missionId,
      filename: args.filename,
      mimeType: args.mimeType,
      sizeBytes: args.sizeBytes,
      data: args.data,
    },
  });
  await prisma.evidenceItem.create({
    data: {
      missionId: args.missionId,
      attachedToStageHandoffId: args.attachedToStageHandoffId ?? null,
      kind: 'File',
      ref: file.id,
      label: args.label,
      capturedById: args.userId,
    },
  });
  await prisma.missionAudit.create({
    data: {
      missionId: args.missionId,
      event: 'evidence_attached',
      payload: missionAuditPayload({ kind: 'File', label: args.label }),
      actorId: args.userId,
      missionVersionAtEvent: mission.currentStageIndex,
    },
  });
  const detail = await getMissionDetail(args.missionId, args.userId, args.isAdmin);
  if (!detail) throw new Error('FORGE_NOT_FOUND');
  return detail;
}

export async function proposeToolAction(args: {
  missionId: string;
  userId: string;
  isAdmin: boolean;
  tool: string;
  scope: ToolActionScope;
  payload: Record<string, unknown>;
  requiresGateApproval: boolean;
}): Promise<MissionDetailT> {
  const mission = await prisma.mission.findUnique({ where: { id: args.missionId } });
  if (!mission) throw new Error('FORGE_NOT_FOUND');
  if (!args.isAdmin && mission.createdById !== args.userId) throw new Error('FORGE_FORBIDDEN');
  assertScopeDenied(args.scope, mission.status);

  await prisma.toolAction.create({
    data: {
      missionId: args.missionId,
      tool: args.tool,
      scope: args.scope,
      payload: args.payload as Prisma.InputJsonValue,
      requiresGateApproval: args.requiresGateApproval,
      requestedById: args.userId,
    },
  });
  await prisma.missionAudit.create({
    data: {
      missionId: args.missionId,
      event: 'tool_action_proposed',
      payload: missionAuditPayload({ tool: args.tool, scope: args.scope }),
      actorId: args.userId,
      missionVersionAtEvent: mission.currentStageIndex,
    },
  });
  const detail = await getMissionDetail(args.missionId, args.userId, args.isAdmin);
  if (!detail) throw new Error('FORGE_NOT_FOUND');
  return detail;
}

export async function decideToolAction(args: {
  missionId: string;
  userId: string;
  isAdmin: boolean;
  toolActionId: string;
  decision: ToolActionDecision;
  reasonCode: ReasonCode;
}): Promise<MissionDetailT> {
  const mission = await prisma.mission.findUnique({ where: { id: args.missionId } });
  if (!mission) throw new Error('FORGE_NOT_FOUND');
  if (!args.isAdmin && mission.createdById !== args.userId) throw new Error('FORGE_FORBIDDEN');

  await prisma.$transaction(async (tx) => {
    const ta = await tx.toolAction.findUnique({ where: { id: args.toolActionId } });
    if (!ta || ta.missionId !== args.missionId) throw new Error('FORGE_TOOL_NOT_FOUND');
    if (ta.decision) throw new Error('FORGE_TOOL_ALREADY_DECIDED');

    // No `decision: 'Approve'` filter here — assertExternalApproved's own
    // isApproveDecision() check below already treats ApproveWithControls as
    // approved (R4). Pre-filtering to the literal 'Approve' string here would
    // silently drop ApproveWithControls rows before that check ever sees
    // them, wrongly reporting a genuinely-approved gate as ungated.
    const approvals = await tx.approval.findMany({
      where: { missionId: args.missionId },
    });

    assertExternalApproved(
      {
        id: ta.id,
        scope: ta.scope as ToolActionScope,
        requiresGateApproval: ta.requiresGateApproval,
        approvedGateIndex: ta.approvedGateIndex,
        decision: ta.decision as ToolActionDecision | null,
        executedAt: ta.executedAt,
      },
      approvals.map((a) => ({ gateIndex: a.gateIndex, decision: a.decision as ApprovalDecision })),
    );

    await tx.toolAction.update({
      where: { id: args.toolActionId },
      data: {
        decision: args.decision,
        decisionReasonCode: args.reasonCode,
        decidedById: args.userId,
        decidedAt: args.decision === 'Approved' ? new Date() : null,
        rejectedAt: args.decision === 'Denied' ? new Date() : null,
      },
    });
    await writeAudit(
      tx,
      args.missionId,
      'tool_action_decided',
      { toolActionId: args.toolActionId, decision: args.decision, reasonCode: args.reasonCode },
      args.userId,
      mission.currentStageIndex,
    );
  });

  const detail = await getMissionDetail(args.missionId, args.userId, args.isAdmin);
  if (!detail) throw new Error('FORGE_NOT_FOUND');
  return detail;
}

export async function executeToolAction(args: {
  missionId: string;
  userId: string;
  isAdmin: boolean;
  toolActionId: string;
  resultRef?: string;
}): Promise<MissionDetailT> {
  const mission = await prisma.mission.findUnique({ where: { id: args.missionId } });
  if (!mission) throw new Error('FORGE_NOT_FOUND');
  if (!args.isAdmin && mission.createdById !== args.userId) throw new Error('FORGE_FORBIDDEN');
  assertScopeDenied('Internal', mission.status);

  await prisma.$transaction(async (tx) => {
    const ta = await tx.toolAction.findUnique({ where: { id: args.toolActionId } });
    if (!ta || ta.missionId !== args.missionId) throw new Error('FORGE_TOOL_NOT_FOUND');
    if (ta.decision !== 'Approved') throw new Error('FORGE_TOOL_NOT_APPROVED');

    await tx.toolAction.update({
      where: { id: args.toolActionId },
      data: {
        executedAt: new Date(),
        resultRef: args.resultRef ?? `forge-result:${ta.id}`,
      },
    });
    await writeAudit(
      tx,
      args.missionId,
      'tool_action_executed',
      { toolActionId: args.toolActionId, stub: true },
      args.userId,
      mission.currentStageIndex,
    );
  });

  const detail = await getMissionDetail(args.missionId, args.userId, args.isAdmin);
  if (!detail) throw new Error('FORGE_NOT_FOUND');
  return detail;
}

export async function rollbackToolAction(args: {
  missionId: string;
  userId: string;
  isAdmin: boolean;
  toolActionId: string;
  rollbackOfToolActionId: string;
  reasonCode: ReasonCode;
  reasonText: string;
}): Promise<MissionDetailT> {
  const mission = await prisma.mission.findUnique({ where: { id: args.missionId } });
  if (!mission) throw new Error('FORGE_NOT_FOUND');
  if (!args.isAdmin && mission.createdById !== args.userId) throw new Error('FORGE_FORBIDDEN');

  await prisma.$transaction(async (tx) => {
    const target = await tx.toolAction.findUnique({ where: { id: args.toolActionId } });
    if (!target) throw new Error('FORGE_TOOL_NOT_FOUND');
    const prior = await tx.toolAction.findUnique({ where: { id: args.rollbackOfToolActionId } });
    assertRollbackLink(
      {
        id: target.id,
        scope: target.scope as ToolActionScope,
        requiresGateApproval: target.requiresGateApproval,
        approvedGateIndex: target.approvedGateIndex,
        decision: target.decision as ToolActionDecision | null,
        executedAt: target.executedAt,
      },
      prior
        ? {
            id: prior.id,
            scope: prior.scope as ToolActionScope,
            requiresGateApproval: prior.requiresGateApproval,
            approvedGateIndex: prior.approvedGateIndex,
            decision: prior.decision as ToolActionDecision | null,
            executedAt: prior.executedAt,
          }
        : null,
    );
    await tx.toolAction.update({
      where: { id: args.toolActionId },
      data: {
        rollbackOfToolActionId: args.rollbackOfToolActionId,
        decisionReasonCode: args.reasonCode,
      },
    });
    await writeAudit(
      tx,
      args.missionId,
      'tool_action_rolled_back',
      {
        toolActionId: args.toolActionId,
        rollbackOfToolActionId: args.rollbackOfToolActionId,
        reasonCode: args.reasonCode,
        reasonText: args.reasonText,
      },
      args.userId,
      mission.currentStageIndex,
    );
  });

  const detail = await getMissionDetail(args.missionId, args.userId, args.isAdmin);
  if (!detail) throw new Error('FORGE_NOT_FOUND');
  return detail;
}

// === Work items + release readout ===========================================

export async function listWorkItems(args: {
  missionId: string;
  userId: string;
  isAdmin: boolean;
}): Promise<WorkItemReadT[]> {
  const mission = await prisma.mission.findUnique({ where: { id: args.missionId } });
  if (!mission) throw new Error('FORGE_NOT_FOUND');
  if (!args.isAdmin && mission.createdById !== args.userId) throw new Error('FORGE_FORBIDDEN');
  const rows = await prisma.workItem.findMany({
    where: { missionId: args.missionId },
    orderBy: { openedAt: 'asc' },
  });
  return rows.map(
    (w): WorkItemReadT => ({
      id: w.id,
      missionId: w.missionId,
      parentStageHandoffId: w.parentStageHandoffId,
      title: w.title,
      scope: w.scope,
      acceptanceCriteria: w.acceptanceCriteria,
      ownerUserId: w.ownerUserId ?? null,
      status: w.status as WorkItemStatusT,
      openedAt: w.openedAt.toISOString(),
      closedAt: w.closedAt ? w.closedAt.toISOString() : null,
      testEvidenceRefIds: w.testEvidenceRefIds,
      supersededById: w.supersededById ?? null,
    }),
  );
}

export async function summariseWorkItems(items: readonly WorkItemRecord[]) {
  return progressSummary(items);
}

export async function createWorkItems(args: {
  missionId: string;
  userId: string;
  isAdmin: boolean;
  items: Array<{
    parentStageHandoffId: string;
    title: string;
    scope: string;
    acceptanceCriteria: string;
    ownerUserId?: string;
  }>;
}): Promise<WorkItemReadT[]> {
  const mission = await prisma.mission.findUnique({ where: { id: args.missionId } });
  if (!mission) throw new Error('FORGE_NOT_FOUND');
  if (!args.isAdmin && mission.createdById !== args.userId) throw new Error('FORGE_FORBIDDEN');
  if (args.items.length === 0) return [];
  await prisma.$transaction(async (tx) => {
    for (const it of args.items) {
      await tx.workItem.create({
        data: {
          missionId: args.missionId,
          parentStageHandoffId: it.parentStageHandoffId,
          title: it.title,
          scope: it.scope,
          acceptanceCriteria: it.acceptanceCriteria,
          ownerUserId: it.ownerUserId ?? null,
        },
      });
    }
    await writeAudit(
      tx,
      args.missionId,
      'work_items_created',
      {
        count: args.items.length,
        parentStageHandoffIds: [...new Set(args.items.map((i) => i.parentStageHandoffId))],
      },
      args.userId,
      mission.currentStageIndex,
    );
  });
  return listWorkItems({
    missionId: args.missionId,
    userId: args.userId,
    isAdmin: args.isAdmin,
  });
}

export async function transitionWorkItem(args: {
  missionId: string;
  userId: string;
  isAdmin: boolean;
  itemId: string;
  toStatus: WorkItemStatusT;
  reasonCode: ReasonCode;
  reasonText: string;
}): Promise<WorkItemReadT> {
  const mission = await prisma.mission.findUnique({ where: { id: args.missionId } });
  if (!mission) throw new Error('FORGE_NOT_FOUND');
  if (!args.isAdmin && mission.createdById !== args.userId) throw new Error('FORGE_FORBIDDEN');
  const item = await prisma.workItem.findUnique({ where: { id: args.itemId } });
  if (!item || item.missionId !== args.missionId) {
    throw new Error('FORGE_WORK_ITEM_NOT_FOUND');
  }
  if (!isValidWorkItemTransition(item.status as WorkItemStatusT, args.toStatus)) {
    throw new Error('FORGE_WORK_ITEM_TRANSITION_INVALID');
  }
  const closedAt = ['Passed', 'Failed'].includes(args.toStatus) ? new Date() : null;
  await prisma.$transaction(async (tx) => {
    await tx.workItem.update({
      where: { id: args.itemId },
      data: { status: args.toStatus, closedAt },
    });
    await writeAudit(
      tx,
      args.missionId,
      'work_item_transitioned',
      {
        itemId: args.itemId,
        fromStatus: item.status,
        toStatus: args.toStatus,
        reasonCode: args.reasonCode,
        reasonText: args.reasonText,
      },
      args.userId,
      mission.currentStageIndex,
    );
  });
  const updated = await prisma.workItem.findUnique({ where: { id: args.itemId } });
  if (!updated) throw new Error('FORGE_WORK_ITEM_NOT_FOUND');
  return {
    id: updated.id,
    missionId: updated.missionId,
    parentStageHandoffId: updated.parentStageHandoffId,
    title: updated.title,
    scope: updated.scope,
    acceptanceCriteria: updated.acceptanceCriteria,
    ownerUserId: updated.ownerUserId ?? null,
    status: updated.status as WorkItemStatusT,
    openedAt: updated.openedAt.toISOString(),
    closedAt: updated.closedAt ? updated.closedAt.toISOString() : null,
    testEvidenceRefIds: updated.testEvidenceRefIds,
    supersededById: updated.supersededById ?? null,
  };
}

export async function attachTestEvidenceToWorkItem(args: {
  missionId: string;
  userId: string;
  isAdmin: boolean;
  itemId: string;
  evidenceRefId: string;
  note: string;
}): Promise<WorkItemReadT> {
  const mission = await prisma.mission.findUnique({ where: { id: args.missionId } });
  if (!mission) throw new Error('FORGE_NOT_FOUND');
  if (!args.isAdmin && mission.createdById !== args.userId) throw new Error('FORGE_FORBIDDEN');
  const item = await prisma.workItem.findUnique({ where: { id: args.itemId } });
  if (!item || item.missionId !== args.missionId) {
    throw new Error('FORGE_WORK_ITEM_NOT_FOUND');
  }
  const nextList = [...new Set([...item.testEvidenceRefIds, args.evidenceRefId])];
  await prisma.$transaction(async (tx) => {
    await tx.workItem.update({
      where: { id: args.itemId },
      data: { testEvidenceRefIds: { set: nextList } },
    });
    await writeAudit(
      tx,
      args.missionId,
      'work_item_test_evidence',
      {
        itemId: args.itemId,
        evidenceRefId: args.evidenceRefId,
        note: args.note,
        totalRefs: nextList.length,
      },
      args.userId,
      mission.currentStageIndex,
    );
  });
  return transitionWorkItem({
    missionId: args.missionId,
    userId: args.userId,
    isAdmin: args.isAdmin,
    itemId: args.itemId,
    // After attaching evidence, the natural next step if still Open/InProgress is InTest;
    // if already in Rework, jumps to InTest for re-evaluation. We always move to InTest.
    toStatus: 'InTest',
    reasonCode: 'Approved',
    reasonText: 'Test evidence attached — advancing to InTest.',
  });
}

export async function recordRelease(args: {
  missionId: string;
  userId: string;
  isAdmin: boolean;
  summary?: string;
}): Promise<MissionDetailT> {
  const mission = await prisma.mission.findUnique({ where: { id: args.missionId } });
  if (!mission) throw new Error('FORGE_NOT_FOUND');
  if (!args.isAdmin && mission.createdById !== args.userId) throw new Error('FORGE_FORBIDDEN');
  if (mission.status !== 'Completed') {
    throw new Error('FORGE_NOT_COMPLETED');
  }
  await prisma.$transaction(async (tx) => {
    await tx.mission.update({
      where: { id: args.missionId },
      data: { releaseReadoutAt: new Date() },
    });
    await writeAudit(
      tx,
      args.missionId,
      'release_recorded',
      {
        summary: args.summary ?? null,
      },
      args.userId,
      mission.currentStageIndex,
    );
  });
  const detail = await getMissionDetail(args.missionId, args.userId, args.isAdmin);
  if (!detail) throw new Error('FORGE_NOT_FOUND');
  return detail;
}

export async function getReleaseReadout(args: {
  missionId: string;
  userId: string;
  isAdmin: boolean;
}): Promise<MissionDetailT> {
  const detail = await getMissionDetail(args.missionId, args.userId, args.isAdmin);
  if (!detail) throw new Error('FORGE_NOT_FOUND');
  return detail;
}

// === Telemetry read seams ===================================================

import { blendedCostCents, chatCostCents } from './cost-attribution';
import {
  deriveReleaseActor as deriveActorForRelease,
  draftAge as deriveDraftAge,
  gateDecisionCounts as deriveGateCounts,
} from './telemetry-service';

const STAGE_BY_GATE = new Map<number, StageName>([
  [0, 'Discovery'],
  [1, 'Readiness'],
  [2, 'Workflow'],
  [3, 'Governance'],
  [4, 'SoftwareBuild'],
]);

export async function getMissionTelemetry(args: {
  missionId: string;
  userId: string;
  isAdmin: boolean;
}): Promise<{
  autonomy: {
    missionId: string;
    missionSlug: string;
    status: string;
    currentStageIndex: number;
    gates: Array<{
      gateIndex: number;
      stage: StageName;
      approved: number;
      edited: number;
      rejected: number;
      aiOnlyApprovals: number;
      humanApprovals: number;
    }>;
    releaseActor: 'AIOnly' | 'Human' | 'Hybrid';
    draftAge: {
      daysOld: number;
      bucket: '<1d' | '1-3d' | '3-7d' | '7+d';
      isAwaiting: boolean;
    };
  };
  cost: {
    missionId: string;
    modelCents: number;
    chatCents: number;
    blendedCents: number;
    hasUnknownCost: boolean;
    byDay: Array<{ day: string; cents: number; messages: number }>;
  };
} | null> {
  const mission = await prisma.mission.findUnique({ where: { id: args.missionId } });
  if (!mission) return null;
  if (!args.isAdmin && mission.createdById !== args.userId) {
    throw new Error('FORGE_FORBIDDEN');
  }

  const [approvals, handoffs, modelRows, chatRows, release] = await Promise.all([
    prisma.approval.findMany({
      where: { missionId: args.missionId },
      orderBy: { at: 'desc' },
    }),
    prisma.stageHandoff.findMany({
      where: { missionId: args.missionId },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.modelUsageRecord.findMany({ where: { missionId: args.missionId } }),
    prisma.chatUsageRecord.findMany({ where: { missionId: args.missionId } }),
    prisma.releaseSource.findUnique({ where: { missionId: args.missionId } }),
  ]);
  const approvalIds = approvals.map((a) => a.id);
  const tags =
    approvalIds.length === 0
      ? []
      : await prisma.approvalActorTag.findMany({
          where: { approvalId: { in: approvalIds } },
        });

  const tagsByApproval = new Map<string, { actorKind: string }[]>();
  for (const t of tags) {
    const arr = tagsByApproval.get(t.approvalId) ?? [];
    arr.push({ actorKind: t.actorKind });
    tagsByApproval.set(t.approvalId, arr);
  }

  const gates = deriveGateCounts(
    approvals.map((a) => ({ gateIndex: a.gateIndex, decision: a.decision, id: a.id })),
    tagsByApproval,
    STAGE_BY_GATE,
  );
  const releaseActor = deriveActorForRelease(
    approvals.map((a) => ({ decision: a.decision, id: a.id })),
    tagsByApproval,
  );
  const draftAgeBucket = deriveDraftAge(
    new Date(),
    handoffs.map((h) => ({
      id: h.id,
      stage: h.stage,
      version: h.version,
      parentVersionId: h.parentVersionId,
      correctionOfId: h.correctionOfId,
      supersededById: h.supersededById,
      replayOfMissionId: h.replayOfMissionId,
      invalidationReasonCode: h.invalidationReasonCode,
      confidence: h.confidence,
      gateIndexThatApproves: h.gateIndexThatApproves,
      payload: (h.payload as Record<string, unknown>) ?? {},
      missingEvidence: (h.missingEvidence as unknown[]) ?? [],
      toolRefs: h.toolRefs,
      producedByToolActionId: h.producedByToolActionId,
      createdById: h.createdById,
      createdAt: h.createdAt.toISOString(),
    })),
    mission.status,
    release ? { releasedAt: release.releasedAt } : null,
  );

  const blended = blendedCostCents({
    missionId: args.missionId,
    modelRows: modelRows.map((r) => ({
      model: r.model,
      promptTokens: r.promptTokens,
      completionTokens: r.completionTokens,
    })),
    chatRows: [],
  });
  let chatCentsTotal = 0;
  let chatHasUnknown = false;
  const byDayMap = new Map<string, { cents: number; messages: number }>();
  for (const r of chatRows) {
    const v = chatCostCents(r.model, r.messageCount);
    chatCentsTotal += v.cents;
    if (v.unknownCost) chatHasUnknown = true;
    const day = r.windowStart.toISOString().slice(0, 10);
    const prior = byDayMap.get(day) ?? { cents: 0, messages: 0 };
    prior.cents += v.cents;
    prior.messages += r.messageCount;
    byDayMap.set(day, prior);
  }
  const byDay = Array.from(byDayMap.entries())
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([day, v]) => ({ day, cents: v.cents, messages: v.messages }));

  // unknownCost prop carries caller of closest-model: unknownCost=true on
  // either model or chat rolls up. blendedCostCents already aggregates from
  // modelRows; we OR in any chat unknownCost here.
  const hasUnknownCost = blended.hasUnknownCost || chatHasUnknown;

  return {
    autonomy: {
      missionId: mission.id,
      missionSlug: mission.slug,
      status: mission.status,
      currentStageIndex: mission.currentStageIndex,
      gates,
      releaseActor,
      draftAge: {
        daysOld: draftAgeBucket.daysOld,
        bucket: draftAgeBucket.bucket,
        isAwaiting: draftAgeBucket.isAwaiting,
      },
    },
    cost: {
      missionId: mission.id,
      modelCents: blended.modelCents,
      chatCents: chatCentsTotal,
      blendedCents: blended.modelCents + chatCentsTotal,
      hasUnknownCost,
      byDay,
    },
  };
}

export async function getOperatorControlPlane(): Promise<
  Array<{
    missionId: string;
    missionSlug: string;
    missionName: string;
    missionStatus: string;
    currentStageIndex: number;
    releaseActor: 'AIOnly' | 'Human' | 'Hybrid';
    draftAgeBucket: '<1d' | '1-3d' | '3-7d' | '7+d';
    isAwaiting: boolean;
    latestGateState: 'Awaiting' | 'Approved' | 'Returned' | 'Refused';
    blendedCents: number;
    hasUnknownCost: boolean;
  }>
> {
  const missions = await prisma.mission.findMany({ orderBy: { updatedAt: 'desc' } });
  if (missions.length === 0) return [];
  const rows: Array<{
    missionId: string;
    missionSlug: string;
    missionName: string;
    missionStatus: string;
    currentStageIndex: number;
    releaseActor: 'AIOnly' | 'Human' | 'Hybrid';
    draftAgeBucket: '<1d' | '1-3d' | '3-7d' | '7+d';
    isAwaiting: boolean;
    latestGateState: 'Awaiting' | 'Approved' | 'Returned' | 'Refused';
    blendedCents: number;
    hasUnknownCost: boolean;
  }> = [];
  for (const m of missions) {
    const t = await getMissionTelemetry({
      missionId: m.id,
      userId: m.createdById,
      isAdmin: true,
    });
    if (!t) continue;
    const approvals = await prisma.approval.findMany({
      where: { missionId: m.id },
      orderBy: { at: 'desc' },
    });
    const last = approvals[0] ?? null;
    const latestGateState: 'Awaiting' | 'Approved' | 'Returned' | 'Refused' = !last
      ? 'Awaiting'
      : isApproveDecision(last.decision)
        ? 'Approved'
        : last.decision === 'Return'
          ? 'Returned'
          : 'Refused';
    rows.push({
      missionId: m.id,
      missionSlug: m.slug,
      missionName: m.name,
      missionStatus: m.status,
      currentStageIndex: m.currentStageIndex,
      releaseActor: t.autonomy.releaseActor,
      draftAgeBucket: t.autonomy.draftAge.bucket,
      isAwaiting: t.autonomy.draftAge.isAwaiting,
      latestGateState,
      blendedCents: t.cost.blendedCents,
      hasUnknownCost: t.cost.hasUnknownCost,
    });
  }
  return rows;
}

export async function getAdminTelemetryOverview(): Promise<{
  autonomyLadder: Array<{
    gateIndex: number;
    stage: StageName;
    approvedTotal: number;
    editedTotal: number;
    rejectedTotal: number;
    aiOnlyShare: number;
  }>;
  perCompanyCredit: Array<{ companyId: string; netCents: number; credits: number; debits: number }>;
  chatCostByDay: Array<{ day: string; cents: number; messages: number; hasUnknownCost: boolean }>;
}> {
  const [approvals, tags, creditLedger, chatRows] = await Promise.all([
    prisma.approval.findMany({}),
    prisma.approvalActorTag.findMany({}),
    prisma.creditLedgerEntry.findMany({}),
    prisma.chatUsageRecord.findMany({}),
  ]);
  const tagsByApproval = new Map<string, { actorKind: string }[]>();
  for (const t of tags) {
    const arr = tagsByApproval.get(t.approvalId) ?? [];
    arr.push({ actorKind: t.actorKind });
    tagsByApproval.set(t.approvalId, arr);
  }
  const perGateCounts = deriveGateCounts(
    approvals.map((a) => ({ gateIndex: a.gateIndex, decision: a.decision, id: a.id })),
    tagsByApproval,
    STAGE_BY_GATE,
  );
  const { adminOverview } = await import('./telemetry-service');
  const scan = adminOverview({
    perGateCounts,
    creditLedger: creditLedger.map((e) => ({ companyId: e.companyId, amountCents: e.amountCents })),
    chatRows: chatRows.map((r) => ({
      windowStartIso: r.windowStart.toISOString(),
      costCents: r.costCents,
      messageCount: r.messageCount,
      unknownCost: r.unknownCost,
    })),
  });
  return {
    autonomyLadder: scan.autonomyLadder.map((row) => ({
      gateIndex: row.gateIndex,
      stage: row.stage,
      approvedTotal: row.approvedTotal,
      editedTotal: row.editedTotal,
      rejectedTotal: row.rejectedTotal,
      aiOnlyShare: row.aiOnlyShare,
    })),
    perCompanyCredit: scan.perCompanyCredit,
    chatCostByDay: scan.chatCostByDay,
  };
}

// === Adoption & realised-value dashboard ====================================
// Real aggregates over every Mission/Objection row — no sample data, no
// seeded numbers. See adoption-metrics.ts for the pure computation.

export async function getAdoptionDashboard(): Promise<{
  adoption: ReturnType<typeof import('./adoption-metrics').computeAdoptionMetrics>;
  quality: ReturnType<typeof import('./adoption-metrics').computeQualityMetrics>;
}> {
  const { computeAdoptionMetrics, computeQualityMetrics } = await import('./adoption-metrics');
  const [missions, objections] = await Promise.all([
    prisma.mission.findMany({ select: { status: true, createdAt: true, completedAt: true } }),
    prisma.objection.findMany({ select: { resolution: true } }),
  ]);
  const adoption = computeAdoptionMetrics(
    missions.map((m) => ({
      status: m.status,
      createdAt: m.createdAt.toISOString(),
      completedAt: toIso(m.completedAt),
    })),
  );
  const quality = computeQualityMetrics(objections.map((o) => ({ resolution: o.resolution })));
  return { adoption, quality };
}
