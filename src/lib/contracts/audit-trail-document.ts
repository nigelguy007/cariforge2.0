// @polsia:user-owned — client-safe zod contract for the /sample-brief audit
// trail PDF. One source of truth shared between the <DownloadAuditTrailButton/>
// island (POST body) and the route handler (server-side validation). The shape
// extends the standard PDF DocumentSpec with the five sections needed to
// mirror the worked example on one page: timeline header, brief, council (5
// advisor rows), ruling, supervisor sign-off (5 named approver rows), and the
// scaffold disclaimer footer. Safe to import from a client component: zod
// only, no server-only imports.

import { z } from 'zod';

export const AuditTrailHeader = z.object({
  caseId: z.string().min(1),
  buyerOrg: z.string().min(1),
  submittedOn: z.string().min(1),
  closedOn: z.string().min(1),
  reviewer: z.string().min(1),
});
export type AuditTrailHeader = z.infer<typeof AuditTrailHeader>;

export const AuditTrailBrief = z.object({
  industry: z.string().min(1),
  problemStatement: z.string().min(1),
  proposedApproach: z.string().min(1),
  evidence: z.array(z.string().min(1)).min(1),
  mustNotHappen: z.array(z.string().min(1)).min(1),
});
export type AuditTrailBrief = z.infer<typeof AuditTrailBrief>;

export const AuditTrailAdvisor = z.object({
  role: z.enum(['Risk', 'Demand', 'Growth', 'Competition', 'Money']),
  stance: z.enum(['Objection', 'Supports', 'Qualifies']),
  objection: z.string().min(1),
  evidenceAskedFor: z.string().min(1),
});
export type AuditTrailAdvisor = z.infer<typeof AuditTrailAdvisor>;

export const AuditTrailRuling = z.object({
  verdict: z.enum(['Build', 'Test first', 'Walk away']),
  reconciliation: z.string().min(1),
  carriedDissent: z.array(z.string().min(1)),
});
export type AuditTrailRuling = z.infer<typeof AuditTrailRuling>;

export const AuditTrailSignature = z.object({
  agentOrdinal: z.number().int().min(1).max(5),
  agentName: z.string().min(1),
  name: z.string().min(1),
  role: z.string().min(1),
  decision: z.enum(['Approve', 'Return', 'Refuse']),
  typedReason: z.string().min(1),
  signedAt: z.string().min(1),
  elderOracleMatched: z.boolean().default(false),
});
export type AuditTrailSignature = z.infer<typeof AuditTrailSignature>;

export const AuditTrailDisclaimerRow = z.object({
  headline: z.string().min(1),
  detail: z.string().min(1),
});
export type AuditTrailDisclaimerRow = z.infer<typeof AuditTrailDisclaimerRow>;

export const AuditTrailDocument = z.object({
  kind: z.literal('audit-trail'),
  header: AuditTrailHeader,
  brief: AuditTrailBrief,
  council: z.array(AuditTrailAdvisor).length(5),
  ruling: AuditTrailRuling,
  signatures: z.array(AuditTrailSignature).length(5),
  disclaimer: z.array(AuditTrailDisclaimerRow).min(1),
});
export type AuditTrailDocument = z.infer<typeof AuditTrailDocument>;
