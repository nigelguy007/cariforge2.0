// @polsia:user-owned — pure transition-table coverage. Asserts every cell.
import { describe, expect, it } from 'vitest';
import {
  assertTransition,
  FORGE_ERROR_CODES,
  ForgeError,
  gateIndexFor,
  isValidResumeTarget,
  nextStageFor,
  recomputeConfidence,
  TERMINAL_STATUSES,
  transitions,
} from '@/lib/business/forge/state-machine';
import { GATE_DEFS, MissionStatusValues, StageNameValues } from '@/lib/contracts/forge';

describe('forge state machine — transition table', () => {
  for (const from of MissionStatusValues) {
    for (const to of MissionStatusValues) {
      if (from === to) continue;
      const allowed = transitions[from].includes(to);
      it(`${from} → ${to} ${allowed ? 'is allowed' : 'is forbidden'}`, () => {
        if (allowed) {
          expect(() => assertTransition(from, to)).not.toThrow();
        } else {
          expect(() => assertTransition(from, to)).toThrow(ForgeError);
          try {
            assertTransition(from, to);
          } catch (err) {
            expect((err as ForgeError).code).toBe(FORGE_ERROR_CODES.TRANSITION_INVALID);
          }
        }
      });
    }
  }
});

describe('forge terminal statuses', () => {
  it.each(['Rejected', 'Completed', 'WalkedAway'] as const)('%s is terminal', (status) => {
    for (const to of MissionStatusValues) {
      expect(() => assertTransition(status, to)).toThrow(ForgeError);
    }
  });
  it('non-terminal statuses are not flagged', () => {
    expect(TERMINAL_STATUSES.has('Draft')).toBe(false);
    expect(TERMINAL_STATUSES.has('InBuild')).toBe(false);
    expect(TERMINAL_STATUSES.has('Paused')).toBe(false);
  });
});

describe('forge gate binding', () => {
  for (let i = 0; i < StageNameValues.length; i++) {
    const stage = StageNameValues[i];
    if (!stage) continue;
    it(`gateIndexFor(${stage}) === ${i}`, () => {
      expect(gateIndexFor(stage)).toBe(i);
    });
  }
  it('nextStageFor steps through the lifecycle', () => {
    expect(nextStageFor(0)).toBe('InDiscovery');
    expect(nextStageFor(1)).toBe('InReadiness');
    expect(nextStageFor(2)).toBe('InWorkflow');
    expect(nextStageFor(3)).toBe('InGovernance');
    expect(nextStageFor(4)).toBe('Completed');
    expect(() => nextStageFor(5)).toThrow(ForgeError);
  });
  it('every stage maps to a registered gate', () => {
    expect(GATE_DEFS).toHaveLength(5);
  });
});

describe('forge isValidResumeTarget', () => {
  it.each(['Draft', 'InDiscovery', 'InReadiness', 'InWorkflow', 'InGovernance', 'InBuild'])(
    'accepts %s',
    (target) => {
      expect(isValidResumeTarget(target as never)).toBe(true);
    },
  );
  it.each([
    'Completed',
    'Rejected',
    'WalkedAway',
    'Paused',
    'AwaitingApproval',
    'Blocked',
    'RolledBack',
  ])('rejects %s', (target) => {
    expect(isValidResumeTarget(target as never)).toBe(false);
  });
});

describe('forge confidence recomputation', () => {
  it('returns clamped value', () => {
    expect(recomputeConfidence(0.95, 0)).toBeCloseTo(0.95, 5);
    expect(recomputeConfidence(0.5, 1)).toBeCloseTo(0.45, 5);
    expect(recomputeConfidence(0.5, 5)).toBeCloseTo(0.25, 5);
  });
  it('clamps missing-evidence penalty to 50%', () => {
    expect(recomputeConfidence(0.9, 100)).toBeCloseTo(0.45, 5);
  });
  it('keeps result within [0, 1]', () => {
    expect(recomputeConfidence(0.1, 0)).toBeGreaterThanOrEqual(0);
    expect(recomputeConfidence(0.1, 0)).toBeLessThanOrEqual(1);
    expect(recomputeConfidence(1.5, 0)).toBeLessThanOrEqual(1);
  });
});
