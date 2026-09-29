// @polsia:user-owned — batch state machine for the fundraise loop. Pure.
// The approval gate is enforced here and re-checked in every handler: a batch
// can only be sent from APPROVED, and only when the global kill switch is on.

import type { BatchStatus } from '@/lib/contracts/fundraise-loop';

const TRANSITIONS: Record<BatchStatus, readonly BatchStatus[]> = {
  PENDING_APPROVAL: ['APPROVED', 'REJECTED'],
  APPROVED: ['SENT', 'REJECTED'],
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

export function canSend(status: BatchStatus, sendingEnabled: boolean): boolean {
  return status === 'APPROVED' && sendingEnabled;
}
