// @polsia:user-owned — POST /api/fundraise-loop/runner/batches/[id]/claim.
// The runner MUST claim a batch before pushing anything: APPROVED → SENDING,
// atomically, and only while the kill switch is on. Returns the batch with
// its cold, queued prospects — the only people the runner may push. A second
// claim, a non-APPROVED batch, or sending disabled → 409.

import 'server-only';
import { NextResponse } from 'next/server';
import { errorResponse } from '@/lib/business/fundraise-loop/http';
import { requireRunner } from '@/lib/business/fundraise-loop/runner-auth';
import { claimBatch } from '@/lib/business/fundraise-loop/store';
import { BatchView } from '@/lib/contracts/fundraise-loop';

export const dynamic = 'force-dynamic';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = requireRunner(req);
  if (denied) return denied;
  const { id } = await params;
  try {
    return NextResponse.json(BatchView.parse(await claimBatch(id)));
  } catch (err) {
    return errorResponse(err);
  }
}
