// @polsia:user-owned — strict parsing of the lease/retry markers kept in
// SoftwareBuildJob.error, and the per-step lease rules (build-job-markers.ts).

import { describe, expect, it } from 'vitest';
import {
  assessStep,
  LEASE_GRACE_MS,
  parseStepMarker,
  retryMarker,
  runMarker,
} from '@/lib/business/forge/build-job-markers';

const FILE_TIMEOUTS = [100_000, 125_000, 230_000] as const;
const PLAN_TIMEOUTS = [115_000, 115_000] as const;
const NOW = 1_800_000_000_000;

describe('parseStepMarker', () => {
  it('round-trips run and retry markers for files and the plan', () => {
    expect(parseStepMarker(runMarker(3, 2, NOW))).toEqual({
      kind: 'run',
      step: 3,
      attempt: 2,
      startedAt: NOW,
    });
    expect(parseStepMarker(runMarker('plan', 1, NOW))).toEqual({
      kind: 'run',
      step: 'plan',
      attempt: 1,
      startedAt: NOW,
    });
    expect(parseStepMarker(retryMarker(0, 1))).toEqual({ kind: 'retry', step: 0, failed: 1 });
    expect(parseStepMarker(runMarker('finalize', 1, NOW))).toEqual({
      kind: 'run',
      step: 'finalize',
      attempt: 1,
      startedAt: NOW,
    });
    expect(parseStepMarker(retryMarker('plan', 1))).toEqual({
      kind: 'retry',
      step: 'plan',
      failed: 1,
    });
  });

  it('rejects anything that is not exactly a marker', () => {
    for (const value of [
      null,
      '',
      'CARIForge could not generate src/a.ts.',
      'Unexpected error',
      'retry:1',
      'retry:1:0',
      'retry:01:1',
      'retry:-1:1',
      'retry:1:1:1',
      'retry:plan:1:x',
      'retry:Plan:1',
      ' retry:1:1',
      'retry:1:1\n',
      'run:1:1',
      'run:1:0:5',
      'run:1:1:-5',
      'run:1:1:1.5',
      'run:plan:1:',
      'run:x:1:5',
      'run:Finalize:1:5',
      'run:finalized:1:5',
      'run:finalize:1',
      'retry:finalize:x',
    ]) {
      expect(parseStepMarker(value), String(value)).toBeNull();
    }
  });
});

describe('assessStep', () => {
  it('starts attempt 1 with no marker, or with a marker for another step', () => {
    expect(assessStep(null, 2, FILE_TIMEOUTS, NOW)).toEqual({ kind: 'next', attempt: 1 });
    expect(assessStep(retryMarker(1, 2), 2, FILE_TIMEOUTS, NOW)).toEqual({
      kind: 'next',
      attempt: 1,
    });
    expect(assessStep(runMarker(1, 3, NOW), 2, FILE_TIMEOUTS, NOW)).toEqual({
      kind: 'next',
      attempt: 1,
    });
    expect(assessStep(retryMarker('plan', 1), 0, FILE_TIMEOUTS, NOW)).toEqual({
      kind: 'next',
      attempt: 1,
    });
    expect(assessStep(retryMarker(0, 1), 'plan', PLAN_TIMEOUTS, NOW)).toEqual({
      kind: 'next',
      attempt: 1,
    });
  });

  it('continues after a recorded failure and is exhausted after the last', () => {
    expect(assessStep(retryMarker(2, 1), 2, FILE_TIMEOUTS, NOW)).toEqual({
      kind: 'next',
      attempt: 2,
    });
    expect(assessStep(retryMarker(2, 3), 2, FILE_TIMEOUTS, NOW)).toEqual({ kind: 'exhausted' });
    expect(assessStep(retryMarker('plan', 2), 'plan', PLAN_TIMEOUTS, NOW)).toEqual({
      kind: 'exhausted',
    });
  });

  it("treats a run lease as in flight until its attempt's timeout + grace", () => {
    const limit3 = FILE_TIMEOUTS[2] + LEASE_GRACE_MS;
    expect(assessStep(runMarker(2, 3, NOW - limit3 + 1), 2, FILE_TIMEOUTS, NOW)).toEqual({
      kind: 'in-flight',
      attempt: 3,
    });
    const limit1 = FILE_TIMEOUTS[0] + LEASE_GRACE_MS;
    expect(assessStep(runMarker(2, 1, NOW - limit1 + 1), 2, FILE_TIMEOUTS, NOW)).toEqual({
      kind: 'in-flight',
      attempt: 1,
    });
  });

  it('counts a stale run lease as that attempt having failed', () => {
    const limit1 = FILE_TIMEOUTS[0] + LEASE_GRACE_MS;
    expect(assessStep(runMarker(2, 1, NOW - limit1), 2, FILE_TIMEOUTS, NOW)).toEqual({
      kind: 'next',
      attempt: 2,
    });
    const limit3 = FILE_TIMEOUTS[2] + LEASE_GRACE_MS;
    expect(assessStep(runMarker(2, 3, NOW - limit3), 2, FILE_TIMEOUTS, NOW)).toEqual({
      kind: 'exhausted',
    });
    const planLimit = PLAN_TIMEOUTS[0] + LEASE_GRACE_MS;
    expect(assessStep(runMarker('plan', 1, NOW - planLimit), 'plan', PLAN_TIMEOUTS, NOW)).toEqual({
      kind: 'next',
      attempt: 2,
    });
  });

  it('treats a start time far in the future as stale, not as a lease that never ends', () => {
    expect(assessStep(runMarker(2, 1, NOW + LEASE_GRACE_MS + 1), 2, FILE_TIMEOUTS, NOW)).toEqual({
      kind: 'next',
      attempt: 2,
    });
  });

  it('applies the lease rules to the finalize step too', () => {
    const FINALIZE = [150_000] as const;
    expect(assessStep(runMarker('finalize', 1, NOW - 10_000), 'finalize', FINALIZE, NOW)).toEqual({
      kind: 'in-flight',
      attempt: 1,
    });
    expect(assessStep(runMarker('finalize', 1, NOW - 180_000), 'finalize', FINALIZE, NOW)).toEqual({
      kind: 'exhausted',
    });
    expect(assessStep(runMarker('plan', 1, NOW), 'finalize', FINALIZE, NOW)).toEqual({
      kind: 'next',
      attempt: 1,
    });
  });
});
