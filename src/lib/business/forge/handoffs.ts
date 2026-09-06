// @polsia:user-owned — pure handoff versioning helpers. No DB. Called from
// /api/forge/missions/:id/handoffs and .../correction routes.

import type { StageName } from '@/lib/contracts/forge';
import { FORGE_ERROR_CODES, ForgeError } from './state-machine';

export interface HandoffRef {
  id: string;
  stage: StageName;
  version: number;
  parentVersionId: string | null;
  correctionOfId: string | null;
  supersededById: string | null;
}

// computeNextVersion — bumps version on the same stage. Pure: deterministic.
export function computeNextVersion(current: HandoffRef | null, stage: StageName): number {
  if (!current || current.stage !== stage) return 1;
  return current.version + 1;
}

// validateParent — a new handoff may carry parentVersionId only when:
//   (a) parent.stage === child.stage (same-stage versioning) OR
//   (b) parent.stage is the immediately-preceding stage (cross-stage
//       annotation, e.g. Readiness stating "this corrects my previous
//       Discovery note"). Otherwise throw.
export function validateParent(child: HandoffRef, parent: HandoffRef | null): void {
  if (!parent) return;
  if (parent.stage === child.stage) {
    if (parent.version >= child.version) {
      throw new ForgeError(
        FORGE_ERROR_CODES.VERSION_NOT_PARENT,
        `parentVersionId must point at an earlier version of this same stage (parent is v${parent.version}, this submission would be v${child.version}). Omit parentVersionId, or point it at an earlier version.`,
      );
    }
    return;
  }
  const order: readonly StageName[] = [
    'Discovery',
    'Readiness',
    'Workflow',
    'Governance',
    'SoftwareBuild',
  ];
  const parentIdx = order.indexOf(parent.stage);
  const childIdx = order.indexOf(child.stage);
  if (parentIdx < 0 || childIdx < 0 || childIdx - parentIdx !== 1) {
    throw new ForgeError(
      FORGE_ERROR_CODES.VERSION_NOT_PARENT,
      `parentVersionId must reference a handoff from either the same stage or the immediately-preceding stage — ${parent.stage} is not the immediate predecessor of ${child.stage}. Omit parentVersionId, or point it at a ${child.stage} or immediately-prior-stage handoff.`,
    );
  }
}

// markDownstreamInvalidated — given a replay-from stageIndex, identify the
// downstream stages whose handoffs must be flagged stale.
export function markDownstreamInvalidated(fromStageIndex: number): readonly StageName[] {
  const order: readonly StageName[] = [
    'Discovery',
    'Readiness',
    'Workflow',
    'Governance',
    'SoftwareBuild',
  ];
  return order.slice(fromStageIndex + 1);
}

// Real user reports (2026-09-05): "it says there are 3 outstanding
// concerns unresolved .. yet the system says they are resolved" and
// later "system says 2 unresolved concerns but nothing there" — a
// handoff is stale (no longer the live step output) once it's either
// been directly superseded (a fresh handoff exists for the same stage)
// or invalidated (a redraft/replay/rollback further upstream marked it
// as based on now-outdated information). Either way, anything hanging
// off it — most importantly, its own unresolved objections — should stop
// being treated as current. One canonical predicate, used by BOTH
// service.ts (the write path: carryForwardStaleObjections and
// getMissionDetail's self-heal) and supporting-detail.tsx (the read/
// display path: partitionObjections), so "is this handoff stale" can
// never quietly drift into two different answers between them again.
export interface StaleCheckableHandoff {
  readonly supersededById: string | null;
  readonly invalidationReasonCode: string | null;
}
export function isStaleHandoff(handoff: StaleCheckableHandoff): boolean {
  return handoff.supersededById !== null || handoff.invalidationReasonCode !== null;
}

export interface HandoffStaleRef extends StaleCheckableHandoff {
  readonly id: string;
}
export interface OrphanableObjection {
  readonly id: string;
  readonly stageHandoffId: string;
  readonly resolution: string | null;
}

/** Objections still marked unresolved (resolution: null) whose own
 *  handoff has already gone stale — real orphans that carryForward
 *  StaleObjections should already have caught at the moment the handoff
 *  went stale, but didn't for data created before that write path
 *  existed. getMissionDetail's self-heal calls this on every read so the
 *  fix reaches every mission the next time anyone actually opens it, not
 *  only ones redrafted after the fix shipped. */
export function findOrphanedObjectionIds(
  handoffs: readonly HandoffStaleRef[],
  objections: readonly OrphanableObjection[],
): string[] {
  const staleHandoffIds = new Set(handoffs.filter(isStaleHandoff).map((h) => h.id));
  return objections
    .filter((o) => o.resolution === null && staleHandoffIds.has(o.stageHandoffId))
    .map((o) => o.id);
}
