// @polsia:user-owned — R7 (mission pipeline rebuild): GET
// /api/forge/missions/:id/gates/:gateIndex/qa-review. Advisory-only QA
// critique of the handoff currently sitting at this gate, computed fresh on
// each call (no persistence in this lightweight pass — see
// docs/MISSION-PIPELINE-REBUILD-PROGRESS.md). Never blocks gate decisions:
// every failure path returns { status: 'unavailable' } with a 200, not an
// error status, so a flaky reviewer can't make the Gates tab look broken.

import 'server-only';
import { NextResponse } from 'next/server';
import { requireForgeAuth } from '@/lib/business/forge/api-helpers';
import { getQAReview } from '@/lib/business/forge/qa-review';
import { getMissionDetail } from '@/lib/business/forge/service';
import { GATE_DEFS } from '@/lib/contracts/forge';
import { QAReview } from '@/lib/contracts/qa-review';

export const dynamic = 'force-dynamic';

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string; gateIndex: string }> },
) {
  const auth = await requireForgeAuth(req);
  if (auth instanceof Response) return auth;
  const { id, gateIndex } = await ctx.params;
  const parsedIdx = Number.parseInt(gateIndex, 10);
  const def = GATE_DEFS[parsedIdx];
  if (!Number.isFinite(parsedIdx) || !def) {
    return NextResponse.json({ errors: { gateIndex: 'gateIndex must be 0..4' } }, { status: 400 });
  }

  const detail = await getMissionDetail(id, auth.user.id, auth.isAdmin);
  if (!detail) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const gate = detail.gates[parsedIdx];
  const handoff = gate?.currentStageHandoffId
    ? detail.handoffs.find((h) => h.id === gate.currentStageHandoffId)
    : null;
  if (!handoff) {
    // Nothing to review yet — not an error, just nothing has been handed
    // off to this gate.
    return NextResponse.json(QAReview.parse({ status: 'unavailable' }), { status: 200 });
  }

  const review = await getQAReview({
    missionName: detail.mission.name,
    gateName: def.name,
    stage: def.stage,
    intake: detail.mission.intake,
    handoffPayload: handoff.payload,
  });
  return NextResponse.json(QAReview.parse(review), { status: 200 });
}
