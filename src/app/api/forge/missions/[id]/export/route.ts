// @polsia:user-owned — GET /api/forge/missions/:id/export?format=json|csv.

import 'server-only';
import { NextResponse } from 'next/server';
import {
  buildEvidenceView,
  evidenceViewToDocumentSpec,
} from '@/components/custom/app/evidence-view';
import { forgeErrorResponse, requireForgeAuth } from '@/lib/business/forge/api-helpers';
import { buildEvidenceTrail, evidenceTrailToCsv } from '@/lib/business/forge/export';
import { getMissionDetail } from '@/lib/business/forge/service';
import { renderDocumentPdf } from '@/lib/pdf/client';

export const dynamic = 'force-dynamic';

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireForgeAuth(req);
  if (auth instanceof Response) return auth;
  const { id } = await ctx.params;
  const sp = new URL(req.url).searchParams;
  const formatParam = sp.get('format');
  const format = formatParam === 'csv' || formatParam === 'pdf' ? formatParam : 'json';
  try {
    const detail = await getMissionDetail(id, auth.user.id, auth.isAdmin);
    if (!detail) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (format === 'pdf') {
      const spec = evidenceViewToDocumentSpec(buildEvidenceView(detail));
      const bytes = await renderDocumentPdf(spec);
      return new Response(Buffer.from(bytes), {
        status: 200,
        headers: {
          'content-type': 'application/pdf',
          'content-disposition': `attachment; filename="forge-evidence-${id}.pdf"`,
        },
      });
    }
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
