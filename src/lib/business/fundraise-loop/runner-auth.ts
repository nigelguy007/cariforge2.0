// @polsia:user-owned — bearer-token gate for the scheduled fundraise-loop
// runner (/api/fundraise-loop/runner/*). The token lives in the
// FUNDRAISE_LOOP_TOKEN env var; unset or too short disables the runner
// entirely (503) rather than accepting a weak secret.

import 'server-only';
import { createHash, timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';

export const MIN_RUNNER_TOKEN_LENGTH = 24;

const sha256 = (s: string) => createHash('sha256').update(s, 'utf8').digest();

/** Returns an error response when the request is not from the runner, else null. */
export function requireRunner(req: Request): NextResponse | null {
  const expected = process.env.FUNDRAISE_LOOP_TOKEN;
  if (!expected || expected.length < MIN_RUNNER_TOKEN_LENGTH) {
    return NextResponse.json({ error: 'Runner disabled' }, { status: 503 });
  }
  const header = req.headers.get('authorization') ?? '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  // Hash both sides so the comparison is constant-time and length-independent.
  const presented = match?.[1]?.trim();
  if (!presented || !timingSafeEqual(sha256(presented), sha256(expected))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return null;
}
