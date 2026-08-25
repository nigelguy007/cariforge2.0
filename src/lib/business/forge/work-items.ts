// @polsia:user-owned — pure work-item derivation + bounded transitions.
// No DB. Drives /api/forge/missions/:id/work-items/* routes.

import type { StageName, WorkItemStatusT } from '@/lib/contracts/forge';

export interface WorkItemRecord {
  id: string;
  status: WorkItemStatusT;
  closedAt: string | null;
  supersededById: string | null;
}

// Per-stage handoff payload items the workflow handoff may declare. We DO NOT
// mutate them here — we just shape-assert and pass through for blueprint.
export interface WorkflowItemSeed {
  title: string;
  scope: string;
  acceptanceCriteria: string;
  ownerUserId?: string | undefined;
}

// isValidTransition — bounded status state machine for work items.
const ALLOWED: Record<WorkItemStatusT, readonly WorkItemStatusT[]> = {
  Open: ['InProgress', 'Deferred', 'Failed'],
  InProgress: ['InTest', 'Rework', 'Deferred', 'Failed'],
  InTest: ['Passed', 'Rework', 'Failed', 'Deferred'],
  Rework: ['InTest', 'Failed', 'Deferred'],
  Passed: [],
  Failed: ['Rework', 'Deferred'],
  Deferred: ['Open', 'InProgress'],
};

export function isValidWorkItemTransition(from: WorkItemStatusT, to: WorkItemStatusT): boolean {
  return ALLOWED[from].includes(to);
}

export function isTerminalWorkItemStatus(status: WorkItemStatusT): boolean {
  return ALLOWED[status].length === 0;
}

// progressSummary — pure aggregate over a work-item list.
export interface WorkItemSummary {
  total: number;
  open: number;
  inProgress: number;
  inTest: number;
  rework: number;
  passed: number;
  failed: number;
  deferred: number;
  closed: number;
  pctPassed: number;
  isComplete: boolean;
}

export function progressSummary(items: readonly WorkItemRecord[]): WorkItemSummary {
  let open = 0;
  let inProgress = 0;
  let inTest = 0;
  let rework = 0;
  let passed = 0;
  let failed = 0;
  let deferred = 0;
  let closed = 0;
  for (const item of items) {
    switch (item.status) {
      case 'Open':
        open++;
        break;
      case 'InProgress':
        inProgress++;
        break;
      case 'InTest':
        inTest++;
        break;
      case 'Rework':
        rework++;
        break;
      case 'Passed':
        passed++;
        closed++;
        break;
      case 'Failed':
        failed++;
        closed++;
        break;
      case 'Deferred':
        deferred++;
        break;
    }
  }
  const pctPassed = items.length === 0 ? 0 : passed / items.length;
  return {
    total: items.length,
    open,
    inProgress,
    inTest,
    rework,
    passed,
    failed,
    deferred,
    closed,
    pctPassed,
    isComplete: items.length > 0 && inProgress + inTest + rework + open === 0 && failed === 0,
  };
}

// deriveWorkItemIdempotency — stable id derivation stub kept for parity.
export function sourceStageForWorkItems(seed: { stage: StageName }): StageName {
  return seed.stage;
}
