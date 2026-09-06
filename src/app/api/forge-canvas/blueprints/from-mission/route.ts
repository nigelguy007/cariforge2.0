// @polsia:user-owned — POST /api/forge-canvas/blueprints/from-mission
// (UX review C2, wireframe v2 screen 2d). Gate 5's handoff into the Forge:
// creates the blueprint linked to a mission — seeded from the mission's
// intake and authority boundary — or idempotently returns the one already
// linked. Guarded to the mission owner (or admin) and to missions that
// have actually reached the Software Build gate.

import 'server-only';
import { NextResponse } from 'next/server';
import { forgeErrorResponse, requireForgeAuth } from '@/lib/business/forge/api-helpers';
import { createBlueprintFromMission } from '@/lib/business/forge-canvas/service';
import { BlueprintFromMission, BlueprintItem } from '@/lib/contracts/forge-canvas';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const auth = await requireForgeAuth(req);
  if (auth instanceof Response) return auth;
  const parsed = BlueprintFromMission.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }
  try {
    const bp = await createBlueprintFromMission({
      userId: auth.user.id,
      isAdmin: auth.isAdmin,
      missionId: parsed.data.missionId,
    });
    return NextResponse.json(BlueprintItem.parse(bp), { status: 201 });
  } catch (err) {
    if ((err as Error).message === 'FORGE_CONFLICT') {
      return NextResponse.json(
        { error: 'The mission has not reached the Software Build gate yet.' },
        { status: 409 },
      );
    }
    return forgeErrorResponse(err);
  }
}
