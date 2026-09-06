// @polsia:user-owned — buildEvidenceView must translate every internal enum
// at the edge (no raw reason codes, no DB event names), never invent a
// fact, and cap measures at three. evidenceViewToDocumentSpec must carry
// the same content into the PDF export without a schema of its own.
import { describe, expect, it } from 'vitest';
import {
  buildEvidenceView,
  evidenceIndexLine,
  evidenceViewToDocumentSpec,
} from '@/components/custom/app/evidence-view';
import {
  type ApprovalItemT,
  type GateStateT,
  type HandoffItemT,
  MissionDetail,
  type MissionDetailT,
  StageNameValues,
} from '@/lib/contracts/forge';

const T0 = '2026-09-01T10:00:00.000Z';
const T1 = '2026-09-02T10:00:00.000Z';
const T2 = '2026-09-03T10:00:00.000Z';

function handoff(over: Partial<HandoffItemT> = {}): HandoffItemT {
  return {
    id: 'h1',
    stage: 'Discovery',
    version: 1,
    parentVersionId: null,
    correctionOfId: null,
    supersededById: null,
    replayOfMissionId: null,
    invalidationReasonCode: null,
    confidence: 0.82,
    gateIndexThatApproves: 0,
    payload: { problemStatement: 'Invoices are matched by hand.' },
    missingEvidence: [],
    toolRefs: [],
    producedByToolActionId: null,
    createdById: 'u1',
    createdAt: T1,
    ...over,
  };
}

function gate(index: number, over: Partial<GateStateT> = {}): GateStateT {
  return {
    missionId: 'm1',
    gateIndex: index,
    stage: StageNameValues[index] ?? 'Discovery',
    state: 'Awaiting',
    currentStageHandoffId: null,
    currentHandoffVersion: null,
    lastApprovalId: null,
    allowedReasonCodes: ['Approved', 'EvidenceRequested', 'ScopeMismatch'],
    ...over,
  };
}

function approval(over: Partial<ApprovalItemT> = {}): ApprovalItemT {
  return {
    id: 'a1',
    gateIndex: 0,
    stageHandoffId: 'h1',
    approverUserId: 'u1',
    approverName: 'Nia',
    decision: 'Approve',
    controls: null,
    reasonCode: 'Approved',
    reasonText: 'Need is clear.',
    supersedesApprovalId: null,
    replayOfApprovalId: null,
    at: T2,
    oracleRole: null,
    approverMatchedElder: false,
    attesterUserIds: [],
    ...over,
  };
}

function detail(over: Partial<MissionDetailT> = {}): MissionDetailT {
  return MissionDetail.parse({
    mission: {
      id: 'm1',
      slug: 'invoice-matching',
      name: 'Invoice matching',
      status: 'InDiscovery',
      currentStageIndex: 0,
      confidence: 0.8,
      createdAt: T0,
      updatedAt: T0,
      domainTags: [],
      elderOracleUserId: null,
      intake: 'We spend hours matching invoices to purchase orders.',
      normalizedNeed: '',
      currentDraftVersion: 1,
      pausedAt: null,
      completedAt: null,
      rolledBackAt: null,
      previousStatus: null,
      createdById: 'u1',
    },
    handoffs: [],
    approvals: [],
    objections: [],
    evidence: [],
    toolActions: [],
    audits: [],
    gates: [gate(0), gate(1), gate(2), gate(3), gate(4)],
    workItems: [],
    oracleRoster: [],
    handoffAttesters: [],
    ...over,
  });
}

