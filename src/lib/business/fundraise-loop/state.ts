// @polsia:user-owned — batch state machine for the fundraise loop. Pure.
// The approval gate is enforced here and re-checked in every handler:
//
//   PENDING_APPROVAL → APPROVED | REJECTED      (human decision)
//   APPROVED         → SENDING | REJECTED       (runner claim / human reject)
//   SENDING          → SENT                     (runner records what it pushed)
//   SENDING          → APPROVED                 (ONLY via the admin `release`
//                                                action: a human confirms
//                                                nothing was pushed)
//   REJECTED, SENT   → terminal
//
// A batch can only be CLAIMED from APPROVED while the global kill switch is
// on. Once claimed it is SENDING: it can no longer be listed, claimed again,
// or rejected, so a runner crash or a kill-switch flip mid-run can never
// cause a double push. Recording /sent is allowed regardless of the kill
// switch — it records a fact.

import type { BatchStatus } from '@/lib/contracts/fundraise-loop';

const TRANSITIONS: Record<BatchStatus, readonly BatchStatus[]> = {
  PENDING_APPROVAL: ['APPROVED', 'REJECTED'],
  APPROVED: ['SENDING', 'REJECTED'],
  SENDING: ['SENT', 'APPROVED'],
  REJECTED: [],
  SENT: [],
};

export function canTransition(from: BatchStatus, to: BatchStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export class TransitionError extends Error {
  constructor(from: BatchStatus, to: BatchStatus) {
    super(`Batch cannot move from ${from} to ${to}`);
    this.name = 'TransitionError';
  }
}

export function assertTransition(from: BatchStatus, to: BatchStatus): void {
  if (!canTransition(from, to)) throw new TransitionError(from, to);
}

/** Only PENDING batches can have items skipped (edited) before approval. */
export function canEditItems(status: BatchStatus): boolean {
  return status === 'PENDING_APPROVAL';
}

/** Warm-path prospects never go in a cold send. */
export function laneFor(warmPath?: string | null): 'COLD' | 'WARM' {
  return warmPath && warmPath.trim().length > 0 ? 'WARM' : 'COLD';
}

/** The runner may claim a batch for sending only from APPROVED with the kill switch on. */
export function canClaim(status: BatchStatus, sendingEnabled: boolean): boolean {
  return status === 'APPROVED' && sendingEnabled;
}

/** Kept for callers of the original API: "may this batch start sending now?" */
export const canSend = canClaim;

/** /sent records a fact, so it only needs the claim — not the kill switch. */
export function canMarkSent(status: BatchStatus): boolean {
  return status === 'SENDING';
}

/**
 * The status an admin decision moves a batch to, given where it is now.
 * Each action is valid from exactly one source state, so e.g. `approve`
 * can never be used to un-claim a SENDING batch and `release` can never
 * approve a pending one.
 */
export function decisionTarget(
  action: 'approve' | 'reject' | 'release',
  from: BatchStatus,
): BatchStatus {
  const to: BatchStatus =
    action === 'approve' ? 'APPROVED' : action === 'reject' ? 'REJECTED' : 'APPROVED';
  const allowedFrom: readonly BatchStatus[] =
    action === 'approve'
      ? ['PENDING_APPROVAL']
      : action === 'reject'
        ? ['PENDING_APPROVAL', 'APPROVED']
        : ['SENDING'];
  if (!allowedFrom.includes(from)) throw new TransitionError(from, to);
  assertTransition(from, to);
  return to;
}
