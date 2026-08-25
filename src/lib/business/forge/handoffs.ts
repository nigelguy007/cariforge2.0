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
        `parent version ${parent.version} must be lower than child version ${child.version}.`,
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
      `parent stage ${parent.stage} is not the immediate predecessor of ${child.stage}.`,
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
