// @polsia:user-owned — exhaustive enumeration of MissionStatus =>
// generated NextActionView kind. Pinned by the brief.
import { describe, expect, it } from 'vitest';
import {
  isMissionTerminal,
  nextActionBlockers,
  nextActionFor,
} from '@/lib/business/forge/next-action';
import type {
  ApprovalItemT,
  GateStateT,
  MissionStatus,
  ObjectionItemT,
  WorkItemReadT,
} from '@/lib/contracts/forge';

function approval(opts: Partial<ApprovalItemT> = {}): ApprovalItemT {
  return {
    id: 'a-1',
    gateIndex: 0,
    stageHandoffId: 'h-1',
    approverUserId: 'user-1',
    decision: 'Approve',
    controls: null,
    reasonCode: 'Approved',
    reasonText: 'ok',
    supersedesApprovalId: null,
    replayOfApprovalId: null,
    at: '2026-01-01T00:00:00.000Z',
    oracleRole: null,
    approverMatchedElder: false,
    attesterUserIds: [],
    ...opts,
  };
}

function objection(resolution: ObjectionItemT['resolution'] = null): ObjectionItemT {
  return {
    id: 'o-1',
    stageHandoffId: 'h-1',
    raisedByRole: 'Operator',
    text: 'Need more evidence',
    evidenceRefId: null,
    raisedAt: '2026-01-01T00:00:00.000Z',
    resolution,
    resolutionText: null,
  };
}

function gate(state: GateStateT['state'] = 'Awaiting', idx = 0): GateStateT {
  return {
    missionId: 'm-1',
    gateIndex: idx,
    stage: 'Discovery',
    state,
    currentStageHandoffId: 'h-1',
    currentHandoffVersion: 1,
    lastApprovalId: null,
    allowedReasonCodes: [],
  };
}

function workItem(status: WorkItemReadT['status'] = 'Open'): WorkItemReadT {
  return {
    id: 'wi-1',
    missionId: 'm-1',
    parentStageHandoffId: 'h-1',
    title: 'Item 1',
    scope: 'scope',
    acceptanceCriteria: 'AC',
    ownerUserId: null,
    status,
    openedAt: '2026-01-01T00:00:00.000Z',
    closedAt: null,
    testEvidenceRefIds: [],
    supersededById: null,
  };
}

describe('nextActionFor — terminal statuses', () => {
  it('returns Complete for Completed', () => {
    expect(
      nextActionFor({
        status: 'Completed',
        gates: [],
        approvals: [],
        objections: [],
        toolActions: [],
        workItems: [],
      }).kind,
    ).toBe('Complete');
    expect(isMissionTerminal('Completed')).toBe(true);
  });
  // Real bug found live (2026-09-05): Rejected and WalkedAway used to
  // collapse into the same 'Complete' kind as an actual success, so a
  // refused project's own next-action page said "This project is
  // complete... has been approved" — actively wrong. Each now gets its
  // own distinct 'Closed' status so the client can render the apology +
  // "rethink and come back" message the user's flow calls for, instead
  // of reusing completion copy.
  it.each(['WalkedAway', 'Rejected'] as MissionStatus[])(
    'returns Closed with the matching status for %s',
    (status) => {
      const view = nextActionFor({
        status,
        gates: [],
        approvals: [],
        objections: [],
        toolActions: [],
        workItems: [],
      });
      expect(view.kind).toBe('Closed');
      expect(view.kind === 'Closed' && view.status).toBe(status);
      expect(isMissionTerminal(status)).toBe(true);
    },
  );
  it.each([
    'Draft',
    'InDiscovery',
    'InReadiness',
    'InWorkflow',
    'InGovernance',
    'InBuild',
  ] as MissionStatus[])('isMissionTerminal returns false for %s', (status) => {
    expect(isMissionTerminal(status)).toBe(false);
  });
});

describe('nextActionFor — Paused / Replay paths', () => {
  it('Paused returns Resume', () => {
    expect(
      nextActionFor({
        status: 'Paused',
        gates: [],
        approvals: [],
        objections: [],
        toolActions: [],
        workItems: [],
      }).kind,
    ).toBe('Resume');
  });
  it('RolledBack returns Replay', () => {
    expect(
      nextActionFor({
        status: 'RolledBack',
        gates: [],
        approvals: [],
        objections: [],
        toolActions: [],
        workItems: [],
      }).kind,
    ).toBe('Replay');
  });
  it('Blocked returns Pause with a reason', () => {
    const r = nextActionFor({
      status: 'Blocked',
      gates: [],
      approvals: [],
      objections: [],
      toolActions: [],
      workItems: [],
    });
    expect(r.kind).toBe('Pause');
  });
});

