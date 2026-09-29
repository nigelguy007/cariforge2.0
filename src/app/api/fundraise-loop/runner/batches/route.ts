// @polsia:user-owned — POST /api/fundraise-loop/runner/batches. The runner
// submits sourced prospects; they are deduped, warm paths are diverted to the
// intro list, and the cold rest becomes ONE batch awaiting human approval.

import 'server-only';
import { NextResponse } from 'next/server';
import { errorResponse, parseBody } from '@/lib/business/fundraise-loop/http';
import { requireRunner } from '@/lib/business/fundraise-loop/runner-auth';
import { ingestBatch } from '@/lib/business/fundraise-loop/store';
import { BatchIngest, BatchIngestResult } from '@/lib/contracts/fundraise-loop';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const denied = requireRunner(req);
  if (denied) return denied;
  const body = await parseBody(req, BatchIngest);
  if (body.response) return body.response;
  try {
    return NextResponse.json(BatchIngestResult.parse(await ingestBatch(body.data)), {
      status: 201,
    });
  } catch (err) {
    return errorResponse(err);
  }
}
