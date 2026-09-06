// @polsia:user-owned — GET /api/forge/admin/adoption. Admin-only adoption &
// realised-value dashboard (Section 9 of the Aug 2026 enterprise-platform
// handoff doc) — real aggregates over every Mission/Objection row, no
// seeded or sample data. requireForgeAdmin returns 401 signed-out, 403
// non-admin, matching /api/forge/admin/telemetry's own gate.

import 'server-only';
import { NextResponse } from 'next/server';
import { forgeErrorResponse, requireForgeAdmin } from '@/lib/business/forge/api-helpers';
import { getAdoptionDashboard } from '@/lib/business/forge/service';
import { AdoptionDashboard } from '@/lib/contracts/telemetry';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const auth = await requireForgeAdmin(req);
  if (auth instanceof Response) return auth;
  try {
    const dashboard = await getAdoptionDashboard();
    return NextResponse.json(AdoptionDashboard.parse(dashboard), { status: 200 });
  } catch (err) {
    return forgeErrorResponse(err);
  }
}
