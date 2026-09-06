// @polsia:user-owned — POST /api/forge-canvas/tasks/[id]/decide. Approve
// or reject a paused approval task with a REQUIRED typed reason (same
// governance rule as the mission gates: never an anonymous or reasonless
// decision). Approval resumes the run in the safe test runtime until the
// next pause or a terminal state; rejection terminates it as Rejected.

import 'server-only';
import { NextResponse } from 'next/server';
import { forgeErrorResponse, requireForgeAuth } from '@/lib/business/forge/api-helpers';
import { decideTask } from '@/lib/business/forge-canvas/service';
import { CanvasRunDetail, TaskDecide } from '@/lib/contracts/forge-canvas';

export const dynamic = 'force-dynamic';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireForgeAuth(req);
  if (auth instanceof Response) return auth;
  const { id } = await params;
  const parsed = TaskDecide.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'A decision and a typed reason are required' },
      { status: 400 },
    );
  }
  try {
    const detail = await decideTask({
      taskId: id,
      userId: auth.user.id,
      isAdmin: auth.isAdmin,
      decision: parsed.data.decision,
      reasonText: parsed.data.reasonText,
    });
    return NextResponse.json(CanvasRunDetail.parse(detail));
  } catch (err) {
    return forgeErrorResponse(err);
  }
}