describe('nextActionFor — outstanding objection priority', () => {
  it('returns ResolveObjection when there is an outstanding objection', () => {
    const r = nextActionFor({
      status: 'InDiscovery',
      gates: [gate('Awaiting')],
      approvals: [],
      objections: [objection(null)],
      toolActions: [],
      workItems: [],
    });
    expect(r.kind).toBe('ResolveObjection');
    if (r.kind === 'ResolveObjection') {
      expect(r.raisedByRole).toBe('Operator');
    }
  });
  it('skips resolved objections', () => {
    const r = nextActionFor({
      status: 'InDiscovery',
      gates: [gate('Awaiting', 0), { ...gate('Awaiting', 1), stage: 'Readiness' }],
      approvals: [],
      objections: [objection('OwnerResolved'), objection('Closed')],
      toolActions: [],
      workItems: [],
    });
    expect(r.kind).toBe('ApproveGate');
    // FIXED 2026-09-04: was asserting 'Readiness' — status InDiscovery with
    // gate 0 (Discovery) still Awaiting means gate 0 is what's actually
    // next, not gate 1's stage. See next-action.ts's pickNextGate comment.
    if (r.kind === 'ApproveGate') {
      expect(r.stage).toBe('Discovery');
    }
  });
});

describe('nextActionFor — outstanding tool action', () => {
  it('returns DecideToolAction when no objections and a pending tool action exists', () => {
    const r = nextActionFor({
      status: 'InDiscovery',
      gates: [gate('Awaiting')],
      approvals: [],
      objections: [],
      toolActions: [{ id: 'ta-1', decision: null, tool: 'noop-runner', scope: 'Internal' }],
      workItems: [],
    });
    expect(r.kind).toBe('DecideToolAction');
  });
});

describe('nextActionFor — in-flight work item priority', () => {
  it('returns ArrangeWorkItem when no other blockers and items are in-flight', () => {
    const r = nextActionFor({
      status: 'InWorkflow',
      gates: [gate('Approved', 2)],
      approvals: [approval()],
      objections: [],
      toolActions: [],
      workItems: [workItem('Open')],
    });
    expect(r.kind).toBe('ArrangeWorkItem');
  });
});

describe('nextActionFor — gate decision path', () => {
  it('returns ApproveGate when no objections, no pending tool, no in-flight items, but a handoff at gate', () => {
    const r = nextActionFor({
      status: 'AwaitingApproval',
      gates: [gate('Awaiting', 0)],
      approvals: [approval()],
      objections: [],
      toolActions: [],
      workItems: [],
    });
    expect(r.kind).toBe('ApproveGate');
  });
  it('returns Idle when there is nothing to decide', () => {
    const r = nextActionFor({
      status: 'InDiscovery',
      gates: [gate('Approved', 0)],
      approvals: [approval()],
      objections: [],
      toolActions: [],
      workItems: [workItem('Passed')],
    });
    expect(r.kind).toBe('Idle');
  });
  // Real dead end found live (2026-09-05, user's own flow: "ask for more
  // info - simple step I add more and then resubmit"): a Returned gate
  // used to fall through to Idle — "Nothing needs you right now", no
  // button — even though the reviewer's own feedback was sitting right
  // there on the Return approval. This is the fix: surface it as its
  // own actionable step instead, carrying that same reviewer feedback.
  it('returns ReviseStage with the reviewer feedback when the gate for this stage was Returned', () => {
    const r = nextActionFor({
      status: 'InDiscovery',
      gates: [gate('Returned', 0)],
      approvals: [approval({ decision: 'Return', reasonText: 'Add a rollout timeline.' })],
      objections: [],
      toolActions: [],
      workItems: [],
    });
    expect(r.kind).toBe('ReviseStage');
    expect(r.kind === 'ReviseStage' && r.rationale).toBe('Add a rollout timeline.');
    expect(r.kind === 'ReviseStage' && r.gateIndex).toBe(0);
  });
});

describe('nextActionBlockers', () => {
  it('lists outstanding objections + tool decisions + refused gates', () => {
    const blockers = nextActionBlockers({
      status: 'InDiscovery',
      gates: [gate('Refused', 0)],
      approvals: [],
      objections: [objection(null)],
      toolActions: [{ id: 'ta-1', decision: null, tool: 'noop', scope: 'Internal' }],
      workItems: [],
    });
    expect(blockers.length).toBeGreaterThanOrEqual(2);
    expect(blockers.some((b) => /unresolved/i.test(b))).toBe(true);
    expect(blockers.some((b) => /refused/i.test(b))).toBe(true);
  });
  // Real dead end found live (2026-09-05): a 'Returned' gate used to be
  // listed here as a generic "blocker" alongside whatever the real next
  // action was. It's excluded now because nextActionFor surfaces it
  // directly as its own 'ReviseStage' action — repeating it here would
  // just restate the same fact in a more confusing shape.
  it('does not list a Returned gate as a blocker — it is the next action itself', () => {
    const blockers = nextActionBlockers({
      status: 'InDiscovery',
      gates: [gate('Returned', 0)],
      approvals: [],
      objections: [],
      toolActions: [],
      workItems: [],
    });
    expect(blockers).toEqual([]);
  });
  it('returns empty list when everything is clean', () => {
    const blockers = nextActionBlockers({
      status: 'InDiscovery',
      gates: [gate('Awaiting')],
      approvals: [],
      objections: [],
      toolActions: [],
      workItems: [],
    });
    expect(blockers).toEqual([]);
  });
});
