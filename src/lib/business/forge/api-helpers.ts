// @polsia:user-owned — shared auth seam for /api/forge/* route handlers.
// Returns either { user, isAdmin } or a pre-built Response (401/403) the
// caller returns as its own response. Centralised so every forge route
// extracts the same session shape.

import 'server-only';
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import type { SessionUser } from '@/lib/require-auth';

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

export function forgeErrorResponse(err: unknown): Response {
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
  return NextResponse.json({ error: msg }, { status: 400 });
}
