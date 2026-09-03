// @polsia:user-owned — submitter-facing acknowledgement for the front-door
// brief form (/how-it-works, source='home'). Composes the "we'll get back
// to you" email a real submitter actually receives, so the promise the UI
// already makes ("A real human will reply — within 48 hours during working
// weeks.") is backed by something, not just displayed on-screen and then
// forgotten.
//
// GAP THIS CLOSES (2026-09-04, explicit user request): before this file
// existed, POST /api/leads only ever emailed the SITE OWNER (best-effort,
// silently skipped if unconfigured) — nothing was ever sent back to the
// person who submitted the brief. A visitor who didn't create an account
// got the on-screen Discovery read once, then silence. This is the email
// half of that: sent only when the submitter gave an (optional) email
// address, carries the Discovery agent's own automated read inline (so it
// isn't lost the moment the tab closes), and ends with a sign-up CTA so the
// reader can actually track it going forward — the three things asked for:
// a "we'll get back to you" line, the agent's response, and a sign-up link.

import type { ConfiguratorResultT } from '@/lib/contracts/configurator';
import { type EmailContent, renderEmail } from '@/lib/email/templates';

export interface FormatBriefAckOptions {
  brief: string;
  reference: string;
  signupUrl: string;
  /** Present only when Discovery's automated read succeeded (triage.status === 'ok'). */
  triage?: ConfiguratorResultT;
}

const FIT_LABEL: Record<ConfiguratorResultT['fit'], string> = {
  strong: 'Strong fit',
  possible: 'Possible fit',
  unlikely: 'Unlikely fit — for now',
};

export function formatBriefAckEmail(opts: FormatBriefAckOptions): EmailContent {
  const { brief, reference, signupUrl, triage } = opts;

  const body: string[] = [
    "We've got your brief, and a named human will get back to you within 48 hours during working weeks.",
    `Reference ${reference} — quote it in any follow-up.`,
    '',
    'What you sent us:',
    brief,
  ];

  // The agent's own automated read, inline — not just a promise of a human
  // reply, but what Discovery's indicative pass actually found, the same
  // moment the submitter would have seen on-screen. Kept short by design:
  // this is an email, not the full on-screen card (agentFocus/riskFlags/
  // clarifyingQuestions stay on the tracked-mission view after sign-up,
  // where there's room to read them properly).
  if (triage) {
    body.push(
      '',
      `Discovery's automated read: ${FIT_LABEL[triage.fit]}`,
      triage.summary,
      '',
      'This read is automated and indicative, not a binding ruling — a named human still reviews it.',
    );
  } else {
    body.push(
      '',
      "We couldn't run Discovery's automated read just now — the named human who replies will cover it directly.",
    );
  }

  body.push(
    '',
    'Want to follow this instead of waiting on email? Create an account and it shows up in your dashboard the moment we reply — approvals, the audit trail, all of it, live.',
  );

  const { html, text } = renderEmail({
    heading: 'Brief received.',
    body,
    cta: { label: 'Create an account to track it', url: signupUrl },
    footer: `You're receiving this because you left a brief with an email address at CARI Forge. Reference: ${reference}.`,
  });

  return { subject: `We've got your brief — ${reference}`, html, text };
}
