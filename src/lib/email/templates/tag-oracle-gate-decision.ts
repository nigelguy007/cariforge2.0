// @polsia:user-owned — Email template for the TAG Caribbean pilot gate
// decision notification. Sent via the platform email proxy on every gate
// decision so the buyer, sponsor, and the named Elder Oracle can read the
// ratification in plain language without logging in.

import type { ApprovalDecision } from '@/lib/contracts/forge';
import { type EmailContent, renderEmail } from '@/lib/email/templates';

export interface TagOracleGateDecisionInput {
  missionName: string;
  gateIndex: number;
  decision: ApprovalDecision;
  approverName: string;
  reasonText: string;
  missionUrl?: string;
}

// R4 (mission pipeline rebuild): single source of truth for how each
// decision reads in plain language, so adding ApproveWithControls couldn't
// silently fall through to "refused" the way a bare else-branch ternary
// would have.
const DECISION_LABEL: Record<ApprovalDecision, string> = {
  Approve: 'Approved',
  ApproveWithControls: 'Approved, with controls',
  Return: 'Returned for change',
  Refuse: 'Refused',
};

export function tagOracleGateDecisionEmail(input: TagOracleGateDecisionInput): EmailContent {
  const stage =
    input.gateIndex <= 0
      ? 'Need Discovery'
      : input.gateIndex === 1
        ? 'Readiness Review'
        : input.gateIndex === 2
          ? 'Workflow Design'
          : input.gateIndex === 3
            ? 'Governance Check'
            : 'Software Build';
  const decisionLabel = DECISION_LABEL[input.decision];
  const { html, text } = renderEmail({
    heading: `Gate ${input.gateIndex} (${stage}) — ${decisionLabel}`,
    body: [
      `Mission: ${input.missionName}`,
      `Decision by ${input.approverName}: ${decisionLabel.toLowerCase()}.`,
      `Reason: ${input.reasonText}`,
    ],
    cta: input.missionUrl ? { label: 'Open the mission', url: input.missionUrl } : undefined,
    footer: 'Sent by the TAG Caribbean pilot Oracle Council.',
  });
  return {
    subject: `[TAG pilot] Gate ${input.gateIndex} (${stage}) ${decisionLabel} — ${input.missionName}`,
    html,
    text,
  };
}
