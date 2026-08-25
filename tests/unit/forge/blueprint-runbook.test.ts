// @polsia:user-owned — derived Blueprint + Runbook payloads parse back to zod.
import { describe, expect, it } from 'vitest';
import { blueprintFromHandoffs, runbookFromHandoffs } from '@/lib/business/forge/release';
import { BlueprintRead, type HandoffItemT, RunbookRead } from '@/lib/contracts/forge';

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

describe('Blueprint payload is zod-parseable', () => {
  it('parses the derived blueprint', () => {
    const result = blueprintFromHandoffs({
      mission: { id: 'm-1', name: 'Mission 1', releaseReadoutAt: null },
      handoffs: [
        handoff('Discovery', 1, { need: 'replace CRM' }),
        handoff('Readiness', 1, { constraints: 'budget cap' }),
        handoff('Workflow', 1, { roles: ['Operator'] }),
        handoff('Governance', 1, { dpo: 'L. Caulfield' }),
        handoff('SoftwareBuild', 1, { route: '/crm/queue' }),
      ],
    });
    expect(() => BlueprintRead.parse(result)).not.toThrow();
    expect(result.title).toContain('Mission 1');
    expect(result.summary.length).toBeGreaterThan(0);
    expect(result.blocks.length).toBe(5);
  });
  it('parses the derived runbook', () => {
    const result = runbookFromHandoffs({
      mission: { id: 'm-2', name: 'Mission 2', releaseReadoutAt: null },
      handoffs: [
        handoff('Discovery', 1, { need: 'replace CRM' }),
        handoff('SoftwareBuild', 1, { route: '/crm/queue' }),
      ],
      releaseStatus: 'BuildApprovedNotReleased',
    });
    expect(() => RunbookRead.parse(result)).not.toThrow();
    expect(result.steps.length).toBe(2);
  });
  it('is non-empty at every stage past Workflow', () => {
    for (const stages of [
      ['Workflow', 'SoftwareBuild'],
      ['Readiness', 'Workflow', 'Governance', 'SoftwareBuild'],
      ['Discovery', 'Readiness', 'Workflow', 'Governance', 'SoftwareBuild'],
    ]) {
      const result = blueprintFromHandoffs({
        mission: { id: 'm-3', name: 'Mission 3', releaseReadoutAt: null },
        handoffs: stages.map((s, idx) => handoff(s as HandoffItemT['stage'], 1, { stage: s, idx })),
      });
      expect(result.blocks.length).toBe(stages.length);
    }
  });
});
