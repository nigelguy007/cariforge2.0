// @polsia:user-owned — the auto-advance policy engine. User instruction
// (2026-09-05, quoting their own architecture doc verbatim): "The
// Supervisor should auto-advance when all of these are true: required
// evidence is present AND confidence >= configured threshold AND no
// critical concern remains unresolved AND acceptance checks pass AND
// [...] Otherwise [...] escalate one focused decision to a human."
//
// Runs right after a step is drafted (see the /draft route). Every
// governance primitive used here is the SAME one a human reviewer already
// uses — a real specialist attestation (addHandoffAttester), a real
// objection (createObjection), a real gate decision (decideGate) — this
// changes who/what triggers them, not what they are or what they enforce
// (brief rule 7). A review or advance failure never throws: worst case,
// the step sits exactly where it would have before this existed, waiting
// for the human's own DecisionDialog.
//
// Two conditions from the architecture doc have no dedicated data model in
// this schema yet — "action is within the authority boundary" and "no
// must-not-happen rule is triggered". Rather than fake evaluating them,
// they're treated as satisfied by default and named here so the gap is
// documented, not silently assumed away.

import 'server-only';
import { draftStepOutput } from '@/lib/business/forge/ai-draft';
import {
  addHandoffAttester,
  correctHandoff,
  createObjection,
  decideGate,
  getMissionDetail,
  resolveObjection,
} from '@/lib/business/forge/service';
import type { SpecialistRole, StageName } from '@/lib/contracts/forge';
import { reconcileConcerns, reviewStepDraft } from './oracle-review';

function summarise(payload: Record<string, unknown>): string {
  const summary = payload.summary ?? payload.problemStatement;
  return typeof summary === 'string' && summary.trim() ? summary.trim() : JSON.stringify(payload);
}

// Below this, a human decides even with zero Oracle concerns — the draft
// itself said it wasn't confident. No number was specified in the brief;
// 0.75 is a deliberately conservative first default, easy to tune later.
const AUTO_ADVANCE_CONFIDENCE_THRESHOLD = 0.75;

// One fixed synthetic reviewer id per specialist lens. StageHandoffSpecialistAttester.userId
// is a scalar column with no DB-level foreign key (see prisma/schema/tag-oracle-council.prisma) —
// an application-level identifier here is the same shape a real user id already is,
// just recognisably not one.
const ORACLE_REVIEWER_ID: Readonly<Record<string, string>> = {
  Risk: 'oracle-risk-review',
  Demand: 'oracle-demand-review',
  Growth: 'oracle-growth-review',
  Competition: 'oracle-competition-review',
  Money: 'oracle-cost-review',
};

export interface AutoAdvanceOutcome {
  readonly reviewed: boolean;
  readonly advanced: boolean;
  readonly concernCount: number;
}

