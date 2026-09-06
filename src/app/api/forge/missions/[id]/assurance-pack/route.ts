// @polsia:user-owned — GET /api/forge/missions/[id]/assurance-pack. Owner-
// or-admin-scoped, same access rule as GET /api/forge/missions/[id]
// (getMissionDetail throws FORGE_FORBIDDEN otherwise). Assembles the
// Section-8 assurance pack from this mission's real, already-persisted
// data — see business/forge/assurance-pack.ts for what's real vs.
// explicitly marked not-captured.

import 'server-only';
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { buildAssurancePack } from '@/lib/business/forge/assurance-pack';
import { getMissionDetail } from '@/lib/business/forge/service';
import { AssurancePack } from '@/lib/contracts/assurance-pack';
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
    const pack = await buildAssurancePack(detail);
    return NextResponse.json(AssurancePack.parse(pack), { status: 200 });
  } catch (err) {
    if ((err as Error).message === 'FORGE_FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
