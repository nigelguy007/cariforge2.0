// @polsia:user-owned — GET /api/admin/leads. Admin-only listing of every Lead.
// Gates the read by role-`admin` at the top of the handler (returns 401 when
// the visitor is unauthenticated, 403 when they're signed in but not an admin)
// so the client island's error state surfaces a useful message instead of a
// next-redirect 307. Returns a LeadList envelope parsed against the
// shared contract so client + server can't drift.
//
// Query params (`?type=…&segment=…`) are parsed through LeadsFilter so
// invalid values degrade cleanly to the default ("all / all") — never an
// error response, that would surface as a 400 in the UI for a stray bit.

import 'server-only';
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { listLeadsForAdmin } from '@/lib/business/leads';
import { LeadList, LeadsFilter } from '@/lib/contracts/leads';

export const dynamic = 'force-dynamic';

const DEFAULT_FILTER: LeadsFilter = { type: 'all', segment: 'all' };

export async function GET(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Invalid filter values degrade to "show everything" — never a 400.
  const sp = new URL(req.url).searchParams;
  const parsed = LeadsFilter.safeParse({
    type: sp.get('type') ?? 'all',
    segment: sp.get('segment') ?? 'all',
  });
  const filter: LeadsFilter = parsed.success ? parsed.data : DEFAULT_FILTER;

  const payload = LeadList.parse(await listLeadsForAdmin(filter));
  return NextResponse.json(payload, { status: 200 });
}
