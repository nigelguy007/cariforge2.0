// @polsia:user-owned — pure lifecycle state machine for CARI Forge.
// No DB. The /api/forge/* handlers call into these helpers; the unit tests
// cover every cell of the transition table deterministically.

import type { MissionStatus, StageName } from '@/lib/contracts/forge';
import { GATE_DEFS } from '@/lib/contracts/forge';

export const FORGE_ERROR_CODES = {
  TRANSITION_INVALID: 'FORGE_TRANSITION_INVALID',
  GATE_LOCKED: 'FORGE_GATE_LOCKED',
  STAGE_MISMATCH: 'FORGE_STAGE_MISMATCH',
  VERSION_NOT_PARENT: 'FORGE_VERSION_NOT_PARENT',
  REASON_NOT_PERMITTED: 'FORGE_REASON_NOT_PERMITTED',
  ATTRIBUTION_MISSING: 'FORGE_ATTRIBUTION_MISSING',
  TOOL_SCOPE_DENIED: 'FORGE_TOOL_SCOPE_DENIED',
  TOOL_GATE_APPROVAL_MISSING: 'FORGE_TOOL_GATE_APPROVAL_MISSING',
  TOOL_ROLLBACK_TARGET_INVALID: 'FORGE_TOOL_ROLLBACK_TARGET_INVALID',
  MISSION_PAUSED: 'FORGE_MISSION_PAUSED',
  TERMINAL: 'FORGE_TERMINAL',
} as const;

export class ForgeError extends Error {
  constructor(
    public readonly code: (typeof FORGE_ERROR_CODES)[keyof typeof FORGE_ERROR_CODES],
    // `detail` is the human-readable, action-oriented text a caller
    // wrote for this specific violation — kept as its own field (not
    // just baked into `.message`) so forgeErrorResponse can surface it
    // to the client directly instead of parsing the "CODE: detail"
    // string or falling back to a generic message.
    public readonly detail: string,
  ) {
    super(`${code}: ${detail}`);
    this.name = 'ForgeError';
  }
}

// === Allowed transitions ===================================================
// The FROM → TO map below is the canonical lifecycle. Edges encode:
//
//   Draft → InDiscovery (start transition once Discovery handoff v1 exists
//     and gate 0 has been approved)
//   InDiscovery → AwaitingApproval (Readiness handoff v1 submitted)
//   InReadiness → AwaitingApproval (Workflow handoff v1 submitted)
//   InWorkflow → AwaitingApproval (Governance handoff v1 submitted)
//   InGovernance → AwaitingApproval (SoftwareBuild handoff v1 submitted)
//   InBuild → Completed (gate 4 Approved)
//   AwaitingApproval → Returned-to-stage status (gate Return with reason)
//   AwaitingApproval → Rejected (gate Refuse — "Stop this project" is a
//     permanent stop per its own UI copy, so it lands on the real
//     terminal status, not a resumable one)
//   Any active → Paused
//   Paused → previous active status (Resume)
//   Active target → Rejected / WalkedAway / RolledBack (final rejections)
//   Replay: any active stage → earlier-stage status (status knocked back)
//
// The map is deliberately DEPLETED (one directed edge per pair) so that
// tests can assert exhaustively: any edge not in this set throws
// FORGE_TRANSITION_INVALID.

export const transitions: Record<MissionStatus, MissionStatus[]> = {
  Draft: ['InDiscovery', 'Paused', 'WalkedAway'],
  InDiscovery: ['AwaitingApproval', 'InDiscovery', 'Paused', 'WalkedAway', 'RolledBack'],
  AwaitingApproval: [
    'InDiscovery',
    'InReadiness',
    'InWorkflow',
    'InGovernance',
    'InBuild',
    'Completed',
    'Paused',
    'Rejected',
    'WalkedAway',
    'RolledBack',
  ],
  InReadiness: ['AwaitingApproval', 'InReadiness', 'Paused', 'WalkedAway', 'RolledBack'],
  InWorkflow: ['AwaitingApproval', 'InWorkflow', 'Paused', 'WalkedAway', 'RolledBack'],
  InGovernance: ['AwaitingApproval', 'InGovernance', 'Paused', 'WalkedAway', 'RolledBack'],
  InBuild: ['AwaitingApproval', 'Completed', 'Paused', 'WalkedAway', 'RolledBack'],
  Paused: [
    'Draft',
    'InDiscovery',
    'InReadiness',
    'InWorkflow',
    'InGovernance',
    'InBuild',
    'WalkedAway',
  ],
  Blocked: ['Paused', 'WalkedAway'],
  Rejected: [],
  Completed: [],
  WalkedAway: [],
  RolledBack: ['Draft', 'InDiscovery', 'InReadiness', 'InWorkflow', 'InGovernance', 'Paused'],
};

