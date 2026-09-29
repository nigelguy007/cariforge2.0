// @polsia:user-owned — POST /api/admin/fundraise/prospects/[id]/intro. Marks
// a queued warm-path prospect as intro-requested (the founder asked the
// connector for the introduction).

import 'server-only';
import { NextResponse } from 'next/server';
import { errorResponse, requireAdminSession } from '@/lib/business/fundraise-loop/http';
import { markIntroRequested } from '@/lib/business/fundraise-loop/store';

export const dynamic = 'force-dynamic';

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdminSession();
  if (admin.response) return admin.response;
  const { id } = await params;
  try {
    await markIntroRequested(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
