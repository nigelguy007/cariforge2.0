// @polsia:user-owned — one small hook behind the Approvals nav badge and the
// queue heading: how many decisions need the signed-in person right now.
// Counts projects at AwaitingApproval OR sitting on a real open concern
// (see the 2026-09-05 fix below), plus open canvas approval tasks — the
// same sources the /approvals queue renders. Read-only.

'use client';

import * as React from 'react';
import { apiFetch } from '@/lib/api-client';
import { MissionList } from '@/lib/contracts/forge';
import { CanvasTaskList } from '@/lib/contracts/forge-canvas';

export interface ApprovalsCount {
  readonly total: number;
  readonly projects: number;
  readonly runs: number;
  readonly loaded: boolean;
}

const EMPTY: ApprovalsCount = { total: 0, projects: 0, runs: 0, loaded: false };

// Dispatched on window by any surface that records a decision (the project
// workspace, the approvals queue). The nav badge listens and refetches, so
// the count is right without a page reload or prop-drilling a refresh key.
export const APPROVALS_CHANGED_EVENT = 'cariforge:approvals-changed';

export function useApprovalsCount(refreshKey = 0): ApprovalsCount {
  const [count, setCount] = React.useState<ApprovalsCount>(EMPTY);
  const [tick, setTick] = React.useState(0);

  React.useEffect(() => {
    const onChanged = () => setTick((t) => t + 1);
    window.addEventListener(APPROVALS_CHANGED_EVENT, onChanged);
    return () => window.removeEventListener(APPROVALS_CHANGED_EVENT, onChanged);
  }, []);

  // refreshKey is a caller-owned tick: bumping it re-runs the fetch after a
  // decision lands, so the badge and heading update without a reload.
  // biome-ignore lint/correctness/useExhaustiveDependencies: refreshKey and tick are intentional triggers
  React.useEffect(() => {
    let cancelled = false;
    Promise.all([
      // Same fix as approvals-queue.tsx (2026-09-05): status alone misses
      // every Draft-status project sitting on a real open concern.
      apiFetch('/api/forge/missions', { schema: MissionList })
        .then(
          (r) => r.items.filter((m) => m.status === 'AwaitingApproval' || m.hasOpenConcern).length,
        )
        .catch(() => 0),
      apiFetch('/api/forge-canvas/tasks', { schema: CanvasTaskList })
        .then((r) => r.items.filter((t) => t.status === 'Open').length)
        .catch(() => 0),
    ]).then(([projects, runs]) => {
      if (cancelled) return;
      setCount({ projects, runs, total: projects + runs, loaded: true });
    });
    return () => {
      cancelled = true;
    };
  }, [refreshKey, tick]);

  return count;
}
