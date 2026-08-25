// @polsia:user-owned — pure attestation + reason-code policy. Called from
// /api/forge/missions/:id/gates/:gateIndex/decide and approved handlers.

import {
  type ApprovalDecision,
  GATE_DEFS,
  GATE_REASON_CODES,
  type ReasonCode,
} from '@/lib/contracts/forge';
import { FORGE_ERROR_CODES, ForgeError } from './state-machine';

export { ForgeError, FORGE_ERROR_CODES };

// approveWithoutReason / approveWithoutApproverId: a gate Approve decision
// without (a) non-empty reasonText, (b) non-empty reasonCode, or (c) a
// recorded approverUserId is INVALID attribution.
export interface ApprovalInput {
  decision: ApprovalDecision;
  reasonCode: ReasonCode;
  reasonText: string;
  approverUserId: string | null | undefined;
}

export function assertReasonAllowed(gateIndex: number, code: ReasonCode): void {
  const gate = GATE_DEFS[gateIndex];
  if (!gate)
    throw new ForgeError(FORGE_ERROR_CODES.GATE_LOCKED, `Unknown gate index: ${gateIndex}`);
  if (!gate.allowedReasonCodes.includes(code)) {
    throw new ForgeError(
      FORGE_ERROR_CODES.REASON_NOT_PERMITTED,
      `Reason code ${code} is not permitted at gate ${gateIndex}.`,
    );
  }
}

export function assertReasonCodeIsRegistered(code: string): code is ReasonCode {
  return (GATE_REASON_CODES as readonly string[]).includes(code);
}

export function assertAttribution(approval: ApprovalInput): void {
  // Return / Refuse need a reasonCode + reasonText but do NOT strictly require
  // approverUserId (e.g. the system can refuse on system-detected violations,
  // keeping the attribution rule relaxed for those branches — but the
  // approverUserId is still REQUIRED end-to-end via API). Here we enforce the
  // baseline shape: non-empty reasonText + valid reasonCode + approverUserId
  // a string-or-trimmed value.
  if (!approval.reasonText || approval.reasonText.trim().length < 1) {
    throw new ForgeError(
      FORGE_ERROR_CODES.ATTRIBUTION_MISSING,
      'Approver must record reason text for an attribution decision.',
    );
  }
  if (!approval.reasonCode) {
    throw new ForgeError(
      FORGE_ERROR_CODES.ATTRIBUTION_MISSING,
      'Approver must record a reason code.',
    );
  }
  if (!approval.approverUserId || approval.approverUserId.trim().length === 0) {
    throw new ForgeError(
      FORGE_ERROR_CODES.ATTRIBUTION_MISSING,
      'Approver user ID is missing — attribution cannot be reconstructed.',
    );
  }
}

// Always required: Return / Refuse also require a non-empty reason + code,
// but approverUserId may be the system id (handled at API layer via the
// route extracting the session user; we only check shape here).
export function assertNonApproveAttribution(approval: ApprovalInput): void {
  if (!approval.reasonText || approval.reasonText.trim().length < 1) {
    throw new ForgeError(
      FORGE_ERROR_CODES.ATTRIBUTION_MISSING,
      'Reason text is required for Return / Refuse decisions.',
    );
  }
  if (!approval.reasonCode) {
    throw new ForgeError(FORGE_ERROR_CODES.ATTRIBUTION_MISSING, 'A reason code is required.');
  }
}
