// @polsia:user-owned — release derivation tests.
import { describe, expect, it } from 'vitest';
import {
  blueprintFromHandoffs,
  deriveReleaseStatus,
  runbookFromHandoffs,
} from '@/lib/business/forge/release';
import type { ApprovalItemT, HandoffItemT } from '@/lib/contracts/forge';

function approval(decision: ApprovalItemT['decision'] = 'Approve'): ApprovalItemT {
  return {
    id: 'a-1',
    gateIndex: 4,
    stageHandoffId: 'h-build-1',
    approverUserId: 'user-1',
    decision,
    controls: null,
    reasonCode: 'Approved',
    reasonText: 'Looks good.',
    supersedesApprovalId: null,
    replayOfApprovalId: null,
    at: '2026-05-01T00:00:00.000Z',
    oracleRole: 'BuildOracle',
    approverMatchedElder: false,
    attesterUserIds: [],
  };
}

function handoff(
  stage: HandoffItemT['stage'],
  version: number,
  payload: Record<string, unknown> = {},
): HandoffItemT {
  return {
    id: `h-${stage}-v${version}`,
    stage,
    version,
    parentVersionId: null,
    correctionOfId: null,
    supersededById: null,
    replayOfMissionId: null,
    invalidationReasonCode: null,
    confidence: 0.8,
    gateIndexThatApproves: 0,
    payload,
    missingEvidence: [],
    toolRefs: [],
    producedByToolActionId: null,
    createdById: 'user-1',
    createdAt: '2026-04-01T00:00:00.000Z',
  };
}

describe('deriveReleaseStatus', () => {
  it('Completed without readout => BuildApprovedNotReleased', () => {
    expect(
      deriveReleaseStatus({
        status: 'Completed',
        completedAt: '2026-05-01T00:00:00.000Z',
        releaseReadoutAt: null,
        lastApproval: approval(),
      }),
    ).toBe('BuildApprovedNotReleased');
  });
  it('Completed with readout => Released', () => {
    expect(
      deriveReleaseStatus({
        status: 'Completed',
        completedAt: '2026-05-01T00:00:00.000Z',
        releaseReadoutAt: '2026-05-10T00:00:00.000Z',
        lastApproval: approval(),
      }),
    ).toBe('Released');
  });
  it('Paused => Paused', () => {
    expect(
      deriveReleaseStatus({
        status: 'Paused',
        completedAt: null,
        releaseReadoutAt: null,
        lastApproval: null,
      }),
    ).toBe('Paused');
  });
  it('Blocked => Blocked', () => {
    expect(
      deriveReleaseStatus({
        status: 'Blocked',
        completedAt: null,
        releaseReadoutAt: null,
        lastApproval: null,
      }),
    ).toBe('Blocked');
  });
  it('RolledBack => RolledBack', () => {
    expect(
      deriveReleaseStatus({
        status: 'RolledBack',
        completedAt: null,
        releaseReadoutAt: null,
        lastApproval: null,
      }),
    ).toBe('RolledBack');
  });
  it('WalkedAway => WalkedAway', () => {
    expect(
      deriveReleaseStatus({
        status: 'WalkedAway',
        completedAt: null,
        releaseReadoutAt: null,
        lastApproval: null,
      }),
    ).toBe('WalkedAway');
  });
  it('InBuild => InProgress', () => {
    expect(
      deriveReleaseStatus({
        status: 'InBuild',
        completedAt: null,
        releaseReadoutAt: null,
        lastApproval: approval(),
      }),
    ).toBe('InProgress');
  });
});

describe('blueprintFromHandoffs', () => {
  it('builds blocks from non-build stages and a softwarebuild block', () => {
    const result = blueprintFromHandoffs({
      mission: { id: 'm-1', name: 'Mission 1', releaseReadoutAt: null },
      handoffs: [
        handoff('Discovery', 1, { need: 'replace CRM' }),
        handoff('Readiness', 1, { constraints: 'budget cap' }),
        handoff('SoftwareBuild', 3, { route: '/crm/queue-3' }),
      ],
    });
    expect(result.blocks.length).toBe(3); // Discovery + Readiness + SoftwareBuild
    expect(result.title).toContain('Mission 1');
    expect(result.summary.length).toBeGreaterThan(0);
  });
  it('marks reuse signal when a build handoff is present', () => {
    const result = blueprintFromHandoffs({
      mission: { id: 'm-2', name: 'Mission 2', releaseReadoutAt: null },
      handoffs: [handoff('SoftwareBuild', 1, { route: '/q' })],
    });
    // R5 (mission pipeline rebuild): display text renamed to "Prototype spec"
    // (GATE_DEFS[4].name) — the underlying stage enum passed into handoff()
    // above is still 'SoftwareBuild', unchanged.
    expect(result.reuseSignals.some((s) => /Prototype spec handoff present/.test(s))).toBe(true);
  });
  it('handles empty handoffs without throwing', () => {
    const result = blueprintFromHandoffs({
      mission: { id: 'm-3', name: 'Mission 3', releaseReadoutAt: null },
      handoffs: [],
    });
    expect(result.title).toContain('Mission 3');
    expect(result.blocks.length).toBe(0);
  });
});

describe('runbookFromHandoffs', () => {
  it('produces ordered steps from non-superseded handoffs', () => {
    const result = runbookFromHandoffs({
      mission: { id: 'm-4', name: 'Mission 4', releaseReadoutAt: null },
      handoffs: [handoff('Discovery', 1, {}), handoff('Readiness', 1, {})],
      releaseStatus: 'InProgress',
    });
    expect(result.steps.length).toBe(2);
    expect(result.steps[0]?.orderIndex).toBe(0);
    expect(result.escalationContacts.some((c) => c.role === 'Owner')).toBe(true);
  });
  it('produces a placeholder step when no handoffs', () => {
    const result = runbookFromHandoffs({
      mission: { id: 'm-5', name: 'Mission 5', releaseReadoutAt: null },
      handoffs: [],
      releaseStatus: 'InProgress',
    });
    expect(result.steps.length).toBe(1);
    expect(result.steps[0]?.heading).toContain('Stand up');
  });
  it('emits an audit contact when status is RolledBack', () => {
    const result = runbookFromHandoffs({
      mission: { id: 'm-6', name: 'Mission 6', releaseReadoutAt: null },
      handoffs: [handoff('Discovery', 1)],
      releaseStatus: 'RolledBack',
    });
    expect(result.escalationContacts.some((c) => c.role === 'Audit')).toBe(true);
  });
  it('emits an operator contact when status is Released', () => {
    const result = runbookFromHandoffs({
      mission: { id: 'm-7', name: 'Mission 7', releaseReadoutAt: null },
      handoffs: [handoff('Discovery', 1)],
      releaseStatus: 'Released',
    });
    expect(result.escalationContacts.some((c) => c.role === 'Operator')).toBe(true);
  });
});
