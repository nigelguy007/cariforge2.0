// @polsia:user-owned — GET /api/forge/missions/:id/gates/:gateIndex.

import 'server-only';
import { NextResponse } from 'next/server';
import { forgeErrorResponse, requireForgeAuth } from '@/lib/business/forge/api-helpers';
import { getMissionDetail } from '@/lib/business/forge/service';
import { GateState } from '@/lib/contracts/forge';

export const dynamic = 'force-dynamic';

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string; gateIndex: string }> },
) {
  const auth = await requireForgeAuth(req);
  if (auth instanceof Response) return auth;
  const { id, gateIndex } = await ctx.params;
  const parsedIdx = Number.parseInt(gateIndex, 10);
  if (!Number.isFinite(parsedIdx) || parsedIdx < 0 || parsedIdx > 4) {
    return NextResponse.json({ errors: { gateIndex: 'gateIndex must be 0..4' } }, { status: 400 });
  }
  try {
    const detail = await getMissionDetail(id, auth.user.id, auth.isAdmin);
    if (!detail) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const gate = detail.gates[parsedIdx];
    if (!gate) return NextResponse.json({ error: 'Gate not found' }, { status: 404 });
    return NextResponse.json(GateState.parse(gate), { status: 200 });
  } catch (err) {
    return forgeErrorResponse(err);
  }
}
