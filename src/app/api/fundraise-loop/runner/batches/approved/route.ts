// @polsia:user-owned — GET /api/fundraise-loop/runner/batches/approved.
// APPROVED batches (cold, queued prospects only) ready to CLAIM — empty unless
// the global kill switch is on. Listing is not permission to push: the runner
// must POST …/batches/[id]/claim first and push only what the claim returns.

import 'server-only';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { errorResponse } from '@/lib/business/fundraise-loop/http';
import { requireRunner } from '@/lib/business/fundraise-loop/runner-auth';
import { listApprovedForSend } from '@/lib/business/fundraise-loop/store';
import { BatchView } from '@/lib/contracts/fundraise-loop';

export const dynamic = 'force-dynamic';

const ApprovedList = z.object({ sendingEnabled: z.boolean(), batches: z.array(BatchView) });

export async function GET(req: Request) {
  const denied = requireRunner(req);
  if (denied) return denied;
  try {
    return NextResponse.json(ApprovedList.parse(await listApprovedForSend()));
  } catch (err) {
    return errorResponse(err);
  }
}
