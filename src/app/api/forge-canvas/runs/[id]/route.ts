// @polsia:user-owned — GET /api/forge-canvas/runs/[id]. Full run trace:
// node-by-node execution evidence + the open approval task if paused.
// Owner-only (admins may read any run).

import 'server-only';
import { NextResponse } from 'next/server';
import { forgeErrorResponse, requireForgeAuth } from '@/lib/business/forge/api-helpers';
import { getRunDetail } from '@/lib/business/forge-canvas/service';
import { CanvasRunDetail } from '@/lib/contracts/forge-canvas';

export const dynamic = 'force-dynamic';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireForgeAuth(req);
  if (auth instanceof Response) return auth;
  const { id } = await params;
  try {
    const detail = await getRunDetail(id, auth.user.id, auth.isAdmin);
    return NextResponse.json(CanvasRunDetail.parse(detail));
  } catch (err) {
    return forgeErrorResponse(err);
  }
}