describe('buildEvidenceView', () => {
  it('reports decision coverage against every step, capped at three measures', () => {
    const d = detail({
      gates: [
        gate(0, { state: 'Approved' }),
        gate(1, { state: 'Approved' }),
        gate(2),
        gate(3),
        gate(4),
      ],
      mission: { ...detail().mission, currentStageIndex: 2 },
    });
    const view = buildEvidenceView(d);
    expect(view.measures).toHaveLength(3);
    expect(view.measures[0]).toEqual(
      expect.objectContaining({ label: 'Decision coverage', value: '2 of 5' }),
    );
  });

  it('marks checks passed as "—" when no work items exist yet, not a fabricated ratio', () => {
    const view = buildEvidenceView(detail());
    expect(view.measures[1]).toEqual(
      expect.objectContaining({ label: 'Checks passed', value: '—' }),
    );
  });

  it('counts only genuinely unresolved concerns, distinguishing carried-forward', () => {
    const d = detail({
      objections: [
        {
          id: 'o1',
          stageHandoffId: 'h1',
          raisedByRole: 'Risk',
          text: 'Data access unclear',
          evidenceRefId: null,
          raisedAt: T1,
          resolution: null,
          resolutionText: null,
        },
        {
          id: 'o2',
          stageHandoffId: 'h1',
          raisedByRole: 'Money',
          text: 'Budget',
          evidenceRefId: null,
          raisedAt: T1,
          resolution: 'CarriedForward',
          resolutionText: 'Carry to readiness',
        },
      ],
    });
    const view = buildEvidenceView(d);
    expect(view.measures[2]).toEqual(
      expect.objectContaining({ label: 'Unresolved concerns', value: '1' }),
    );
    expect(view.measures[2]?.detail).toContain('carried forward');
  });

  it('answers "why" from the real intake and, when present, the Discovery problem statement', () => {
    const view = buildEvidenceView(detail({ handoffs: [handoff()] }));
    const why = view.questions.find((q) => q.key === 'why');
    expect(why?.facts[0]).toEqual(
      expect.objectContaining({
        label: 'The need, as stated',
        value: 'We spend hours matching invoices to purchase orders.',
      }),
    );
    expect(why?.facts.some((f) => f.value.includes('Invoices are matched by hand'))).toBe(true);
  });

  it('answers "who" in plain language — a raw reason code never leaks through untranslated', () => {
    const view = buildEvidenceView(
      detail({
        handoffs: [handoff()],
        approvals: [approval({ decision: 'Return', reasonCode: 'EvidenceRequested' })],
      }),
    );
    const who = view.questions.find((q) => q.key === 'who');
    expect(who?.facts).toHaveLength(1);
    const joined = JSON.stringify(who?.facts);
    expect(joined).not.toContain('EvidenceRequested');
    expect(joined).toContain('More information needed');
    expect(joined).toContain('Ask for changes');
    expect(joined).toContain('Nia');
    expect(joined).toContain('Step 1');
  });

  it('answers "what changed" with plain labels, never a raw audit event name', () => {
    const view = buildEvidenceView(
      detail({
        audits: [
          {
            id: 'ev1',
            event: 'GateApproved',
            payload: {},
            at: T2,
            actorId: 'u1',
            missionVersionAtEvent: 1,
          },
        ],
      }),
    );
    const changed = view.questions.find((q) => q.key === 'changed');
    expect(changed?.facts[0]?.label).toBe('Step approved');
    expect(JSON.stringify(changed?.facts)).not.toContain('GateApproved');
  });

  it('gives every fact a unique id even when several share a label (React key safety)', () => {
    // Two audit rows of the same event type render the identical label
    // ("Step approved") — a real, common case, not an edge case. The id
    // must still be unique or React silently drops/reuses list items.
    const changedView = buildEvidenceView(
      detail({
        audits: [
          {
            id: 'ev1',
            event: 'GateApproved',
            payload: {},
            at: T1,
            actorId: 'u1',
            missionVersionAtEvent: 1,
          },
          {
            id: 'ev2',
            event: 'GateApproved',
            payload: {},
            at: T2,
            actorId: 'u1',
            missionVersionAtEvent: 2,
          },
        ],
      }),
    );
    const changedFacts = changedView.questions.find((q) => q.key === 'changed')?.facts ?? [];
    expect(changedFacts.map((f) => f.label)).toEqual(['Step approved', 'Step approved']);
    expect(new Set(changedFacts.map((f) => f.id)).size).toBe(changedFacts.length);

    // Two current (non-superseded) ApproveWithControls decisions at the
    // same step likewise share a label ("Conditions set at Step N").
    const mayDoView = buildEvidenceView(
      detail({
        handoffs: [handoff()],
        approvals: [
          approval({
            id: 'a1',
            decision: 'ApproveWithControls',
            controls: 'Read-only for now',
            at: T1,
          }),
          approval({
            id: 'a2',
            decision: 'ApproveWithControls',
            controls: 'Read-only, escalate weekly',
            at: T2,
          }),
        ],
      }),
    );
    const mayDoFacts = mayDoView.questions.find((q) => q.key === 'may-do')?.facts ?? [];
    const conditionFacts = mayDoFacts.filter((f) => f.label.startsWith('Conditions set at'));
    expect(conditionFacts).toHaveLength(2);
    expect(new Set(mayDoFacts.map((f) => f.id)).size).toBe(mayDoFacts.length);
  });

  it('excludes a superseded ApproveWithControls decision from "what may the prototype do"', () => {
    const view = buildEvidenceView(
      detail({
        handoffs: [handoff()],
        approvals: [
          approval({
            id: 'a1',
            decision: 'ApproveWithControls',
            controls: 'Old conditions',
            supersedesApprovalId: null,
          }),
          approval({
            id: 'a2',
            decision: 'ApproveWithControls',
            controls: 'New conditions',
            supersedesApprovalId: 'a1',
          }),
        ],
      }),
    );
    const facts = view.questions.find((q) => q.key === 'may-do')?.facts ?? [];
    const values = facts.map((f) => f.value);
    expect(values).toContain('New conditions');
    expect(values).not.toContain('Old conditions');
  });

  it('says plainly when a question has nothing recorded yet, instead of an empty list', () => {
    const view = buildEvidenceView(detail());
    const who = view.questions.find((q) => q.key === 'who');
    expect(who?.facts).toHaveLength(0);
    expect(who?.empty).toMatch(/no decisions/i);
  });
});

