// @polsia:user-owned — owner-notification body for newsletter-waitlist
// submissions captured by /blog. Composes the subject + rendered bodies that
// the POST /api/newsletter handler then passes to sendEmail. Kept out of the
// route handler so the handler stays slim and the body is editable without
// touching import boundaries.

import { type EmailContent, renderEmail } from '@/lib/email/templates';

export interface FormatNewsletterOptions {
  leadId: string;
  capturedAtIso: string;
  email: string;
}

export function formatNewsletterEmail(opts: FormatNewsletterOptions): EmailContent {
  const { leadId, capturedAtIso, email } = opts;
  const subject = `New newsletter signup — cariforge.com`;
  const bodyLines = [
    `A regulated buyer just left their work email on the /blog signup slot on cariforge.com.`,
    '',
    `Email:    ${email}`,
    '',
    `--- meta ---`,
    `Captured: ${capturedAtIso}`,
    `Lead id:  ${leadId}`,
    '',
    'See the leads table at /admin/leads (tagged "Newsletter") for the full record.',
  ];
  const { html, text } = renderEmail({
    heading: 'New newsletter signup',
    body: bodyLines,
    footer:
      'You received this because a reader subscribed to the cariforge.com editor-notes mailing list from /blog.',
  });
  return { subject, html, text };
}
