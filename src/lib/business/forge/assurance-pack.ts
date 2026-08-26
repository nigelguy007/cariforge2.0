// @polsia:user-owned — assembles the assurance pack (Section 8 of the Aug
// 2026 enterprise-platform handoff doc: "Each build should generate a
// standard assurance pack") from a mission's REAL, already-persisted data —
// no server-only imports here on purpose: this is pure assembly + a real
// SHA-256 hash chain computed over the mission's actual MissionAudit rows,
// so it's unit-testable without a DB and importable from both the API route
// and (if ever needed) a client preview.
//
// Every field below traces to a real column on a real row. Where the
// handoff doc's spec names something this schema genuinely has no field
// for (representative test cases, known failure modes and mitigations, a
// formal security/privacy/data-retention assessment), the pack says so
// explicitly via `notCaptured` rather than inventing content — an empty
// truthful field beats a populated false one.

import type { MissionDetailT } from '@/lib/contracts/forge';
import { GATE_DEFS } from '@/lib/contracts/forge';

export interface AssurancePackApproval {
  gateIndex: number;
  gateName: string;
  approverUserId: string | null;
  decision: string;
  reasonCode: string;
  reasonText: string;
  controls: string | null;
  at: string;
}

export interface AssurancePackAuditEntry {
  id: string;
  event: string;
  at: string;
  actorId: string | null;
  /** SHA-256 of this entry's own content, chained with the previous entry's hash. */
  hash: string;
  previousHash: string | null;
}

export interface AssurancePack {
  generatedAt: string;
  mission: {
    id: string;
    slug: string;
    name: string;
    status: string;
    createdAt: string;
    completedAt: string | null;
  };
  // "Named workflow owner and accountable decision-maker" — the mission's
  // creator is the only real, always-present candidate for this in the
  // current schema; the Elder Oracle (when assigned) is the accountable
  // ruling authority for contested objections.
  workflowOwnerUserId: string;
  elderOracleUserId: string | null;
  // "Approved use case" — the mission's own intake, verbatim.
  approvedUseCase: string;
  // "Data-source register and access permissions" — this schema has no
  // dedicated field for this; the closest real artefact is the Readiness
  // stage's own handoff payload, surfaced as-is rather than reformatted
  // into a register this system doesn't actually maintain.
  readinessHandoffPayload: Record<string, unknown> | null;
  // "Agent and tool permission matrix" — the five real gates and what each
  // one confirms, straight from GATE_DEFS.
  gateDefinitions: ReadonlyArray<{
    gateIndex: number;
    stage: string;
    name: string;
    purpose: string;
  }>;
  // "Human approval and escalation map" — every real Approval row.
  approvals: AssurancePackApproval[];
  // "Edge cases, known failure modes and mitigations" — real Objection
  // rows are the closest honest analogue (a human or Oracle actually
  // raised a concern), not a fabricated risk register.
  objections: ReadonlyArray<{
    raisedByRole: string;
    text: string;
    resolution: string | null;
    resolutionText: string | null;
    raisedAt: string;
  }>;
  // "Representative test cases and expected outcomes" — not a field this
  // schema captures anywhere. Said plainly rather than invented.
  representativeTestCases: { notCaptured: true; reason: string };
  // "Security, privacy and data-retention assessment" — same: no per-
  // mission field exists for this.
  securityPrivacyAssessment: { notCaptured: true; reason: string };
  // "Audit logs and release evidence" — the real MissionAudit trail, with
  // a hash chain computed HERE over the real rows (not read from a stored
  // hash column — this schema doesn't have one; the chain is genuinely
  // computed at generation time, so the property is real for this pack).
  auditTrail: AssurancePackAuditEntry[];
  // "Stop, improve, pilot or production recommendation" — derived from the
  // mission's own real status, not a separate recommendation field.
  recommendation: 'Completed' | 'InProgress' | 'WalkedAway' | 'RolledBack' | 'Blocked' | 'Rejected';
}

