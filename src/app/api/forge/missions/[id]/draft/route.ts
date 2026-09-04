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
import { reviewAndMaybeAdvance } from '@/lib/business/forge/auto-advance';
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

    // The new handoff — the latest, non-superseded one for this stage.
    const newHandoff = updated.handoffs.find((h) => h.stage === stage && h.supersededById === null);
    if (newHandoff) {
      const draftSummary =
        (result.draft.payload.summary as string | undefined) ??
        (result.draft.payload.problemStatement as string | undefined) ??
        JSON.stringify(result.draft.payload);
      await reviewAndMaybeAdvance({
        missionId: id,
        ownerUserId: updated.mission.createdById,
        gateIndex: newHandoff.gateIndexThatApproves,
        stage,
        handoffId: newHandoff.id,
        draftSummary,
        draftConfidence: result.draft.confidence,
        draftMissingEvidence: result.draft.missingEvidence,
      });
    }

    const final = (await getMissionDetail(id, auth.user.id, auth.isAdmin)) ?? updated;
    return NextResponse.json(final, { status: 201 });
  } catch (err) {
    return forgeErrorResponse(err);
  }
}