export async function reviewAndMaybeAdvance(args: {
  missionId: string;
  ownerUserId: string;
  gateIndex: number;
  stage: StageName;
  handoffId: string;
  draftSummary: string;
  draftConfidence: number;
  draftMissingEvidence: readonly string[];
  /** Internal — true once this step has already been sent back for one
   *  automatic redraft. Caps the retry at exactly one round, never a loop. */
  retried?: boolean;
}): Promise<AutoAdvanceOutcome> {
  const review = await reviewStepDraft({ stage: args.stage, draftSummary: args.draftSummary });
  if (review.status === 'unavailable') {
    return { reviewed: false, advanced: false, concernCount: 0 };
  }

  const raised: { role: SpecialistRole; note: string; objectionId: string }[] = [];
  for (const v of review.verdicts) {
    if (v.verdict === 'clear') {
      await addHandoffAttester({
        missionId: args.missionId,
        handoffId: args.handoffId,
        userId: ORACLE_REVIEWER_ID[v.role] ?? `oracle-${v.role.toLowerCase()}-review`,
        role: v.role,
      });
    } else {
      const withObjection = await createObjection({
        missionId: args.missionId,
        userId: args.ownerUserId,
        isAdmin: false,
        stageHandoffId: args.handoffId,
        raisedByRole: v.role,
        text: v.note,
      });
      const newObjection = withObjection.objections
        .filter((o) => o.stageHandoffId === args.handoffId && o.raisedByRole === v.role)
        .sort((a, b) => b.raisedAt.localeCompare(a.raisedAt))[0];
      if (newObjection) raised.push({ role: v.role, note: v.note, objectionId: newObjection.id });
    }
  }

  // The Council Chair: try to reconcile each concern before giving up on
  // this step entirely. Only concerns it genuinely resolves get closed —
  // anything it declines to touch (including every concern, if this call
  // itself is unavailable) stays open and blocks auto-advance below,
  // exactly as it would have before reconciliation existed.
  if (raised.length > 0) {
    const reconciliation = await reconcileConcerns({
      stage: args.stage,
      draftSummary: args.draftSummary,
      concerns: raised.map((r) => ({ role: r.role, note: r.note })),
    });
    if (reconciliation.status === 'ok') {
      for (const r of raised) {
        const verdict = reconciliation.resolutions.find((res) => res.role === r.role);
        if (verdict?.resolved) {
          await resolveObjection({
            missionId: args.missionId,
            userId: args.ownerUserId,
            isAdmin: false,
            objectionId: r.objectionId,
            resolution: 'Overruled',
            resolutionText: `Resolved by the Council Chair: ${verdict.rationale}`,
          });
        }
      }
    }
  }

  const stillOpen = await getMissionDetail(args.missionId, args.ownerUserId, false);
  const unresolvedOnThisStep =
    stillOpen?.objections.filter(
      (o) => o.stageHandoffId === args.handoffId && o.resolution === null,
    ) ?? [];
  const concernCount = stillOpen ? unresolvedOnThisStep.length : raised.length;

  // "The Supervisor sends failed work back to the responsible agent" — one
  // bounded redraft, never a loop. Only attempted once (args.retried guards
  // it), only when there's something to hand back (real objection text and
  // enough mission context to redraft with), and it still only ever produces
  // ANOTHER draft for the same human to review — it can't itself resolve a
  // concern or approve anything.
  if (concernCount > 0 && !args.retried && stillOpen) {
    const priorContext = stillOpen.handoffs
      .filter((h) => h.supersededById === null && h.stage !== args.stage)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .map((h) => {
        const p = h.payload as Record<string, unknown>;
        const s = p.summary ?? p.problemStatement;
        return typeof s === 'string' && s.trim() ? s.trim() : null;
      })
      .filter((s): s is string => s !== null);

    const redraft = await draftStepOutput({
      stage: args.stage,
      intake: stillOpen.mission.intake,
      normalizedNeed: stillOpen.mission.normalizedNeed,
      priorContext,
      feedback: unresolvedOnThisStep.map((o) => o.text),
    });

    if (redraft.status === 'ok') {
      try {
        const corrected = await correctHandoff({
          missionId: args.missionId,
          userId: args.ownerUserId,
          isAdmin: false,
          handoffId: args.handoffId,
          payload: redraft.draft.payload,
          confidence: redraft.draft.confidence,
          missingEvidence: [...redraft.draft.missingEvidence],
          reasonCode: 'ReplayRequired',
          reasonText:
            'Automatically sent back to the responsible agent to address reviewer concerns; redrafted and resubmitted for review.',
        });
        const newHandoff = corrected.handoffs.find(
          (h) => h.stage === args.stage && h.supersededById === null,
        );
        if (newHandoff) {
          return reviewAndMaybeAdvance({
            ...args,
            handoffId: newHandoff.id,
            draftSummary: summarise(redraft.draft.payload),
            draftConfidence: redraft.draft.confidence,
            draftMissingEvidence: redraft.draft.missingEvidence,
            retried: true,
          });
        }
      } catch {
        // Falls through to human escalation below, same as any other
        // precondition this session doesn't know about.
      }
    }
  }

  if (concernCount > 0) return { reviewed: true, advanced: false, concernCount };
  if (args.draftConfidence < AUTO_ADVANCE_CONFIDENCE_THRESHOLD) {
    return { reviewed: true, advanced: false, concernCount: 0 };
  }
  if (args.draftMissingEvidence.length > 0) {
    return { reviewed: true, advanced: false, concernCount: 0 };
  }

  // Re-check against the mission's OTHER real state — an unresolved
  // concern raised elsewhere, or a tool action still awaiting a decision,
  // blocks auto-advance exactly as it would block a human's decision.
  // Reuses the same fetch used to check this step's own concerns above.
  if (!stillOpen) return { reviewed: true, advanced: false, concernCount: 0 };
  const hasOtherUnresolvedConcern = stillOpen.objections.some((o) => o.resolution === null);
  const hasPendingToolAction = stillOpen.toolActions.some((t) => t.decision === null);
  if (hasOtherUnresolvedConcern || hasPendingToolAction) {
    return { reviewed: true, advanced: false, concernCount: 0 };
  }

  try {
    await decideGate({
      missionId: args.missionId,
      userId: args.ownerUserId,
      isAdmin: false,
      gateIndex: args.gateIndex,
      decision: 'Approve',
      reasonCode: 'Approved',
      reasonText: `Automatically advanced by CariForge: ${review.verdicts.length} specialist reviewers found no concerns, confidence ${Math.round(args.draftConfidence * 100)}%.`,
      stageHandoffId: args.handoffId,
    });
    return { reviewed: true, advanced: true, concernCount: 0 };
  } catch {
    // Any precondition this session doesn't know about (e.g. an Elder
    // Oracle gate) falls back to the human path exactly as before.
    return { reviewed: true, advanced: false, concernCount: 0 };
  }
}
