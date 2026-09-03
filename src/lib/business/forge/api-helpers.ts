// @polsia:user-owned — shared auth seam for /api/forge/* route handlers.
// Returns either { user, isAdmin } or a pre-built Response (401/403) the
// caller returns as its own response. Centralised so every forge route
// extracts the same session shape.

import 'server-only';
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import type { SessionUser } from '@/lib/require-auth';
import { FORGE_ERROR_CODES, ForgeError } from './state-machine';

export interface ForgeAuthOk {
  readonly user: SessionUser;
  readonly isAdmin: boolean;
}

export async function requireForgeAuth(_req: Request): Promise<ForgeAuthOk | Response> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return { user: session.user as SessionUser, isAdmin: session.user.role === 'admin' };
}

export async function requireForgeAdmin(_req: Request): Promise<ForgeAuthOk | Response> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  return { user: session.user as SessionUser, isAdmin: true };
}

// Status code for each ForgeError code — governance/state conflicts are 409
// (the request was well-formed, but the mission/handoff isn't in a state
// that permits it), attribution failures are 403 (not authorized to make
// THIS particular attribution), and malformed reason-code selection is 422.
const FORGE_ERROR_STATUS: Record<
  (typeof FORGE_ERROR_CODES)[keyof typeof FORGE_ERROR_CODES],
  number
> = {
  [FORGE_ERROR_CODES.TRANSITION_INVALID]: 409,
  [FORGE_ERROR_CODES.GATE_LOCKED]: 409,
  [FORGE_ERROR_CODES.STAGE_MISMATCH]: 409,
  [FORGE_ERROR_CODES.VERSION_NOT_PARENT]: 409,
  [FORGE_ERROR_CODES.REASON_NOT_PERMITTED]: 422,
  [FORGE_ERROR_CODES.ATTRIBUTION_MISSING]: 403,
  [FORGE_ERROR_CODES.TOOL_SCOPE_DENIED]: 409,
  [FORGE_ERROR_CODES.TOOL_GATE_APPROVAL_MISSING]: 409,
  [FORGE_ERROR_CODES.TOOL_ROLLBACK_TARGET_INVALID]: 409,
  [FORGE_ERROR_CODES.MISSION_PAUSED]: 409,
  [FORGE_ERROR_CODES.TERMINAL]: 409,
};

export function forgeErrorResponse(err: unknown): Response {
  // ForgeError-coded errors (thrown by oracle-council.ts, policy.ts,
  // tool-actions.ts, handoffs.ts, state-machine.ts) previously fell through
  // to the generic `{ error: msg }, 400` below, since `msg` for a
  // ForgeError is "CODE: detail" and never matches the plain-string
  // `new Error('FORGE_XXX')` checks that follow. That leaked the raw
  // internal code + detail string to the client as a mis-coded 400 for
  // every governance/state-conflict rejection. Handle these first, with
  // the curated `.detail` text and the correct HTTP status per code.
  if (err instanceof ForgeError) {
    const status = FORGE_ERROR_STATUS[err.code] ?? 409;
    return NextResponse.json({ error: err.detail, code: err.code }, { status });
  }
  const msg = (err as Error).message || 'Internal Server Error';
  if (msg === 'FORGE_FORBIDDEN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  if (msg === 'FORGE_NOT_FOUND') return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (msg === 'FORGE_TOOL_NOT_FOUND' || msg === 'FORGE_HANDOFF_NOT_FOUND') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  if (msg === 'FORGE_TERMINAL')
    return NextResponse.json({ error: 'Mission is terminal' }, { status: 409 });
  if (msg === 'FORGE_NOT_PAUSED')
    return NextResponse.json({ error: 'Mission is not paused' }, { status: 409 });
  if (msg === 'FORGE_ALREADY_DECIDED')
    return NextResponse.json({ error: 'Already decided' }, { status: 409 });
  if (msg === 'FORGE_TOOL_ALREADY_DECIDED')
    return NextResponse.json({ error: 'Already decided' }, { status: 409 });
  if (msg === 'FORGE_TOOL_NOT_APPROVED')
    return NextResponse.json({ error: 'Tool action not approved' }, { status: 409 });
  if (msg === 'FORGE_INTAKE_LOCKED_OUT_OF_DRAFT') {
    return NextResponse.json({ error: 'Intake may only be refined while Draft' }, { status: 409 });
  }
  if (msg === 'FORGE_WORK_ITEM_NOT_FOUND')
    return NextResponse.json({ error: 'Work item not found' }, { status: 404 });
  if (msg === 'FORGE_WORK_ITEM_TRANSITION_INVALID')
    return NextResponse.json({ error: 'Work item transition not allowed' }, { status: 409 });
  if (msg === 'FORGE_NOT_COMPLETED')
    return NextResponse.json({ error: 'Mission is not in the Completed state' }, { status: 409 });

  // Anything reaching here is NOT a known business rejection — every one of
  // those returns above. It's either `FORGE_INTERNAL` or a genuine crash
  // (DB connection drop, null-ref, unhandled edge case). Two bugs fixed
  // here, both found in the 2026-09-03 audit:
  //
  //  1. It logged nothing. 40 route files funnel their catch blocks through
  //     this one helper, so a real server-side failure left no trace
  //     anywhere — indistinguishable from the caller sending something
  //     invalid. Same swallowed-error class that hid the AI Gateway 403 for
  //     days.
  //  2. It answered 400 (client error) for what is always a server-side
  //     fault, and echoed the raw internal message (`FORGE_INTERNAL`, or a
  //     Prisma stack message) straight back to the caller.
  console.error('[forge] unhandled error in route handler:', err);
  return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
}
