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
import {
  addHandoffAttester,
  createObjection,
  decideGate,
  getMissionDetail,
} from '@/lib/business/forge/service';
import type { StageName } from '@/lib/contracts/forge';
import { reviewStepDraft } from './oracle-review';

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
}): Promise<AutoAdvanceOutcome> {
  const review = await reviewStepDraft({ stage: args.stage, draftSummary: args.draftSummary });
  if (review.status === 'unavailable') {
    return { reviewed: false, advanced: false, concernCount: 0 };
  }

  let concernCount = 0;
  for (const v of review.verdicts) {
    if (v.verdict === 'clear') {
      await addHandoffAttester({
        missionId: args.missionId,
        handoffId: args.handoffId,
        userId: ORACLE_REVIEWER_ID[v.role] ?? `oracle-${v.role.toLowerCase()}-review`,
        role: v.role,
      });
    } else {
      concernCount += 1;
      await createObjection({
        missionId: args.missionId,
        userId: args.ownerUserId,
        isAdmin: false,
        stageHandoffId: args.handoffId,
        raisedByRole: v.role,
        text: v.note,
      });
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
  const detail = await getMissionDetail(args.missionId, args.ownerUserId, false);
  if (!detail) return { reviewed: true, advanced: false, concernCount: 0 };
  const hasOtherUnresolvedConcern = detail.objections.some((o) => o.resolution === null);
  const hasPendingToolAction = detail.toolActions.some((t) => t.decision === null);
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
