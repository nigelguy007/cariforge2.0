// @polsia:user-owned — shared zod contract for the /api/agents resource. One
// source of truth shared between the GET /api/agents handler (server) and
// the <CoreAgentsSection/> island (client). Catalogs the seven-agent core
// model: 1 Discovery, 2 Readiness, 3 Workflow, 4 Governance, 5 AI Build,
// 6 Partner, 7 Impact. Distinct from The Oracles (the five-voice governance
// council that audits the brief before the pipeline runs). Agents 1..5
// run the five pipeline stages; Agents 6 (Partner) and 7 (Impact) are
// wraparound. Keep client-importable: zod only, no server-only imports.
//
// `boundary` fields (inputs/tools/outputs/prohibited/humanApproval/evidence/
// successMeasures) added per the "seven-agent control specification" from
// the Aug 2026 enterprise-platform handoff doc — each is a direct, honest
// description of what this actual system does (the audit trail, the named
// gate approvals, the hash chain — all real, already built earlier this
// project), never a claim about a third-party integration or deployment
// mode this codebase doesn't actually have.
//
// `boundary` is OPTIONAL (2026-09-04, real user feedback: "this is giving
// away the app functionality to everyone"). GET /api/agents now omits it for
// unauthenticated requests — the public /how-it-works page shows only
// role/roleLong/mandate (a brief explanation of what each agent does); full
// operational-boundary detail is signed-in-only, on /dashboard/pipeline.
// Present (never undefined) whenever the caller is authenticated.

import { z } from 'zod';

export const AgentBoundary = z.object({
  inputs: z.array(z.string().min(1)).min(1),
  tools: z.array(z.string().min(1)).min(1),
  outputs: z.array(z.string().min(1)).min(1),
  prohibited: z.array(z.string().min(1)).min(1),
  humanApproval: z.string().min(1),
  evidence: z.array(z.string().min(1)).min(1),
  successMeasures: z.array(z.string().min(1)).min(1),
});

export const CoreAgent = z.object({
  id: z.string().min(1),
  ordinal: z.number().int().min(1).max(7),
  role: z.string().min(1),
  roleLong: z.string().min(1),
  mandate: z.string().min(1),
  relatesToStage: z.enum([
    'Discovery',
    'Readiness',
    'Workflow',
    'Governance',
    'Software Build',
    'Wraparound',
  ]),
  scope: z.enum(['Pipeline', 'Wraparound']),
  boundary: AgentBoundary.optional(),
});

export const CoreAgents = z.object({
  items: z.array(CoreAgent).length(7),
});

export type AgentBoundary = z.infer<typeof AgentBoundary>;
export type CoreAgent = z.infer<typeof CoreAgent>;
export type CoreAgents = z.infer<typeof CoreAgents>;
