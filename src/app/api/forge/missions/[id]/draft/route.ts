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
import 'server-only';
import { NextResponse } from 'next/server';
import { draftStepOutput } from '@/lib/business/forge/ai-draft';
import { forgeErrorResponse, requireForgeAuth } from '@/lib/business/forge/api-helpers';
import { reviewAndMaybeAdvance } from '@/lib/business/forge/auto-advance';
import { nextActionFor } from '@/lib/business/forge/next-action';
import { getMissionDetail, submitHandoff } from '@/lib/business/forge/service';

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
    // 'ReviseStage' (added 2026-09-05, user's own flow: "ask for more
    // info - simple step I add more and then resubmit") is a Returned
    // gate that genuinely needs a NEW draft — unlike 'ApproveGate', it is
    // EXPECTED to already have a handoff (the one that was returned), so
    // the "already has a draft" refusal below only applies to the fresh-
    // draft case.
    if (view.kind !== 'ApproveGate' && view.kind !== 'ReviseStage') {
      return NextResponse.json(
        {
          error:
            'Something else needs attention on this project before CariForge can draft the next step — check the project workspace for what it is.',
        },
        { status: 409 },
      );
    }
    const gate = detail.gates.find((g) => g.gateIndex === view.gateIndex);
    if (view.kind === 'ApproveGate' && gate?.currentStageHandoffId) {
      return NextResponse.json(
        { error: 'This step already has a draft awaiting a decision.' },
        { status: 409 },
      );
    }
    const stage = view.stage;

    const priorContext = detail.handoffs
      .filter((h) => h.supersededById === null && h.stage !== stage)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .map((h) => summarisePriorHandoff(h.payload as Record<string, unknown>))
      .filter((s): s is string => s !== null);

    // Only a real redraft carries feedback — the most recent Return
    // decision's own reviewer note for this exact gate. ai-draft.ts
    // already had a `feedback` param built for precisely this ("prior
    // attempt... unresolved reviewer concerns"); nothing ever populated
    // it until now.
    const feedback =
      view.kind === 'ReviseStage'
        ? detail.approvals
            .filter(
              (a) =>
                a.gateIndex === view.gateIndex && a.decision === 'Return' && a.reasonText.trim(),
            )
            .sort((a, b) => b.at.localeCompare(a.at))
            .slice(0, 1)
            .map((a) => a.reasonText.trim())
        : [];

    // Real gap found live (2026-09-05, functionality pass benchmarked
    // against Kore.ai's Search/Knowledge AI pillar): attached Evidence
    // was fetched onto `detail` this whole time and never once reached
    // the agent drafting the step — grepped ai-draft.ts to confirm it
    // only ever read intake/normalizedNeed/priorContext.
    const evidence = detail.evidence.map((e) => ({ label: e.label, kind: e.kind }));

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
