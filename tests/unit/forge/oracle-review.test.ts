// @vitest-environment node — oracle-review.ts imports 'server-only'
// directly; see tests/unit/forge/auto-advance.test.ts's header comment for
// why jsdom (the suite default) can't run this without it.
//
// @polsia:user-owned — same guarantee as ai-draft.test.ts, for the two
// functions auto-advance.ts depends on directly: an unusable AI Gateway
// key (reviewStepDraft) or nothing to reconcile (reconcileConcerns) must
// degrade to 'unavailable' and never throw — a review or reconciliation
// outage must never block a human from deciding the gate themselves via
// the existing DecisionDialog. Does not exercise the 'ok' path for the
// same reason ai-draft.test.ts doesn't: no live Anthropic Gateway calls
// in a unit test.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const ENV_KEYS = ['AI_GATEWAY_API_KEY', 'ANTHROPIC_API_KEY'] as const;
let saved: Record<string, string | undefined>;

beforeEach(() => {
  saved = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
  for (const k of ENV_KEYS) delete process.env[k];
  vi.resetModules();
});

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

describe('reviewStepDraft — no usable AI Gateway key', () => {
  it('returns { status: "unavailable" } rather than throwing', async () => {
    const { reviewStepDraft } = await import('@/lib/business/forge/oracle-review');
    const result = await reviewStepDraft({
      stage: 'Discovery',
      draftSummary: 'a clear, bounded problem statement',
    });
    expect(result).toEqual({ status: 'unavailable' });
  });
});

describe('reconcileConcerns', () => {
  it('is unavailable without a key even when concerns are supplied', async () => {
    const { reconcileConcerns } = await import('@/lib/business/forge/oracle-review');
    const result = await reconcileConcerns({
      stage: 'Discovery',
      draftSummary: 'a clear, bounded problem statement',
      concerns: [{ role: 'Risk', note: 'the scope looks unbounded' }],
    });
    expect(result).toEqual({ status: 'unavailable' });
  });

  it('is unavailable with an empty concerns list — nothing to reconcile, key or not', async () => {
    // No client-availability dependency here: this is the "concerns.length
    // === 0" short-circuit, so it holds regardless of the deleted env vars
    // above — asserted explicitly since it's the one branch that would
    // still return 'unavailable' even with a real key configured.
    const { reconcileConcerns } = await import('@/lib/business/forge/oracle-review');
    const result = await reconcileConcerns({
      stage: 'Discovery',
      draftSummary: 'a clear, bounded problem statement',
      concerns: [],
    });
    expect(result).toEqual({ status: 'unavailable' });
  });
});
