// @polsia:user-owned — POST /api/fundraise-loop/runner/batches/[id]/sent.
// Records that an APPROVED batch was handed to HeyReach. Refused (409) unless
// the batch is APPROVED and the kill switch is on.

import 'server-only';
import { NextResponse } from 'next/server';
import { errorResponse } from '@/lib/business/fundraise-loop/http';
import { requireRunner } from '@/lib/business/fundraise-loop/runner-auth';
import { markSent } from '@/lib/business/fundraise-loop/store';
import { BatchView } from '@/lib/contracts/fundraise-loop';

export const dynamic = 'force-dynamic';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = requireRunner(req);
  if (denied) return denied;
  const { id } = await params;
  try {
    return NextResponse.json(BatchView.parse(await markSent(id)));
  } catch (err) {
    return errorResponse(err);
  }
}
