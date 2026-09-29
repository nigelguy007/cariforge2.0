// @polsia:user-owned — GET /api/fundraise-loop/runner/plan. This week's
// per-segment allocation for the scheduled runner. Bearer-token auth.

import 'server-only';
import { NextResponse } from 'next/server';
import { errorResponse } from '@/lib/business/fundraise-loop/http';
import { requireRunner } from '@/lib/business/fundraise-loop/runner-auth';
import { computePlan } from '@/lib/business/fundraise-loop/store';
import { LoopPlan } from '@/lib/contracts/fundraise-loop';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const denied = requireRunner(req);
  if (denied) return denied;
  try {
    return NextResponse.json(LoopPlan.parse(await computePlan()));
  } catch (err) {
    return errorResponse(err);
  }
}
