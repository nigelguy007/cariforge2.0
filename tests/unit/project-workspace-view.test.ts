// @polsia:user-owned — the single project view model must be derived only
// from data already on the mission (never invented), keep step numbers
// one-based, and never leak a raw reason code into the prepared summary.
import { describe, expect, it } from 'vitest';
import { buildProjectWorkspaceView } from '@/components/custom/app/use-project-workspace';
import {
  type ApprovalItemT,
  type GateStateT,
  type HandoffItemT,
  MissionDetail,
  type MissionDetailT,
  type NextActionResponseT,
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
    payload: { summary: 'Automate invoice matching for the finance team.' },
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

const approveGate: NextActionResponseT = {
  view: {
    kind: 'ApproveGate',
    gateIndex: 0,
    stage: 'Discovery',
    title: 'Approve Gate 0',
    rationale: 'Discovery handoff v1 awaits approval.',
  },
  blockers: [],
  isTerminal: false,
};

const idle: NextActionResponseT = {
  view: { kind: 'Idle', title: 'Nothing to do' },
  blockers: [],
  isTerminal: false,
};

describe('buildProjectWorkspaceView', () => {
  it('maps the zero-based stage index to a one-based step and marks approved steps complete', () => {
    const d = detail({
      mission: { ...detail().mission, currentStageIndex: 2, status: 'InWorkflow' },
      gates: [
        gate(0, { state: 'Approved' }),
        gate(1, { state: 'Approved' }),
        gate(2),
        gate(3),
        gate(4),
      ],
    });
    // Real bug fix (2026-09-05): currentGate now comes from the
    // server-computed next action (nextAction.view.gateIndex), not from
    // mission.currentStageIndex — that field advances the moment a
    // handoff is SUBMITTED, before its gate is actually decided, and used
    // to let currentGate silently point at a not-yet-drafted gate ahead
    // of the real one. This scenario's actual awaiting gate is 2
    // (Workflow) — gates 0 and 1 are already Approved above.
    const view = buildProjectWorkspaceView(d, {
      view: {
        kind: 'ApproveGate',
        gateIndex: 2,
        stage: 'Workflow',
        title: 'Approve Gate 2',
        rationale: 'Workflow handoff v1 awaits approval.',
      },
      blockers: [],
      isTerminal: false,
    });
    expect(view.currentStep.number).toBe(3);
    expect(view.currentStep.title).toBe('Design the workflow');
    expect(view.completedSteps).toEqual([1, 2]);
    expect(view.currentGate?.gateIndex).toBe(2);
  });

  it('uses only facts already on the project for the prepared summary, at most three', () => {
    const d = detail({
      handoffs: [handoff()],
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
      ],
      evidence: [
        {
          id: 'e1',
          attachedToStageHandoffId: 'h1',
          kind: 'Text',
          ref: 'x',
          label: 'Finance interview',
          capturedAt: T1,
          capturedById: 'u1',
        },
      ],
    });
    const view = buildProjectWorkspaceView(d, approveGate);
    expect(view.summaryItems.length).toBeLessThanOrEqual(3);
    expect(view.summaryItems[0]).toEqual({
      label: 'The need',
      value: 'We spend hours matching invoices to purchase orders.',
    });
    expect(view.summaryItems[1]?.label).toBe('Define the need — step output');
    expect(view.summaryItems[1]?.value).toContain('Automate invoice matching');
    expect(view.summaryItems[1]?.value).toContain('82% confidence');
    expect(view.summaryItems[2]).toEqual({ label: 'To be aware of', value: '1 open concern' });
    const joined = JSON.stringify(view.summaryItems);
    expect(joined).not.toMatch(/EvidenceRequested|ScopeMismatch|Gate \d|Stage \d/);
  });

  it('summarises council, evidence and the decision record from real counts', () => {
    const d = detail({
      handoffs: [handoff()],
      approvals: [approval()],
      objections: [
        {
          id: 'o1',
          stageHandoffId: 'h1',
          raisedByRole: 'Money',
          text: 'Budget',
          evidenceRefId: null,
          raisedAt: T1,
          resolution: 'CarriedForward',
          resolutionText: 'Carry to readiness',
        },
      ],
      evidence: [
        {
          id: 'e1',
          attachedToStageHandoffId: 'h1',
          kind: 'Url',
          ref: 'https://example.test',
          label: 'Source',
          capturedAt: T1,
          capturedById: 'u1',
        },
      ],
      handoffAttesters: [
        { id: 't1', handoffId: 'h1', userId: 'u2', role: 'Risk', signedAt: T1 },
        { id: 't2', handoffId: 'other', userId: 'u3', role: 'Money', signedAt: T1 },
      ],
    });
    const view = buildProjectWorkspaceView(d, idle);
    expect(view.councilSummary).toEqual({
      reviewsComplete: 1,
      seats: 0,
      concernsOpen: 0,
      concernsCarried: 1,
    });
    expect(view.evidenceSummary).toEqual({ count: 1, latestAt: T1 });
    expect(view.decisionSummary).toEqual({ count: 1, latestAt: T2, state: 'Up to date' });
    expect(view.savedAt).toBe(T2);
  });

  it('reports the decision record as waiting when the next action is an approval', () => {
    const view = buildProjectWorkspaceView(detail({ handoffs: [handoff()] }), approveGate);
    expect(view.decisionSummary.state).toBe('Waiting for your decision');
    expect(buildProjectWorkspaceView(detail(), idle).decisionSummary.state).toBe(
      'No decisions yet',
    );
  });

  it('prefers the latest non-superseded step output', () => {
    const d = detail({
      handoffs: [
        handoff({ id: 'h2', version: 2, parentVersionId: 'h1', createdAt: T2 }),
        handoff({ id: 'h1', supersededById: 'h2' }),
      ],
    });
    expect(buildProjectWorkspaceView(d, idle).latestHandoff?.id).toBe('h2');
  });
});
