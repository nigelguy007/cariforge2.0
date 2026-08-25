// @polsia:user-owned — GET /api/forge/missions/:id/blueprint.

import 'server-only';
import { NextResponse } from 'next/server';
import { forgeErrorResponse, requireForgeAuth } from '@/lib/business/forge/api-helpers';
import { blueprintFromHandoffs } from '@/lib/business/forge/release';
import { getMissionDetail } from '@/lib/business/forge/service';
import { BlueprintRead } from '@/lib/contracts/forge';

export const dynamic = 'force-dynamic';

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireForgeAuth(req);
  if (auth instanceof Response) return auth;
  const { id } = await ctx.params;
  try {
    const detail = await getMissionDetail(id, auth.user.id, auth.isAdmin);
    if (!detail) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const blueprint = blueprintFromHandoffs({
      mission: {
        id: detail.mission.id,
        name: detail.mission.name,
        releaseReadoutAt: detail.mission.releaseReadoutAt ?? null,
      },
      handoffs: detail.handoffs,
    });
    return NextResponse.json(BlueprintRead.parse(blueprint), { status: 200 });
  } catch (err) {
    return forgeErrorResponse(err);
  }
}
