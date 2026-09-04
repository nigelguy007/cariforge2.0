// @polsia:user-owned — POST /api/forge/missions/:id/draft. Drafts the
// project's current step output with real AI and submits it via the
// existing submitHandoff() write path — same authorization submitHandoff
// already enforces (the mission's own owner, or an admin; anyone else gets
// FORGE_FORBIDDEN, unchanged). No new schema: the AI's output is validated
// against the same contracts a human-typed handoff already goes through.

import 'server-only';
import { NextResponse } from 'next/server';
import { draftStepOutput } from '@/lib/business/forge/ai-draft';
import { forgeErrorResponse, requireForgeAuth } from '@/lib/business/forge/api-helpers';
import { getMissionDetail, submitHandoff } from '@/lib/business/forge/service';
import { StageNameValues } from '@/lib/contracts/forge';

export const dynamic = 'force-dynamic';

function summarisePriorHandoff(payload: Record<string, unknown>): string | null {
  const summary = payload.summary ?? payload.problemStatement;
  return typeof summary === 'string' && summary.trim() ? summary.trim() : null;
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireForgeAuth(req);
  if (auth instanceof Response) return auth;
  const { id } = await ctx.params;
  try {
    const detail = await getMissionDetail(id, auth.user.id, auth.isAdmin);
    if (!detail) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const stage = StageNameValues[detail.mission.currentStageIndex] ?? StageNameValues[0];
    const priorContext = detail.handoffs
      .filter((h) => h.supersededById === null && h.stage !== stage)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .map((h) => summarisePriorHandoff(h.payload as Record<string, unknown>))
      .filter((s): s is string => s !== null);

    const result = await draftStepOutput({
      stage,
      intake: detail.mission.intake,
      normalizedNeed: detail.mission.normalizedNeed,
      priorContext,
    });

    if (result.status === 'unavailable') {
      return NextResponse.json(
        {
          error:
            'CariForge could not draft this step right now. Try again shortly, or ask an admin to add it directly.',
        },
        { status: 503 },
      );
    }

    const updated = await submitHandoff({
      missionId: id,
      userId: auth.user.id,
      isAdmin: auth.isAdmin,
      stage,
      payload: result.draft.payload,
      confidence: result.draft.confidence,
      missingEvidence: [...result.draft.missingEvidence],
      toolRefs: [],
    });
    return NextResponse.json(updated, { status: 201 });
  } catch (err) {
    return forgeErrorResponse(err);
  }
}
