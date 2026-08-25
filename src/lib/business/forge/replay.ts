// @polsia:user-owned — pure replay planner. Given a mission's current state
// and a target fromStageIndex, returns the handoffs that must be marked
// stale and what stage the mission must be knocked back to. No DB.

import type { MissionStatus, StageName } from '@/lib/contracts/forge';
import { markDownstreamInvalidated } from './handoffs';

export interface ReplayPlan {
  readonly knocksBackToStatus: MissionStatus;
  readonly invalidatesStages: readonly StageName[];
  readonly newHandoffSeedForStage: StageName;
  readonly reasonCode: string;
}

export function replayPlan(fromStageIndex: number, reasonText: string): ReplayPlan {
  if (fromStageIndex < 0 || fromStageIndex > 4) {
    throw new Error(`replayPlan: fromStageIndex out of range: ${fromStageIndex}`);
  }
  if (!reasonText || reasonText.trim().length < 1) {
    throw new Error('replayPlan: reasonText is required.');
  }
  const order: readonly MissionStatus[] = [
    'InDiscovery',
    'InReadiness',
    'InWorkflow',
    'InGovernance',
    'InBuild',
  ];
  const newHandoffSeedForStage = (
    ['Discovery', 'Readiness', 'Workflow', 'Governance', 'SoftwareBuild'] as const
  )[fromStageIndex] as StageName;
  return {
    knocksBackToStatus: order[fromStageIndex] ?? 'InDiscovery',
    invalidatesStages: markDownstreamInvalidated(fromStageIndex),
    newHandoffSeedForStage,
    reasonCode: 'ReplayRequired',
  };
}
