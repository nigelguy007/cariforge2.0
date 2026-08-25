// @polsia:user-owned — GET /api/forge/missions/:id/next-action.

import 'server-only';
import { NextResponse } from 'next/server';
import { forgeErrorResponse, requireForgeAuth } from '@/lib/business/forge/api-helpers';
import {
  isMissionTerminal,
  nextActionBlockers,
  nextActionFor,
} from '@/lib/business/forge/next-action';
import { getMissionDetail } from '@/lib/business/forge/service';
import { NextActionResponse } from '@/lib/contracts/forge';

export const dynamic = 'force-dynamic';

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireForgeAuth(req);
  if (auth instanceof Response) return auth;
  const { id } = await ctx.params;
  try {
    const detail = await getMissionDetail(id, auth.user.id, auth.isAdmin);
    if (!detail) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const view = nextActionFor({
      status: detail.mission.status,
      gates: detail.gates,
      approvals: detail.approvals,
      objections: detail.objections,
      toolActions: detail.toolActions.map((t) => ({
        id: t.id,
        decision: t.decision,
        tool: t.tool,
        scope: t.scope,
      })),
      workItems: detail.workItems ?? [],
    });
    const blockers = nextActionBlockers({
      status: detail.mission.status,
      gates: detail.gates,
      approvals: detail.approvals,
      objections: detail.objections,
      toolActions: detail.toolActions.map((t) => ({
        id: t.id,
        decision: t.decision,
        tool: t.tool,
        scope: t.scope,
      })),
      workItems: detail.workItems ?? [],
    });
    const response = NextActionResponse.parse({
      view,
      blockers,
      isTerminal: isMissionTerminal(detail.mission.status),
    });
    return NextResponse.json(response, { status: 200 });
  } catch (err) {
    return forgeErrorResponse(err);
  }
}