const NOT_CAPTURED_TEST_CASES = {
  notCaptured: true as const,
  reason:
    'This schema has no field for representative test cases or expected outcomes attached to a mission — this pack reports the fact rather than inventing examples.',
};
const NOT_CAPTURED_SECURITY = {
  notCaptured: true as const,
  reason:
    'This schema has no per-mission security/privacy/data-retention assessment field — a real assessment for this case would need to be produced separately, not fabricated here.',
};

function recommendationFromStatus(status: string): AssurancePack['recommendation'] {
  if (status === 'Completed') return 'Completed';
  if (status === 'WalkedAway') return 'WalkedAway';
  if (status === 'RolledBack') return 'RolledBack';
  if (status === 'Blocked') return 'Blocked';
  if (status === 'Rejected') return 'Rejected';
  return 'InProgress';
}

async function sha256Hex(input: string): Promise<string> {
  // Web Crypto's subtle.digest — available in both the Node.js runtime
  // (Next.js route handlers) and the browser, no extra dependency.
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function computeAuditHashChain(
  audits: MissionDetailT['audits'],
): Promise<AssurancePackAuditEntry[]> {
  // audits arrive newest-first (service.ts orders by { at: 'desc' }) — the
  // chain must be computed oldest-first so "previous" means chronologically
  // prior, then the result is reversed back to newest-first for display.
  const chronological = [...audits].sort((a, b) => a.at.localeCompare(b.at));
  const chained: AssurancePackAuditEntry[] = [];
  let previousHash: string | null = null;
  for (const entry of chronological) {
    const content = JSON.stringify({
      id: entry.id,
      event: entry.event,
      payload: entry.payload,
      at: entry.at,
      actorId: entry.actorId,
      previousHash,
    });
    const hash = await sha256Hex(content);
    chained.push({
      id: entry.id,
      event: entry.event,
      at: entry.at,
      actorId: entry.actorId,
      hash,
      previousHash,
    });
    previousHash = hash;
  }
  return chained.reverse(); // back to newest-first, matching the rest of this pack's convention
}

export async function buildAssurancePack(detail: MissionDetailT): Promise<AssurancePack> {
  const readinessHandoff =
    detail.handoffs.find((h) => h.stage === 'Readiness') ??
    detail.handoffs.find((h) => h.stage === 'Discovery') ??
    null;

  const approvals: AssurancePackApproval[] = detail.approvals.map((a) => ({
    gateIndex: a.gateIndex,
    gateName: GATE_DEFS[a.gateIndex]?.name ?? `Gate ${a.gateIndex}`,
    approverUserId: a.approverUserId,
    decision: a.decision,
    reasonCode: a.reasonCode,
    reasonText: a.reasonText,
    controls: a.controls,
    at: a.at,
  }));

  return {
    generatedAt: new Date().toISOString(),
    mission: {
      id: detail.mission.id,
      slug: detail.mission.slug,
      name: detail.mission.name,
      status: detail.mission.status,
      createdAt: detail.mission.createdAt,
      completedAt: detail.mission.completedAt,
    },
    workflowOwnerUserId: detail.mission.createdById,
    elderOracleUserId: detail.mission.elderOracleUserId,
    approvedUseCase: detail.mission.intake,
    readinessHandoffPayload: readinessHandoff?.payload ?? null,
    gateDefinitions: GATE_DEFS.map((g) => ({
      gateIndex: g.id,
      stage: g.stage,
      name: g.name,
      purpose: g.purpose,
    })),
    approvals,
    objections: detail.objections.map((o) => ({
      raisedByRole: o.raisedByRole,
      text: o.text,
      resolution: o.resolution,
      resolutionText: o.resolutionText,
      raisedAt: o.raisedAt,
    })),
    representativeTestCases: NOT_CAPTURED_TEST_CASES,
    securityPrivacyAssessment: NOT_CAPTURED_SECURITY,
    auditTrail: await computeAuditHashChain(detail.audits),
    recommendation: recommendationFromStatus(detail.mission.status),
  };
}
