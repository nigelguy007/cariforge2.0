// @polsia:user-owned — GET /api/forge-canvas/tasks. The Approval Desk
// inbox: open tasks first, then recently-decided, each carrying the
// upstream evidence the approver must see before deciding (handover §17).

import 'server-only';
import { NextResponse } from 'next/server';
import { requireForgeAuth } from '@/lib/business/forge/api-helpers';
import { listTasks } from '@/lib/business/forge-canvas/service';
import { CanvasTaskList } from '@/lib/contracts/forge-canvas';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const auth = await requireForgeAuth(req);
  if (auth instanceof Response) return auth;
  return NextResponse.json(CanvasTaskList.parse(await listTasks(auth.user.id, auth.isAdmin)));
}
