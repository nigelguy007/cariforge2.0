// @polsia:user-owned — GET /api/admin/fundraise. Admin-only LoopSummary for
// the /admin/fundraise dashboard: allocation plan, totals, recent batches and
// the warm-intro list.

import 'server-only';
import { NextResponse } from 'next/server';
import { errorResponse, requireAdminSession } from '@/lib/business/fundraise-loop/http';
import { getSummary } from '@/lib/business/fundraise-loop/store';
import { LoopSummary } from '@/lib/contracts/fundraise-loop';

export const dynamic = 'force-dynamic';

export async function GET() {
  const admin = await requireAdminSession();
  if (admin.response) return admin.response;
  try {
    return NextResponse.json(LoopSummary.parse(await getSummary()));
  } catch (err) {
    return errorResponse(err);
  }
}
