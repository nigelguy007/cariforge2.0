// @polsia:user-owned — owner-notification body for /request-walkthrough
// submissions. Composes the subject + rendered bodies that the POST /api/leads
// route handler then passes to sendEmail. Kept out of the route handler so
// the handler stays slim and the body is editable without touching import
// boundaries.

// We do not import @/lib/email/templates here to keep the path mapping flat
// (this file lives next to other user_owned business code; the email module
// owns src/lib/email/templates.ts and we treat renderEmail as a shared util).
import { type EmailContent, renderEmail } from '@/lib/email/templates';

export interface WalkthroughPayload {
  fullName: string;
  workEmail: string;
  organisation: string;
  role: 'Procurement' | 'Compliance' | 'Engineering' | 'Other';
  segment: 'Financial services' | 'Insurance' | 'Public sector' | 'Health' | 'Other';
  description: string;
}

export interface FormatWalkthroughOptions {
  leadId: string;
  capturedAtIso: string;
  payload: WalkthroughPayload;
}

export function formatWalkthroughEmail(opts: FormatWalkthroughOptions): EmailContent {
  const { leadId, capturedAtIso, payload } = opts;
  const subject = `New CARI Forge walkthrough request — ${payload.segment}`;
  const bodyLines = [
    `A procurement-grade buyer just requested a council walkthrough on cariforge.com — segment: ${payload.segment}.`,
    '',
    `Full name:     ${payload.fullName}`,
    `Work email:    ${payload.workEmail}`,
    `Organisation:  ${payload.organisation}`,
    `Role:          ${payload.role}`,
    `Segment:       ${payload.segment}`,
    '',
    '--- description ---',
    payload.description,
    '',
    `--- meta ---`,
    `Captured: ${capturedAtIso}`,
    `Lead id:  ${leadId}`,
    '',
    'See the leads table at /admin/leads for the full record.',
  ];
  const { html, text } = renderEmail({
    heading: 'New walkthrough request',
    body: bodyLines,
    footer:
      'You received this because a regulated buyer requested a council walkthrough on cariforge.com.',
  });
  return { subject, html, text };
}
