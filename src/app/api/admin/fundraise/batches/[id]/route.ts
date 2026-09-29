// @polsia:user-owned — PATCH /api/admin/fundraise/batches/[id]. The human
// approval gate: approve / reject a drafted batch, or skip individual
// prospects while it is still pending. Illegal moves → 409.

import 'server-only';
import { NextResponse } from 'next/server';
import { errorResponse, parseBody, requireAdminSession } from '@/lib/business/fundraise-loop/http';
import { decideBatch } from '@/lib/business/fundraise-loop/store';
import { BatchDecision, BatchView } from '@/lib/contracts/fundraise-loop';

export const dynamic = 'force-dynamic';

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdminSession();
  if (admin.response) return admin.response;
  const { id } = await params;
  const body = await parseBody(req, BatchDecision);
  if (body.response) return body.response;
  try {
    return NextResponse.json(BatchView.parse(await decideBatch(id, body.data, admin.email)));
  } catch (err) {
    return errorResponse(err);
  }
}
