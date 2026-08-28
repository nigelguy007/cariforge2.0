// @polsia:user-owned — /api/forge-canvas/runs. POST starts a run of a
// saved blueprint version in the safe test runtime (executes until the
// first approval pause or a terminal state, persisting the node-by-node
// trace). GET lists the caller's runs (admins see all).

import 'server-only';
import { NextResponse } from 'next/server';
import { forgeErrorResponse, requireForgeAuth } from '@/lib/business/forge/api-helpers';
import { listRuns, startRun } from '@/lib/business/forge-canvas/service';
import { CanvasRunDetail, CanvasRunList, RunStart } from '@/lib/contracts/forge-canvas';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const auth = await requireForgeAuth(req);
  if (auth instanceof Response) return auth;
  return NextResponse.json(CanvasRunList.parse(await listRuns(auth.user.id, auth.isAdmin)));
}

export async function POST(req: Request) {
  const auth = await requireForgeAuth(req);
  if (auth instanceof Response) return auth;
  const parsed = RunStart.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid run payload' }, { status: 400 });
  }
  try {
    const detail = await startRun({
      userId: auth.user.id,
      slug: parsed.data.slug,
      input: parsed.data.input,
      ...(parsed.data.version !== undefined ? { version: parsed.data.version } : {}),
    });
    return NextResponse.json(CanvasRunDetail.parse(detail), { status: 201 });
  } catch (err) {
    if ((err as Error).message === 'CANVAS_INVALID_AT_RUN') {
      return NextResponse.json(
        { error: 'Blueprint fails validation — fix it before running' },
        { status: 422 },
      );
    }
    return forgeErrorResponse(err);
  }
}
