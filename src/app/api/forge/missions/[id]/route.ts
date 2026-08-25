// @polsia:user-owned — GET /api/forge/missions/[id]. Owner-scoped detail.

import 'server-only';
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getMissionDetail } from '@/lib/business/forge/service';
import { MissionDetail } from '@/lib/contracts/forge';
import type { SessionUser } from '@/lib/require-auth';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const user = session.user as SessionUser;
  const { id } = await ctx.params;
  const isAdmin = user.role === 'admin';
  try {
    const detail = await getMissionDetail(id, user.id, isAdmin);
    if (!detail) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(MissionDetail.parse(detail), { status: 200 });
  } catch (err) {
    if ((err as Error).message === 'FORGE_FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
