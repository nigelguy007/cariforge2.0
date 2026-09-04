// @polsia:user-owned — one small hook behind the Approvals nav badge and the
// queue heading: how many decisions need the signed-in person right now.
// Counts projects sitting at AwaitingApproval plus open canvas approval
// tasks — the same two sources the /approvals queue renders. Read-only.

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

export function useApprovalsCount(refreshKey = 0): ApprovalsCount {
  const [count, setCount] = React.useState<ApprovalsCount>(EMPTY);

  // refreshKey is a caller-owned tick: bumping it re-runs the fetch after a
  // decision lands, so the badge and heading update without a reload.
  // biome-ignore lint/correctness/useExhaustiveDependencies: refreshKey is an intentional trigger
  React.useEffect(() => {
    let cancelled = false;
    Promise.all([
      apiFetch('/api/forge/missions', { schema: MissionList })
        .then((r) => r.items.filter((m) => m.status === 'AwaitingApproval').length)
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
  }, [refreshKey]);

  return count;
}
