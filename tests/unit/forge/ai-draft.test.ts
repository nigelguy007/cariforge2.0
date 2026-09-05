// @vitest-environment node — ai-draft.ts imports 'server-only' directly;
// see tests/unit/forge/auto-advance.test.ts's header comment for why jsdom
// (the suite default) can't run this without it.
//
// @polsia:user-owned — the one behavioural guarantee that matters most for
// this file: a missing/unusable AI Gateway key must degrade to
// { status: 'unavailable' } and never throw, because a drafting outage
// must never be the reason a project gets stuck (the admin fallback form
// is the only other path to a step output). This is exactly the situation
// this session hit for real on the Vercel Preview environment (the key is
// set for Production only) — this test pins the degrade-gracefully
// contract so a future change can't silently turn that into a thrown
// error instead. Deliberately does NOT test the 'ok' path: that would
// require either a live Anthropic Gateway call (network, cost, and
// nondeterministic in CI) or mocking the SDK deeply enough that the test
// stops meaning anything.

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

describe('draftStepOutput — no usable AI Gateway key', () => {
  it('returns { status: "unavailable" } rather than throwing', async () => {
    const { draftStepOutput } = await import('@/lib/business/forge/ai-draft');
    const result = await draftStepOutput({
      stage: 'Discovery',
      intake: 'A compliance team manually checks each claim for a required disclosure.',
      normalizedNeed: '',
      priorContext: [],
    });
    expect(result).toEqual({ status: 'unavailable' });
  });

  it('still degrades gracefully when a redraft feedback list is supplied', async () => {
    const { draftStepOutput } = await import('@/lib/business/forge/ai-draft');
    const result = await draftStepOutput({
      stage: 'Workflow',
      intake: 'the intake',
      normalizedNeed: 'the need',
      priorContext: ['an earlier step summary'],
      feedback: ['the scope looks unbounded'],
    });
    expect(result).toEqual({ status: 'unavailable' });
  });

  // Real user report (2026-09-05): "build real code generation" —
  // SoftwareBuild now dispatches to its own draftSoftwareBuildFiles
  // (larger schema, larger token budget, its own Gateway call). Same
  // guarantee has to hold for it: no key still means 'unavailable', never
  // a thrown error, checked BEFORE the dispatch happens (see
  // draftStepOutput's own `if (!client) return ...` ordering) so a
  // missing key degrades identically regardless of which stage.
  it('degrades gracefully for SoftwareBuild too, without ever reaching the code-gen path', async () => {
    const { draftStepOutput } = await import('@/lib/business/forge/ai-draft');
    const result = await draftStepOutput({
      stage: 'SoftwareBuild',
      intake: 'the intake',
      normalizedNeed: 'the need',
      priorContext: ['an earlier step summary'],
    });
    expect(result).toEqual({ status: 'unavailable' });
  });
});
