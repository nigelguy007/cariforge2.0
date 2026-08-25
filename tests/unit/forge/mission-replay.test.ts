// @polsia:user-owned — replay plan coverage: pure plan generation.
import { describe, expect, it } from 'vitest';
import { replayPlan } from '@/lib/business/forge/replay';

describe('replay plan', () => {
  it('knocks back to the FROM-stage status', () => {
    expect(replayPlan(0, 'restart from scratch').knocksBackToStatus).toBe('InDiscovery');
    expect(replayPlan(1, 'redraft readiness').knocksBackToStatus).toBe('InReadiness');
    expect(replayPlan(2, 'redraft workflow').knocksBackToStatus).toBe('InWorkflow');
    expect(replayPlan(3, 'redraft governance').knocksBackToStatus).toBe('InGovernance');
    expect(replayPlan(4, 'redraft build').knocksBackToStatus).toBe('InBuild');
  });
  it('seeds the new handoff at the FROM-stage', () => {
    expect(replayPlan(2, 'redo workflow').newHandoffSeedForStage).toBe('Workflow');
  });
  it('invalidates only stages strictly after the FROM-stage', () => {
    expect(replayPlan(2, 'redo').invalidatesStages).toEqual(['Governance', 'SoftwareBuild']);
    expect(replayPlan(4, 'redo').invalidatesStages).toEqual([]);
  });
  it('rejects out-of-range stageIndex', () => {
    expect(() => replayPlan(-1, 'x')).toThrow();
    expect(() => replayPlan(99, 'x')).toThrow();
  });
  it('rejects empty reasonText', () => {
    expect(() => replayPlan(1, '   ')).toThrow();
  });
  it('returns deterministic plan across invocations', () => {
    const a = replayPlan(2, 'redo');
    const b = replayPlan(2, 'redo');
    expect(a.knocksBackToStatus).toBe(b.knocksBackToStatus);
    expect(a.invalidatesStages).toEqual(b.invalidatesStages);
  });
});