export const TERMINAL_STATUSES: ReadonlySet<MissionStatus> = new Set([
  'Rejected',
  'Completed',
  'WalkedAway',
]);

export function assertTransition(from: MissionStatus, to: MissionStatus): void {
  if (TERMINAL_STATUSES.has(from)) {
    throw new ForgeError(
      FORGE_ERROR_CODES.TRANSITION_INVALID,
      `Mission is terminal (${from}); no further transitions allowed.`,
    );
  }
  const allowed = transitions[from] ?? [];
  if (!allowed.includes(to)) {
    throw new ForgeError(
      FORGE_ERROR_CODES.TRANSITION_INVALID,
      `Transition ${from} -> ${to} is not permitted.`,
    );
  }
}

// Map a stage to the gate index that authorises entry into it.
export function gateIndexFor(stage: StageName): number {
  const idx = GATE_DEFS.findIndex((g) => g.stage === stage);
  if (idx < 0) throw new ForgeError(FORGE_ERROR_CODES.GATE_LOCKED, `Unknown stage: ${stage}`);
  return idx;
}

// nextStageFor: given a gate-approval decision, what's the next mission
// status? Pure: drives /api/forge/missions/:id/gates/:gateIndex/decide
// and /api/forge/missions/:id/transitions/start. `gateIndex` is the gate
// that was just Approved — the mission moves INTO the stage that approval
// unlocks (gate 0's own purpose, per GATE_DEFS, is "confirm the need is
// real... [so Readiness can start]" — approving it means Discovery is
// DONE, not that we're still in it). Approving gate 4 (SoftwareBuild)
// closes the mission (Completed).
//
// FIXED 2026-09-04: every case below used to return the CURRENT stage
// instead of the next one (case 0 returned 'InDiscovery', not
// 'InReadiness' — an off-by-one present in every case except 4, which had
// nowhere further to be off into). Found by actually walking a real
// mission through gate 0 end-to-end: the mission's status never left
// InDiscovery after gate 0 was genuinely approved. The stale unit test
// below had been asserting the bug as if it were correct — see its
// history for what it checked before this fix.
export function nextStageFor(gateIndex: number): MissionStatus {
  switch (gateIndex) {
    case 0:
      return 'InReadiness';
    case 1:
      return 'InWorkflow';
    case 2:
      return 'InGovernance';
    case 3:
      return 'InBuild';
    case 4:
      return 'Completed';
    default:
      throw new ForgeError(FORGE_ERROR_CODES.GATE_LOCKED, `Unknown gate index: ${gateIndex}`);
  }
}

// resumeTargetStatus: when leaving Paused, what status do we resume to?
// Stored on Mission.previousStatus at pause-time.
export function isValidResumeTarget(target: MissionStatus): boolean {
  return ['Draft', 'InDiscovery', 'InReadiness', 'InWorkflow', 'InGovernance', 'InBuild'].includes(
    target,
  );
}

// recomputeConfidence: pure function combining handoff confidence and the
// missing-evidence penalty. The contract is: final = handoffConfidence *
// (1 - 0.1 * missingEvidenceCount), clamped to [0, 1].
export function recomputeConfidence(
  handoffConfidence: number,
  missingEvidenceCount: number,
): number {
  const penalty = Math.min(0.5, missingEvidenceCount * 0.1);
  const raw = Math.max(0, Math.min(1, handoffConfidence)) * (1 - penalty);
  return Math.max(0, Math.min(1, raw));
}
