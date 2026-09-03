// @polsia:user-owned — owner-notification body for the front-door brief
// form (/how-it-works, source='home'). Mirrors
// walkthrough-owner-notification.ts's pattern (kept out of the route
// handler so it stays slim, uses the shared renderEmail shell), which the
// home-branch notification never actually did — it built a plain string by
// hand instead. Consolidated here as part of the 2026-09-04 Resend
// migration so both owner-notification paths look and behave the same way.

import { type EmailContent, renderEmail } from '@/lib/email/templates';

export interface FormatBriefOwnerNotificationOptions {
  leadId: string;
  capturedAtIso: string;
  brief: string;
  submitterEmail?: string | null;
}

export function formatBriefOwnerNotificationEmail(
  opts: FormatBriefOwnerNotificationOptions,
): EmailContent {
  const { leadId, capturedAtIso, brief, submitterEmail } = opts;
  const subject = `New CARI Forge brief${submitterEmail ? ` — ${submitterEmail}` : ''}`;
  const body = [
    'A regulated buyer just left a one-line brief on cariforge.com.',
    '',
    `Captured: ${capturedAtIso}`,
    `Lead id:  ${leadId}`,
    `Email:    ${submitterEmail ?? '(none)'}`,
    '',
    '--- brief ---',
    brief,
  ];
  const { html, text } = renderEmail({
    heading: 'New CARI Forge brief',
    body,
    footer: 'See the leads table at /admin/leads for the full record.',
  });
  return { subject, html, text };
}
