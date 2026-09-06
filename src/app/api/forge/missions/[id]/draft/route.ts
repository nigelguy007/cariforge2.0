// @polsia:user-owned — POST /api/forge/missions/:id/draft. Drafts the
// project's current step output with real AI and submits it via the
// existing submitHandoff() write path — same authorization submitHandoff
// already enforces (the mission's own owner, or an admin; anyone else gets
// FORGE_FORBIDDEN, unchanged). No new schema: the AI's output is validated
// against the same contracts a human-typed handoff already goes through.
//
// Real governance-bypass bug found live (2026-09-05), fixed here: this
// used to pick the stage to draft from `mission.currentStageIndex` —
// but submitHandoff bumps currentStageIndex the moment a handoff is
// SUBMITTED (Math.max(current, gateIndexFor(stage)+1)), well before that
// gate is actually DECIDED. Confirmed on a real mission: Discovery's own
// gate 0 had never been approved (zero Approval rows existed), yet a
// second "Draft with AI" click — made after the human resolved Discovery's
// objections but before ever approving gate 0 — happily drafted and
// auto-reviewed a real Readiness (gate 1) step output instead, skipping
// gate 0's approval entirely. Now asks nextActionFor() for the gate that
// ACTUALLY still needs a decision (the same function powering the
// /next-action endpoint and the "Your next action" panel) and refuses to
// draft anything else — including refusing outright if that gate already
// has a handoff (matching NextActionCard's own "Draft with AI" button
// visibility, so this can never draft over an existing undecided step).
// That guard now lives in draft-context.ts's resolveDraftContext, shared
// with build-job/route.ts, so both paths enforce it identically.
//
// SoftwareBuild redirect (2026-09-06, real production incident: the AI
// call this stage makes is deliberately sized for ~150s — a real MVP's
// file/spec generation genuinely takes that long — but this Vercel
// project's Hobby plan kills any function at 60s, which is exactly what
// was happening, live, as "says Working… then crashes"). User's explicit
// choice over upgrading to Vercel Pro: this ONE stage is now handled by
// build-job/route.ts's resumable, chunked job instead of the single
// synchronous draftStepOutput call below — see that route and
// business/forge/build-job.ts for the full design. The other four stages
// are unaffected; their drafts are fast enough to finish well inside 60s
// and keep using this endpoint exactly as before.
import 'server-only';
import { NextResponse } from 'next/server';
import { draftStepOutput } from '@/lib/business/forge/ai-draft';
import { forgeErrorResponse, requireForgeAuth } from '@/lib/business/forge/api-helpers';
import { reviewAndMaybeAdvance } from '@/lib/business/forge/auto-advance';
import { resolveDraftContext } from '@/lib/business/forge/draft-context';
import { getMissionDetail, submitHandoff } from '@/lib/business/forge/service';

export const dynamic = 'force-dynamic';

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireForgeAuth(req);
  if (auth instanceof Response) return auth;
  const { id } = await ctx.params;
  try {
    const detail = await getMissionDetail(id, auth.user.id, auth.isAdmin);
    if (!detail) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const ctxResult = resolveDraftContext(detail);
    if (!ctxResult.ok) {
      return NextResponse.json({ error: ctxResult.error }, { status: ctxResult.status });
    }
    const { stage, priorContext, feedback, evidence } = ctxResult;

    if (stage === 'SoftwareBuild') {
      return NextResponse.json(
        {
          error:
            'The Build stage now runs as a resumable job — call POST .../build-job instead of .../draft for this stage.',
        },
        { status: 409 },
      );
    }

    const result = await draftStepOutput({
      stage,
      intake: detail.mission.intake,
      normalizedNeed: detail.mission.normalizedNeed,
      priorContext,
      feedback,
      evidence,
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
