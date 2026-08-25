// @polsia:user-owned — GET /api/forge/missions/[id]/telemetry.
// Per-mission autonomy + cost read. Owner-scoped via requireForgeAuth +
// service-layer owner check (mirrors getMissionDetail).
import 'server-only';
import { NextResponse } from 'next/server';
import { forgeErrorResponse, requireForgeAuth } from '@/lib/business/forge/api-helpers';
import { getMissionTelemetry } from '@/lib/business/forge/service';
import { MissionTelemetryRead } from '@/lib/contracts/telemetry';

export const dynamic = 'force-dynamic';

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireForgeAuth(req);
  if (auth instanceof Response) return auth;
  const { id } = await ctx.params;
  try {
    const t = await getMissionTelemetry({
      missionId: id,
      userId: auth.user.id,
      isAdmin: auth.isAdmin,
    });
    if (!t) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(MissionTelemetryRead.parse(t), { status: 200 });
  } catch (err) {
    return forgeErrorResponse(err);
  }
}
