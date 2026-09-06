// @polsia:user-owned — pure tool-action policy. Called from
// /api/forge/missions/:id/tool-actions/* routes.

import {
  type ApprovalDecision,
  isApproveDecision,
  type MissionStatus,
  type ToolActionScope,
} from '@/lib/contracts/forge';
import { FORGE_ERROR_CODES, ForgeError } from './state-machine';

export { FORGE_ERROR_CODES, ForgeError };

const BLOCKING_STATUSES: ReadonlySet<MissionStatus> = new Set([
  'Paused',
  'Blocked',
  'Rejected',
  'WalkedAway',
  'RolledBack',
]);

export interface ToolActionRef {
  id: string;
  scope: ToolActionScope;
  requiresGateApproval: boolean;
  approvedGateIndex: number | null;
  decision: 'Approved' | 'Denied' | null;
  executedAt: Date | null;
}

export interface ApprovalRef {
  gateIndex: number;
  decision: ApprovalDecision;
}

export function assertScopeDenied(_scope: ToolActionScope, status: MissionStatus): void {
  if (!BLOCKING_STATUSES.has(status)) return;
  // External or Internal — both denied while mission is paused/blocked/etc.
  throw new ForgeError(
    FORGE_ERROR_CODES.TOOL_SCOPE_DENIED,
    `Tool actions are denied while the mission is ${status}. Resume the mission (or wait for it to leave ${status}) before proposing or executing a tool action.`,
  );
}

export function assertExternalApproved(
  tool: ToolActionRef,
  approvals: readonly ApprovalRef[],
): void {
  if (tool.scope === 'Internal') {
    // Internal may require a gate-level approval; if the agent flagged
    // requiresGateApproval=true, gate must exist with same stage linkage.
    if (tool.requiresGateApproval) {
      const found = approvals.find((a) => isApproveDecision(a.decision) && a.gateIndex >= 0);
      if (!found) {
        throw new ForgeError(
          FORGE_ERROR_CODES.TOOL_GATE_APPROVAL_MISSING,
          `This Internal tool action requires at least one gate to already have an Approve decision recorded. Get a gate approved first, then retry.`,
        );
      }
    }
    return;
  }
  // External: must have a gate approval row at the gateIndex the tool
  // targeted (or higher), with Approve decision.
  if (!tool.requiresGateApproval) {
    throw new ForgeError(
      FORGE_ERROR_CODES.TOOL_SCOPE_DENIED,
      `External scope must set requiresGateApproval=true.`,
    );
  }
  const matched = approvals.find((a) => isApproveDecision(a.decision));
  if (!matched) {
    throw new ForgeError(
      FORGE_ERROR_CODES.TOOL_GATE_APPROVAL_MISSING,
      `This External tool action requires at least one gate to already have an Approve decision recorded. Get a gate approved first, then retry.`,
    );
  }
}

export function assertRollbackLink(target: ToolActionRef, prior: ToolActionRef | null): void {
  if (!prior) {
    throw new ForgeError(
      FORGE_ERROR_CODES.TOOL_ROLLBACK_TARGET_INVALID,
      'Rollback link points at a missing prior ToolAction.',
    );
  }
  if (!prior.executedAt) {
    throw new ForgeError(
      FORGE_ERROR_CODES.TOOL_ROLLBACK_TARGET_INVALID,
      'Rollback target was never executed.',
    );
  }
  if (prior.id === target.id) {
    throw new ForgeError(
      FORGE_ERROR_CODES.TOOL_ROLLBACK_TARGET_INVALID,
      'Rollback cannot target itself.',
    );
  }
}
