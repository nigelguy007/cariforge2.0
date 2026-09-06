// @polsia:user-owned — shared zod contract for GET
// /api/forge/missions/[id]/assurance-pack. Mirrors the shape assembled by
// business/forge/assurance-pack.ts. Client-importable: zod only.

import { z } from 'zod';

export const AssurancePackApproval = z.object({
  gateIndex: z.number().int(),
  gateName: z.string(),
  approverUserId: z.string().nullable(),
  decision: z.string(),
  reasonCode: z.string(),
  reasonText: z.string(),
  controls: z.string().nullable(),
  at: z.string(),
});

export const AssurancePackAuditEntry = z.object({
  id: z.string(),
  event: z.string(),
  at: z.string(),
  actorId: z.string().nullable(),
  hash: z.string(),
  previousHash: z.string().nullable(),
});

const notCaptured = z.object({ notCaptured: z.literal(true), reason: z.string() });

export const AssurancePack = z.object({
  generatedAt: z.string(),
  mission: z.object({
    id: z.string(),
    slug: z.string(),
    name: z.string(),
    status: z.string(),
    createdAt: z.string(),
    completedAt: z.string().nullable(),
  }),
  workflowOwnerUserId: z.string(),
  elderOracleUserId: z.string().nullable(),
  approvedUseCase: z.string(),
  readinessHandoffPayload: z.record(z.string(), z.unknown()).nullable(),
  gateDefinitions: z.array(
    z.object({
      gateIndex: z.number().int(),
      stage: z.string(),
      name: z.string(),
      purpose: z.string(),
    }),
  ),
  approvals: z.array(AssurancePackApproval),
  objections: z.array(
    z.object({
      raisedByRole: z.string(),
      text: z.string(),
      resolution: z.string().nullable(),
      resolutionText: z.string().nullable(),
      raisedAt: z.string(),
    }),
  ),
  representativeTestCases: notCaptured,
  securityPrivacyAssessment: notCaptured,
  auditTrail: z.array(AssurancePackAuditEntry),
  recommendation: z.enum([
    'Completed',
    'InProgress',
    'WalkedAway',
    'RolledBack',
    'Blocked',
    'Rejected',
  ]),
});
export type AssurancePackT = z.infer<typeof AssurancePack>;
