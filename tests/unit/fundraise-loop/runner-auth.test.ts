// @vitest-environment node — runner-auth.ts imports 'server-only'.
// @polsia:user-owned — pins the runner bearer-token gate: disabled (503) when
// the token is unset/weak, 401 on a missing or wrong token, pass-through on
// the right one.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const TOKEN = `${'a'.repeat(20)}-runner-secret-token`;
let saved: string | undefined;

beforeEach(() => {
  saved = process.env.FUNDRAISE_LOOP_TOKEN;
});
afterEach(() => {
  if (saved === undefined) delete process.env.FUNDRAISE_LOOP_TOKEN;
  else process.env.FUNDRAISE_LOOP_TOKEN = saved;
});

const req = (auth?: string) =>
  new Request('http://localhost/api/fundraise-loop/runner/plan', {
    headers: auth ? { authorization: auth } : {},
  });

describe('requireRunner', () => {
  it('503s when the token is unset', async () => {
    delete process.env.FUNDRAISE_LOOP_TOKEN;
    const { requireRunner } = await import('@/lib/business/fundraise-loop/runner-auth');
    const res = requireRunner(req(`Bearer ${TOKEN}`));
    expect(res?.status).toBe(503);
    expect(await res?.json()).toEqual({ error: 'Runner disabled' });
  });

  it('503s when the token is too short to be a real secret', async () => {
    process.env.FUNDRAISE_LOOP_TOKEN = 'short-token';
    const { requireRunner } = await import('@/lib/business/fundraise-loop/runner-auth');
    expect(requireRunner(req('Bearer short-token'))?.status).toBe(503);
  });

  it('401s without an Authorization header', async () => {
    process.env.FUNDRAISE_LOOP_TOKEN = TOKEN;
    const { requireRunner } = await import('@/lib/business/fundraise-loop/runner-auth');
    expect(requireRunner(req())?.status).toBe(401);
  });

  it('401s on a wrong token or non-Bearer scheme', async () => {
    process.env.FUNDRAISE_LOOP_TOKEN = TOKEN;
    const { requireRunner } = await import('@/lib/business/fundraise-loop/runner-auth');
    expect(requireRunner(req(`Bearer ${TOKEN}x`))?.status).toBe(401);
    expect(requireRunner(req('Bearer nope'))?.status).toBe(401);
    expect(requireRunner(req(`Basic ${TOKEN}`))?.status).toBe(401);
  });

  it('passes the correct bearer token', async () => {
    process.env.FUNDRAISE_LOOP_TOKEN = TOKEN;
    const { requireRunner } = await import('@/lib/business/fundraise-loop/runner-auth');
    expect(requireRunner(req(`Bearer ${TOKEN}`))).toBeNull();
  });
});
