// @polsia:user-owned — PATCH /api/admin/fundraise/config. Tuning knobs and
// the global sending kill switch.

import 'server-only';
import { NextResponse } from 'next/server';
import { errorResponse, parseBody, requireAdminSession } from '@/lib/business/fundraise-loop/http';
import { updateConfig } from '@/lib/business/fundraise-loop/store';
import { ConfigUpdate } from '@/lib/contracts/fundraise-loop';

export const dynamic = 'force-dynamic';

export async function PATCH(req: Request) {
  const admin = await requireAdminSession();
  if (admin.response) return admin.response;
  const body = await parseBody(req, ConfigUpdate);
  if (body.response) return body.response;
  try {
    await updateConfig(body.data);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
