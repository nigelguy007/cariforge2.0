// @polsia:user-owned — GET /api/forge/missions/:id/audit. Owner-scoped read.

import 'server-only';
import { NextResponse } from 'next/server';
import { forgeErrorResponse, requireForgeAuth } from '@/lib/business/forge/api-helpers';
import { getMissionDetail } from '@/lib/business/forge/service';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireForgeAuth(_req);
  if (auth instanceof Response) return auth;
  const { id } = await ctx.params;
  try {
    const detail = await getMissionDetail(id, auth.user.id, auth.isAdmin);
    if (!detail) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ items: detail.audits }, { status: 200 });
  } catch (err) {
    return forgeErrorResponse(err);
  }
}
