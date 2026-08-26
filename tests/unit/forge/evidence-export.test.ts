// @polsia:user-owned — evidence-trail build + CSV cell escape coverage.
import { describe, expect, it } from 'vitest';
import { buildEvidenceTrail, evidenceTrailToCsv } from '@/lib/business/forge/export';
import type { MissionDetailT } from '@/lib/contracts/forge';

function detailFixture(): MissionDetailT {
  return {
    mission: {
      id: 'm-1',
      slug: 'mission-1',
      name: 'Mission 1',
      intake: 'long enough intake',
      normalizedNeed: '',
      status: 'Draft',
      currentStageIndex: 0,
      currentDraftVersion: null,
      confidence: 0.5,
      pausedAt: null,
      completedAt: null,
      rolledBackAt: null,
      previousStatus: null,
      createdById: 'user-1',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      domainTags: [],
      elderOracleUserId: null,
    },
    handoffs: [
      {
        id: 'h-1',
        stage: 'Discovery',
        version: 1,
        parentVersionId: null,
        correctionOfId: null,
        supersededById: null,
        replayOfMissionId: null,
        invalidationReasonCode: null,
        confidence: 0.7,
        gateIndexThatApproves: 0,
        payload: { needs: ['replace CRM'] },
        missingEvidence: [{ type: 'test_run', label: 'security benchmark pending' }],
        toolRefs: [],
        producedByToolActionId: null,
        createdById: 'user-1',
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    ],
    approvals: [
      {
        id: 'a-1',
        gateIndex: 0,
        stageHandoffId: 'h-1',
        approverUserId: 'user-1',
        decision: 'Approve',
        controls: null,
        reasonCode: 'Approved',
        reasonText: 'Need is well-scoped',
        supersedesApprovalId: null,
        replayOfApprovalId: null,
        at: '2026-01-02T00:00:00.000Z',
        oracleRole: 'NeedOracle',
        approverMatchedElder: false,
        attesterUserIds: [],
      },
    ],
    objections: [],
    evidence: [],
    toolActions: [],
    audits: [
      {
        id: 'au-1',
        event: 'created',
        payload: { slug: 'mission-1' },
        at: '2026-01-01T00:00:00.000Z',
        actorId: 'user-1',
        missionVersionAtEvent: 1,
      },
    ],
    gates: [],
    workItems: [],
    oracleRoster: [],
    handoffAttesters: [],
  };
}

describe('buildEvidenceTrail', () => {
  it('produces deterministic envelope shape', () => {
    const trail = buildEvidenceTrail(detailFixture());
    expect(trail.schemaVersion).toBe('forge-evidence-trail/v1');
    expect(trail.handoffs).toHaveLength(1);
    expect(trail.approvals).toHaveLength(1);
    expect(trail.audits).toHaveLength(1);
  });
  it('attaches generatedAt', () => {
    const trail = buildEvidenceTrail(detailFixture());
    expect(typeof trail.generatedAt).toBe('string');
  });
});

describe('evidenceTrailToCsv', () => {
  it('emits header row', () => {
    const csv = evidenceTrailToCsv(buildEvidenceTrail(detailFixture()));
    expect(csv.split('\n')[0]).toContain('artifact');
  });
  it('emits one row per handoff + approval + audit', () => {
    const csv = evidenceTrailToCsv(buildEvidenceTrail(detailFixture()));
    const lines = csv.trim().split('\n');
    expect(lines.length).toBe(4); // header + 1 handoff + 1 approval + 1 audit
  });
  it('escapes commas correctly', () => {
    const view = detailFixture();
    view.evidence = [
      {
        id: 'ev-1',
        attachedToStageHandoffId: 'h-1',
        kind: 'Text',
        ref: 'note,with,commas',
        label: 'commas-in-ref',
        capturedAt: '2026-01-01T00:00:00.000Z',
        capturedById: 'user-1',
      },
    ];
    const csv = evidenceTrailToCsv(buildEvidenceTrail(view));
    expect(csv).toContain('"note,with,commas"');
  });
  it('escapes double quotes correctly', () => {
    const view = detailFixture();
    view.evidence = [
      {
        id: 'ev-1',
        attachedToStageHandoffId: 'h-1',
        kind: 'Text',
        ref: 'said "yes"',
        label: 'double-quotes-in-ref',
        capturedAt: '2026-01-01T00:00:00.000Z',
        capturedById: 'user-1',
      },
    ];
    const csv = evidenceTrailToCsv(buildEvidenceTrail(view));
    expect(csv).toContain('"said ""yes"""');
  });
});
