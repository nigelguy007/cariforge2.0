// @polsia:user-owned — extracted from /api/forge/missions/[id]/draft's own
// POST handler (2026-09-06), so the new async SoftwareBuild job route
// (build-job/route.ts) can resolve which gate to draft, with the exact
// same governance guards, instead of a second copy of this logic that
// could silently drift and reopen the real governance-bypass bug fixed
// here on 2026-09-05 (drafting the wrong gate — see that route's own
// header comment for the full incident).
import type { MissionDetailT, StageName } from '@/lib/contracts/forge';
import { nextActionFor } from './next-action';

export type DraftContext =
  | {
      readonly ok: true;
      readonly stage: StageName;
      readonly gateIndex: number;
      readonly ownerUserId: string;
      readonly priorContext: readonly string[];
      readonly feedback: readonly string[];
      readonly evidence: readonly { label: string; kind: string }[];
    }
  | { readonly ok: false; readonly status: number; readonly error: string };

function summarisePriorHandoff(payload: Record<string, unknown>): string | null {
  const summary = payload.summary ?? payload.problemStatement;
  return typeof summary === 'string' && summary.trim() ? summary.trim() : null;
}

/** Given an already-fetched MissionDetail, decides whether there's a real
 *  gate to draft right now and, if so, everything draftStepOutput/the
 *  build-job planner need to draft it — the same nextActionFor() call the
 *  /next-action endpoint and "Your next action" panel use, so this can
 *  never draft a DIFFERENT gate than what's actually shown to the human
 *  as next. */
export function resolveDraftContext(detail: MissionDetailT): DraftContext {
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
  // 'ReviseStage' (2026-09-05, user's own flow: "ask for more info -
  // simple step I add more and then resubmit") is a Returned gate that
  // genuinely needs a NEW draft — unlike 'ApproveGate', it is EXPECTED to
  // already have a handoff (the one that was returned), so the "already
  // has a draft" refusal below only applies to the fresh-draft case.
  if (view.kind !== 'ApproveGate' && view.kind !== 'ReviseStage') {
    return {
      ok: false,
      status: 409,
      error:
        'Something else needs attention on this project before CariForge can draft the next step — check the project workspace for what it is.',
    };
  }
  const gate = detail.gates.find((g) => g.gateIndex === view.gateIndex);
  if (view.kind === 'ApproveGate' && gate?.currentStageHandoffId) {
    return { ok: false, status: 409, error: 'This step already has a draft awaiting a decision.' };
  }
  const stage = view.stage;

  const priorContext = detail.handoffs
    .filter((h) => h.supersededById === null && h.stage !== stage)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map((h) => summarisePriorHandoff(h.payload as Record<string, unknown>))
    .filter((s): s is string => s !== null);

  // Only a real redraft carries feedback — the most recent Return
  // decision's own reviewer note for this exact gate.
  const feedback =
    view.kind === 'ReviseStage'
      ? detail.approvals
          .filter(
            (a) => a.gateIndex === view.gateIndex && a.decision === 'Return' && a.reasonText.trim(),
          )
          .sort((a, b) => b.at.localeCompare(a.at))
          .slice(0, 1)
          .map((a) => a.reasonText.trim())
      : [];

  const evidence = detail.evidence.map((e) => ({ label: e.label, kind: e.kind }));

  return {
    ok: true,
    stage,
    gateIndex: view.gateIndex,
    ownerUserId: detail.mission.createdById,
    priorContext,
    feedback,
    evidence,
  };
}
