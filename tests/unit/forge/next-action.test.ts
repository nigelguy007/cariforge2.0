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
  it.each(['Completed', 'WalkedAway', 'Rejected'] as MissionStatus[])(
    'returns Complete for %s',
    (status) => {
      expect(
        nextActionFor({
          status,
          gates: [],
          approvals: [],
          objections: [],
          toolActions: [],
          workItems: [],
        }).kind,
      ).toBe('Complete');
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
    if (r.kind === 'ApproveGate') {
      expect(r.stage).toBe('Readiness');
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
});

describe('nextActionBlockers', () => {
  it('lists outstanding objections + tool decisions + paused gates', () => {
    const blockers = nextActionBlockers({
      status: 'InDiscovery',
      gates: [gate('Returned', 0)],
      approvals: [],
      objections: [objection(null)],
      toolActions: [{ id: 'ta-1', decision: null, tool: 'noop', scope: 'Internal' }],
      workItems: [],
    });
    expect(blockers.length).toBeGreaterThanOrEqual(2);
    expect(blockers.some((b) => /unresolved/i.test(b))).toBe(true);
    expect(blockers.some((b) => /Returned or Refused/i.test(b))).toBe(true);
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
