// @polsia:user-owned — PUT /api/admin/fundraise/segments. Create or edit an
// investor segment the loop aims at (including pausing it).

import 'server-only';
import { NextResponse } from 'next/server';
import { errorResponse, parseBody, requireAdminSession } from '@/lib/business/fundraise-loop/http';
import { upsertSegment } from '@/lib/business/fundraise-loop/store';
import { SegmentUpsert } from '@/lib/contracts/fundraise-loop';

export const dynamic = 'force-dynamic';

export async function PUT(req: Request) {
  const admin = await requireAdminSession();
  if (admin.response) return admin.response;
  const body = await parseBody(req, SegmentUpsert);
  if (body.response) return body.response;
  try {
    await upsertSegment(body.data);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
