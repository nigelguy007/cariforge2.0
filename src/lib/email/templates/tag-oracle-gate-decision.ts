// @polsia:user-owned — Email template for the TAG Caribbean pilot gate
// decision notification. Sent via the platform email proxy on every gate
// decision so the buyer, sponsor, and the named Elder Oracle can read the
// ratification in plain language without logging in.

import { type EmailContent, renderEmail } from '@/lib/email/templates';

export interface TagOracleGateDecisionInput {
  missionName: string;
  gateIndex: number;
  decision: 'Approve' | 'Return' | 'Refuse';
  approverName: string;
  reasonText: string;
  missionUrl?: string;
}

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
  const decisionVerb =
    input.decision === 'Approve'
      ? 'approved'
      : input.decision === 'Return'
        ? 'returned for change'
        : 'refused';
  const { html, text } = renderEmail({
    heading: `Gate ${input.gateIndex} (${stage}) — ${input.decision}`,
    body: [
      `Mission: ${input.missionName}`,
      `Decision by ${input.approverName}: ${decisionVerb}.`,
      `Reason: ${input.reasonText}`,
    ],
    cta: input.missionUrl ? { label: 'Open the mission', url: input.missionUrl } : undefined,
    footer: 'Sent by the TAG Caribbean pilot Oracle Council.',
  });
  return {
    subject: `[TAG pilot] Gate ${input.gateIndex} (${stage}) ${input.decision} — ${input.missionName}`,
    html,
    text,
  };
}
