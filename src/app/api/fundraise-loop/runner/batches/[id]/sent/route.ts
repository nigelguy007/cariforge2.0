// @polsia:user-owned — POST /api/fundraise-loop/runner/batches/[id]/sent.
// Records what a CLAIMED (SENDING) batch actually pushed to HeyReach:
// body `{ sentProspectIds: string[] }` (may be empty). Those prospects become
// SENT; every other queued prospect in the batch becomes UNSENT; the batch
// becomes SENT. 409 unless the batch is SENDING. Deliberately NOT gated on
// the kill switch — it records a fact about pushes that already happened.

import 'server-only';
import { NextResponse } from 'next/server';
import { errorResponse, parseBody } from '@/lib/business/fundraise-loop/http';
import { requireRunner } from '@/lib/business/fundraise-loop/runner-auth';
import { markSent } from '@/lib/business/fundraise-loop/store';
import { BatchView, MarkSentInput } from '@/lib/contracts/fundraise-loop';

export const dynamic = 'force-dynamic';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = requireRunner(req);
  if (denied) return denied;
  const { id } = await params;
  const body = await parseBody(req, MarkSentInput);
  if (body.response) return body.response;
  try {
    return NextResponse.json(BatchView.parse(await markSent(id, body.data)));
  } catch (err) {
    return errorResponse(err);
  }
}
