// @polsia:user-owned — GET /api/forge/missions/:id/export?format=json|csv.

import 'server-only';
import { NextResponse } from 'next/server';
import { forgeErrorResponse, requireForgeAuth } from '@/lib/business/forge/api-helpers';
import { buildEvidenceTrail, evidenceTrailToCsv } from '@/lib/business/forge/export';
import { getMissionDetail } from '@/lib/business/forge/service';

export const dynamic = 'force-dynamic';

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireForgeAuth(req);
  if (auth instanceof Response) return auth;
  const { id } = await ctx.params;
  const sp = new URL(req.url).searchParams;
  const format = sp.get('format') === 'csv' ? 'csv' : 'json';
  try {
    const detail = await getMissionDetail(id, auth.user.id, auth.isAdmin);
    if (!detail) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const trail = buildEvidenceTrail(detail);
    if (format === 'csv') {
      const csv = evidenceTrailToCsv(trail);
      return new Response(csv, {
        status: 200,
        headers: {
          'content-type': 'text/csv; charset=utf-8',
          'content-disposition': `attachment; filename="forge-evidence-${id}.csv"`,
        },
      });
    }
    return NextResponse.json(trail, { status: 200 });
  } catch (err) {
    return forgeErrorResponse(err);
  }
}