describe('evidenceIndexLine', () => {
  it('names the current step in plain language, one-based', () => {
    expect(evidenceIndexLine(0)).toBe('At Step 1, define the need');
  });
});

describe('evidenceViewToDocumentSpec', () => {
  it('carries every measure and question into the PDF meta rows', () => {
    const view = buildEvidenceView(detail({ handoffs: [handoff()], approvals: [approval()] }));
    const spec = evidenceViewToDocumentSpec(view);
    expect(spec.title).toBe('Invoice matching');
    expect(spec.meta).toHaveLength(view.measures.length + view.questions.length);
    expect(spec.meta?.map((m) => m.label)).toEqual(
      expect.arrayContaining(['Decision coverage', 'Why does this project exist?']),
    );
  });

  // Real user report (2026-09-05): "it says the project is completed but
  // i dont see any build or solution .. just a plan, nothing at all ...
  // im confused and not happy" — the exported PDF's closing note (and the
  // "Production boundary" fact inside "What may the solution do?") used
  // to unconditionally claim "This is an approved, finished, ready-to-use
  // solution package", even for a mission still at Step 1 with open
  // concerns. This mission's own evidence record showed exactly that:
  // decision coverage 4 of 5, 3 unresolved concerns, and this note still
  // read as if it were done.
  it('never claims completion for a mission still in progress', () => {
    const view = buildEvidenceView(detail()); // status: 'InDiscovery', the default
    expect(view.isComplete).toBe(false);
    const spec = evidenceViewToDocumentSpec(view);
    expect(spec.notes).not.toContain('approved, finished, ready-to-use');
    expect(spec.notes).toContain('not been approved yet');
    const mayDo = view.questions.find((q) => q.key === 'may-do');
    const boundary = mayDo?.facts.find((f) => f.id === 'production-boundary');
    expect(boundary?.value).not.toContain('approved, finished, ready-to-use');
  });

  it('states completion plainly once the mission has actually finished', () => {
    const view = buildEvidenceView(
      detail({ mission: { ...detail().mission, status: 'Completed' } }),
    );
    expect(view.isComplete).toBe(true);
    const spec = evidenceViewToDocumentSpec(view);
    // "approved, finished, ready-to-use" -> "approved, production-ready
    // MVP" (2026-09-06, direct user correction: "state an mvp will be
    // created").
    expect(spec.notes).toContain('approved, production-ready MVP');
    expect(spec.notes).toContain('not a production deployment');
    const mayDo = view.questions.find((q) => q.key === 'may-do');
    const boundary = mayDo?.facts.find((f) => f.id === 'production-boundary');
    expect(boundary?.value).toContain('approved, production-ready MVP');
  });
});
