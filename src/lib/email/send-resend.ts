// @polsia:user-owned — real email transport via Resend's API, standing in
// for the framework's src/lib/email/send.ts.
//
// WHY THIS FILE EXISTS (2026-09-04): the framework module's transport POSTs
// to `POLSIA_EMAIL_PROXY_URL`, which in this deploy is literally
// `https://email-proxy.invalid` — `.invalid` is an RFC 2606 reserved suffix
// guaranteed to never resolve. That was confirmed by inspecting the actual
// Vercel env var value directly, not inferred — the Polsia email
// integration for this project was never really configured; it's a
// scaffold-time placeholder. So no amount of finding the "right"
// POLSIA_API_KEY would have fixed sending; there was nothing real behind
// the proxy to authenticate against. This transport talks to Resend
// directly instead, using a RESEND_API_KEY the user has since added to
// Vercel. src/lib/email/send.ts is framework-owned (its own header: "DO NOT
// EDIT... Drift = commit rejected"), so this is a NEW, interface-identical
// module rather than an edit to that one — every call site just swaps its
// import path, no call-site logic changes.
//
// Same SendEmailInput/SendEmailResult shape as the framework module (see
// that file for the authoritative doc comments on each field) so this is a
// drop-in replacement, not a new API callers need to learn.

import 'server-only';

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  text?: string;
  /** Accepted for interface compatibility with the framework module; no
   *  caller currently sets it, and Resend's reply-threading model doesn't
   *  map onto Polsia's proxy-specific message-id scheme, so it's a no-op
   *  here rather than a partial, unverifiable reimplementation. */
  replyToEmailId?: string;
}

export interface SendEmailResult {
  /** Resend's own message id for the sent email. Empty string if Resend's
   *  response didn't include one (unexpected, but shouldn't crash a caller
   *  that only checks truthiness the way the framework module's callers
   *  do). */
  id: string;
}

// Resend requires either a verified sending domain or its own shared
// sandbox address. No domain has been verified in this Resend account as
// of writing, so the sandbox address is the honest default — it works
// immediately, with no setup beyond the API key already in Vercel.
// Overridable via env so upgrading to a branded "from" address later (once
// a real domain is verified in the Resend dashboard) needs a Vercel env
// change, not a code change.
const DEFAULT_FROM = 'CARI Forge <onboarding@resend.dev>';

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    // Loud, not swallowed — matches the standard this session has held
    // every other email/notification path to. A missing key here means
    // every email in the app silently stops, which is worse than a
    // throw a caller's own try/catch can log and recover from.
    throw new Error('RESEND_API_KEY is not set — cannot send email');
  }
  const from = process.env.RESEND_FROM_EMAIL ?? DEFAULT_FROM;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      from,
      to: input.to,
      subject: input.subject,
      html: input.html,
      ...(input.text ? { text: input.text } : {}),
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Resend send failed: ${res.status} ${detail}`.trim());
  }

  const json = (await res.json().catch(() => ({}))) as { id?: string };
  return { id: json.id ?? '' };
}
