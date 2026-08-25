// @polsia:user-owned — GET /api/admin/leads/export. Admin-only CSV download.
// Same session/role gate as the JSON listing; the link in the admin table hits
// this endpoint as a same-origin browser GET so the auth cookie rides along and
// the browser handles the attachment.
//
// Mirrors the /api/admin/leads filter (?type=…&segment=…) so the CSV
// downloads exactly the rows the admin sees in the table. The filename gets
// a `-{type}-{segment}` suffix when a filter knob is non-default; when both
// are 'all' the filename stays `leads-YYYY-MM-DD.csv` (no churn from knob
// state — no surprise "export an empty file renamed"-style footguns).

import 'server-only';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { leadsToCsv, listLeadsForAdmin } from '@/lib/business/leads';
import { LeadList, LeadsFilter, type LeadsFilter as LeadsFilterData } from '@/lib/contracts/leads';

export const dynamic = 'force-dynamic';

const DEFAULT_FILTER: LeadsFilterData = { type: 'all', segment: 'all' };

function csvFileNameStamp(): string {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD UTC
}

export async function GET(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  if (session.user.role !== 'admin') {
    return new Response(JSON.stringify({ error: 'Forbidden' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Invalid filter values degrade to "show everything" — never a 400, so the
  // export button never fails on a stray query param from an old bookmark.
  const sp = new URL(req.url).searchParams;
  const parsed = LeadsFilter.safeParse({
    type: sp.get('type') ?? 'all',
    segment: sp.get('segment') ?? 'all',
  });
  const filter: LeadsFilterData = parsed.success ? parsed.data : DEFAULT_FILTER;

  const csv = leadsToCsv(LeadList.parse(await listLeadsForAdmin(filter)).items);
  const filename = buildCsvFileName(filter, csvFileNameStamp());

  return new Response(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}

// Two-step filename builder — only adds the knob suffix when a knob is
// non-default so the unfiltered default stays "leads-YYYY-MM-DD.csv".
function buildCsvFileName(filter: LeadsFilterData, stamp: string): string {
  const tags: string[] = [];
  if (filter.type !== 'all') tags.push(filter.type);
  if (filter.segment !== 'all') tags.push(filter.segment.replace(/\s+/g, '-').toLowerCase());
  return tags.length > 0 ? `leads-${stamp}-${tags.join('-')}.csv` : `leads-${stamp}.csv`;
}
