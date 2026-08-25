// @polsia:user-owned — shared zod contract for the /api/agents resource. One
// source of truth shared between the GET /api/agents handler (server) and
// the <CoreAgentsSection/> island (client). Catalogs the seven-agent core
// model: 1 Discovery, 2 Readiness, 3 Workflow, 4 Governance, 5 AI Build,
// 6 Partner, 7 Impact. Distinct from The Oracles (the five-voice governance
// council that audits the brief before the pipeline runs). Agents 1..5
// run the five pipeline stages; Agents 6 (Partner) and 7 (Impact) are
// wraparound. Keep client-importable: zod only, no server-only imports.

import { z } from 'zod';

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
});

export const CoreAgents = z.object({
  items: z.array(CoreAgent).length(7),
});

export type CoreAgent = z.infer<typeof CoreAgent>;
export type CoreAgents = z.infer<typeof CoreAgents>;
