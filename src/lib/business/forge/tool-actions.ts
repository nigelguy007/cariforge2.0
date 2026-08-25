// @polsia:user-owned — pure tool-action policy. Called from
// /api/forge/missions/:id/tool-actions/* routes.

import type { MissionStatus, ToolActionScope } from '@/lib/contracts/forge';
import { FORGE_ERROR_CODES, ForgeError } from './state-machine';

export { ForgeError, FORGE_ERROR_CODES };

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
  decision: 'Approve' | 'Return' | 'Refuse';
}

export function assertScopeDenied(_scope: ToolActionScope, status: MissionStatus): void {
  if (!BLOCKING_STATUSES.has(status)) return;
  // External or Internal — both denied while mission is paused/blocked/etc.
  throw new ForgeError(
    FORGE_ERROR_CODES.TOOL_SCOPE_DENIED,
    `Tool actions denied while mission is ${status}.`,
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
      const found = approvals.find((a) => a.decision === 'Approve' && a.gateIndex >= 0);
      if (!found) {
        throw new ForgeError(
          FORGE_ERROR_CODES.TOOL_GATE_APPROVAL_MISSING,
          `Tool ${tool.scope} request requires an active gate approval.`,
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
  const matched = approvals.find((a) => a.decision === 'Approve');
  if (!matched) {
    throw new ForgeError(
      FORGE_ERROR_CODES.TOOL_GATE_APPROVAL_MISSING,
      `External tool ${tool.scope} requires an existing gate Approve decision.`,
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
