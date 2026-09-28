// @polsia:user-owned — the machine-readable markers build-job.ts keeps in
// SoftwareBuildJob.error (2026-09-28), with no schema change. Pure (no
// server imports) so the parsers and the lease rules are unit-tested
// directly. See build-job.ts for how they are used.
//
// The column holds one of, for the job's CURRENT step (`plan`, the file
// index being generated, or `finalize`):
//   run:<step>:<attempt>:<startedAtEpochMs>  an attempt is in flight (a lease)
//   retry:<step>:<failedCount>               the last attempt failed; retry next
//   null                                     step not started yet
// or, once the job is Failed, the human-readable message. It is never
// returned to users: the route only returns BuildJobResult.

export type BuildStep = 'plan' | 'finalize' | number;

export type StepMarker =
  | { kind: 'run'; step: BuildStep; attempt: number; startedAt: number }
  | { kind: 'retry'; step: BuildStep; failed: number };

// Strict: a step is `plan`, `finalize` or a canonical non-negative integer, counts are
// positive integers, and nothing else may appear on the line.
const STEP = '(plan|finalize|0|[1-9]\\d*)';
const RUN_MARKER = new RegExp(`^run:${STEP}:([1-9]\\d*):(0|[1-9]\\d*)$`);
const RETRY_MARKER = new RegExp(`^retry:${STEP}:([1-9]\\d*)$`);

function parseStep(raw: string): BuildStep {
  return raw === 'plan' || raw === 'finalize' ? raw : Number(raw);
}

export function runMarker(step: BuildStep, attempt: number, startedAt: number): string {
  return `run:${step}:${attempt}:${startedAt}`;
}

export function retryMarker(step: BuildStep, failed: number): string {
  return `retry:${step}:${failed}`;
}

/** Parses a lease/retry marker; null for anything else (incl. null). */
export function parseStepMarker(value: string | null): StepMarker | null {
  if (!value) return null;
  const run = RUN_MARKER.exec(value);
  if (run?.[1] && run[2] && run[3]) {
    return {
      kind: 'run',
      step: parseStep(run[1]),
      attempt: Number(run[2]),
      startedAt: Number(run[3]),
    };
  }
  const retry = RETRY_MARKER.exec(value);
  if (retry?.[1] && retry[2]) {
    return { kind: 'retry', step: parseStep(retry[1]), failed: Number(retry[2]) };
  }
  return null;
}

// How long past an attempt's own AI timeout its lease still counts as
// live: covers the DB reads/writes around the call. Older than that, the
// function that held it was killed before it could write a result.
export const LEASE_GRACE_MS = 30_000;

export type StepAssessment =
  /** Another request's attempt is still running: don't start one. */
  | { kind: 'in-flight'; attempt: number }
  /** Start this (1-based) attempt next. */
  | { kind: 'next'; attempt: number }
  /** Every attempt has failed: mark the job Failed. */
  | { kind: 'exhausted' };

/** Decides what a request arriving at `step` should do, given the job's
 *  current `error` value and each attempt's AI timeout (its length is the
 *  attempt limit). A marker for a different step is ignored. A stale
 *  `run:` lease counts as that attempt having failed. */
export function assessStep(
  error: string | null,
  step: BuildStep,
  attemptTimeoutsMs: readonly number[],
  now: number,
): StepAssessment {
  const marker = parseStepMarker(error);
  let failed = 0;
  if (marker && marker.step === step) {
    if (marker.kind === 'retry') {
      failed = marker.failed;
    } else {
      const timeout = attemptTimeoutsMs[marker.attempt - 1] ?? Math.max(0, ...attemptTimeoutsMs);
      const age = now - marker.startedAt;
      // A start time far in the future can only be corrupt/skewed data;
      // treat it as stale rather than as a lease that never expires.
      const live = age < timeout + LEASE_GRACE_MS && age > -LEASE_GRACE_MS;
      if (live) return { kind: 'in-flight', attempt: marker.attempt };
      failed = marker.attempt;
    }
  }
  if (failed >= attemptTimeoutsMs.length) return { kind: 'exhausted' };
  return { kind: 'next', attempt: failed + 1 };
}
