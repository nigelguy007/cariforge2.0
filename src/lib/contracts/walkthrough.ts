// @polsia:user-owned — shared zod contract for the procurement-grade
// /request-walkthrough form. One source of truth shared between the POST
// /api/leads route handler (server) and the <WalkthroughForm/> island
// (client). Keep this module client-importable: zod only, no server-only or
// prisma imports. Mirrors the pattern next to leads.ts.

import { z } from 'zod';

export const WalkthroughRole = z.enum(['Procurement', 'Compliance', 'Engineering', 'Other']);
export const WalkthroughSegment = z.enum([
  'Financial services',
  'Insurance',
  'Public sector',
  'Health',
  'Other',
]);

export const WalkthroughCreate = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, 'Please tell us your full name.')
    .max(120, 'Full name is too long — please cap at 120 characters.'),
  workEmail: z.string().trim().email('That email looks off.'),
  organisation: z
    .string()
    .trim()
    .min(2, 'Add the organisation you represent.')
    .max(160, 'Organisation is too long — please cap at 160 characters.'),
  role: WalkthroughRole,
  segment: WalkthroughSegment,
  description: z
    .string()
    .trim()
    .min(40, 'Two or three sentences, please (40+ characters).')
    .max(1200, 'Description is too long — please cap at 1200 characters.'),
});

export const WalkthroughAck = WalkthroughCreate.extend({
  id: z.string(),
  createdAt: z.string(), // ISO-8601 from the server; client parses as a string
  notified: z.boolean(), // true iff owner-email send succeeded
});

export type WalkthroughCreate = z.infer<typeof WalkthroughCreate>;
export type WalkthroughAck = z.infer<typeof WalkthroughAck>;
export type WalkthroughRoleValue = z.infer<typeof WalkthroughRole>;
export type WalkthroughSegmentValue = z.infer<typeof WalkthroughSegment>;
