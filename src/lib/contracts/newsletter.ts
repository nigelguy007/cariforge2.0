// @polsia:user-owned — shared zod contract for the newsletter waitlist form
// rendered on /blog. One source of truth shared between the POST
// /api/newsletter handler (server) and the <NewsletterSignupForm/> island
// (client). Keep this module client-importable: zod only, no server-only
// imports.

import { z } from 'zod';

export const NewsletterSignup = z.object({
  email: z.string().trim().min(1, 'Please add your work email.').email('That email looks off.'),
});

export const NewsletterAck = NewsletterSignup.extend({
  id: z.string(),
  createdAt: z.string(), // ISO-8601 from the server; client parses as a string
  notified: z.boolean(), // true iff owner-email send succeeded
});

export type NewsletterSignup = z.infer<typeof NewsletterSignup>;
export type NewsletterAck = z.infer<typeof NewsletterAck>;
