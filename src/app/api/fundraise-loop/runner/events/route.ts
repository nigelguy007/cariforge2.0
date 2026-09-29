// @polsia:user-owned — POST /api/fundraise-loop/runner/events. The runner
// imports recorded outcomes (replies, meetings…). Idempotent per
// (prospect, type).

import 'server-only';
import { NextResponse } from 'next/server';
import { errorResponse, parseBody } from '@/lib/business/fundraise-loop/http';
import { requireRunner } from '@/lib/business/fundraise-loop/runner-auth';
import { recordEvents } from '@/lib/business/fundraise-loop/store';
import { EventIngest, EventIngestResult } from '@/lib/contracts/fundraise-loop';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const denied = requireRunner(req);
  if (denied) return denied;
  const body = await parseBody(req, EventIngest);
  if (body.response) return body.response;
  try {
    return NextResponse.json(
      EventIngestResult.parse(await recordEvents(body.data.events, 'runner')),
    );
  } catch (err) {
    return errorResponse(err);
  }
}
