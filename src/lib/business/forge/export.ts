// @polsia:user-owned — pure evidence-trail serialiser for /api/forge/*/export.
// No DB. Produces a deterministic JSON envelope used by both the JSON and
// the CSV response paths.

import type {
  ApprovalItemT,
  EvidenceItemReadT,
  HandoffItemT,
  MissionAuditItemT,
  MissionDetailT,
  ObjectionItemT,
  ToolActionItemT,
} from '@/lib/contracts/forge';

export interface EvidenceTrail {
  readonly generatedAt: string;
  readonly schemaVersion: string;
  readonly mission: MissionDetailT['mission'];
  readonly handoffs: readonly HandoffItemT[];
  readonly approvals: readonly ApprovalItemT[];
  readonly objections: readonly ObjectionItemT[];
  readonly evidence: readonly EvidenceItemReadT[];
  readonly toolActions: readonly ToolActionItemT[];
  readonly audits: readonly MissionAuditItemT[];
}

export function buildEvidenceTrail(view: MissionDetailT): EvidenceTrail {
  return {
    generatedAt: new Date().toISOString(),
    schemaVersion: 'forge-evidence-trail/v1',
    mission: view.mission,
    handoffs: view.handoffs,
    approvals: view.approvals,
    objections: view.objections,
    evidence: view.evidence,
    toolActions: view.toolActions,
    audits: view.audits,
  };
}

const CSV_HEADER = [
  'artifact',
  'id',
  'parentId',
  'stage',
  'version',
  'role',
  'event',
  'decision',
  'reasonCode',
  'reasonText',
  'approver',
  'occurredAt',
  'detail',
];

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  const s = typeof value === 'string' ? value : JSON.stringify(value);
  if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function evidenceTrailToCsv(trail: EvidenceTrail): string {
  const rows: string[] = [];
  rows.push(CSV_HEADER.join(','));
  for (const h of trail.handoffs) {
    rows.push(
      [
        'handoff',
        h.id,
        h.parentVersionId ?? '',
        h.stage,
        String(h.version),
        '',
        'created',
        '',
        '',
        '',
        h.createdById,
        h.createdAt,
        csvCell(h.payload),
      ]
        .map(csvCell)
        .join(','),
    );
  }
  for (const a of trail.approvals) {
    rows.push(
      [
        'approval',
        a.id,
        a.stageHandoffId,
        '',
        '',
        '',
        'gate_decision',
        a.decision,
        a.reasonCode,
        a.reasonText,
        a.approverUserId ?? '',
        a.at,
        '',
      ]
        .map(csvCell)
        .join(','),
    );
  }
  for (const o of trail.objections) {
    rows.push(
      [
        'objection',
        o.id,
        o.stageHandoffId,
        '',
        '',
        o.raisedByRole,
        'raised',
        '',
        o.resolution ?? '',
        o.resolutionText ?? '',
        '',
        o.raisedAt,
        o.text,
      ]
        .map(csvCell)
        .join(','),
    );
  }
  for (const e of trail.evidence) {
    rows.push(
      [
        'evidence',
        e.id,
        e.attachedToStageHandoffId ?? '',
        '',
        '',
        '',
        'evidence_captured',
        '',
        e.kind,
        e.label,
        e.capturedById,
        e.capturedAt,
        e.ref,
      ]
        .map(csvCell)
        .join(','),
    );
  }
  for (const t of trail.toolActions) {
    rows.push(
      [
        'tool_action',
        t.id,
        t.rollbackOfToolActionId ?? '',
        '',
        '',
        '',
        t.executedAt ? 'executed' : t.decision ? 'decided' : 'proposed',
        t.decision ?? '',
        t.decisionReasonCode ?? '',
        '',
        t.decidedById ?? '',
        t.executedAt ?? t.decidedAt ?? t.rejectedAt ?? '',
        csvCell(t.payload),
      ]
        .map(csvCell)
        .join(','),
    );
  }
  for (const audit of trail.audits) {
    rows.push(
      [
        'audit',
        audit.id,
        '',
        '',
        '',
        '',
        audit.event,
        '',
        '',
        '',
        audit.actorId ?? '',
        audit.at,
        csvCell(audit.payload),
      ]
        .map(csvCell)
        .join(','),
    );
  }
  return `${rows.join('\n')}\n`;
}
