// @polsia:user-owned — POST /api/admin/fundraise/events. Manual import of
// recorded investor interactions (reply, meeting, pass…). Idempotent per
// (prospect, type).

import 'server-only';
import { NextResponse } from 'next/server';
import { errorResponse, parseBody, requireAdminSession } from '@/lib/business/fundraise-loop/http';
import { recordEvents } from '@/lib/business/fundraise-loop/store';
import { EventIngest, EventIngestResult } from '@/lib/contracts/fundraise-loop';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const admin = await requireAdminSession();
  if (admin.response) return admin.response;
  const body = await parseBody(req, EventIngest);
  if (body.response) return body.response;
  try {
    return NextResponse.json(
      EventIngestResult.parse(await recordEvents(body.data.events, 'manual')),
    );
  } catch (err) {
    return errorResponse(err);
  }
}
