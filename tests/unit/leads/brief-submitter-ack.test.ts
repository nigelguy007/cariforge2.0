// @polsia:user-owned — coverage for the submitter-facing "we'll get back to
// you" email (2026-09-04). Pins three things a regression could silently
// break: the sign-up CTA is always present, the agent's read is inlined
// when triage succeeded, and the email degrades sanely (still promises a
// human reply) when Discovery's automated read failed.
import { describe, expect, it } from 'vitest';
import { formatBriefAckEmail } from '@/lib/email-templates/brief-submitter-ack';

const BASE = {
  brief: 'We need to triage support tickets and route billing questions.',
  reference: 'CF-TEST-0001',
  signupUrl: 'https://cariforge2-0.vercel.app/signup',
};

// EmailContent.text is typed optional (a caller could theoretically hand-
// build html-only content), but renderEmail — the only thing
// formatBriefAckEmail ever calls — always populates it. Assert that
// invariant once here rather than non-null-asserting `.text!` at every call
// site below.
function textOf(email: ReturnType<typeof formatBriefAckEmail>): string {
  expect(email.text).toBeDefined();
  return email.text ?? '';
}

describe('formatBriefAckEmail', () => {
  it('always includes the sign-up CTA so a submitter can track progress', () => {
    const email = formatBriefAckEmail(BASE);
    const text = textOf(email);
    expect(email.html).toContain(BASE.signupUrl);
    expect(text).toContain(BASE.signupUrl);
    expect(text.toLowerCase()).toContain('create an account');
  });

  it('states the 48-hour human-reply promise and the reference on every send', () => {
    const email = formatBriefAckEmail(BASE);
    const text = textOf(email);
    expect(text).toContain('48 hours');
    expect(text).toContain(BASE.reference);
    expect(email.subject).toContain(BASE.reference);
  });

  it('inlines the agent read when Discovery succeeded, labelled indicative not binding', () => {
    const email = formatBriefAckEmail({
      ...BASE,
      triage: {
        fit: 'possible',
        summary: 'Bounded single-team workflow, thin on named-owner detail.',
        agentFocus: [{ agent: 'Discovery', why: 'Confirm a named owner.' }],
        riskFlags: [],
        clarifyingQuestions: [],
      },
    });
    const text = textOf(email);
    expect(text).toContain('Pending review (possible fit)');
    expect(text).toContain('Bounded single-team workflow');
    expect(text.toLowerCase()).toContain('indicative');
    expect(text.toLowerCase()).toContain('not a binding ruling');
  });

  it('degrades to a plain human-reply promise when triage is omitted (Discovery call failed)', () => {
    const email = formatBriefAckEmail(BASE);
    const text = textOf(email);
    expect(text).not.toContain('automated read: ');
    expect(text.toLowerCase()).toContain('the named human who replies will cover it');
  });

  it('escapes brief content instead of injecting raw HTML into the email body', () => {
    const email = formatBriefAckEmail({
      ...BASE,
      brief: '<script>alert(1)</script> we need triage',
    });
    expect(email.html).not.toContain('<script>alert(1)</script>');
    expect(email.html).toContain('&lt;script&gt;');
  });
});
