// @polsia:user-owned — static dataset for the seven-agent core model. Server-only:
// imported by /api/agents/route.ts, which parses it through the shared
// CoreAgents contract. Lists the canonical seven agents that operate the
// CARI Forge pipeline and wraparound: 1 Discovery, 2 Readiness, 3 Workflow,
// 4 Governance, 5 AI Build, 6 Partner, 7 Impact. Agents 1..5 are the
// pipeline runtime — Agent 1..5 operate Stage 1..5 of the 21-day delivery
// pipeline respectively (notably Agent 5 = AI Build operates Stage 5, whose
// stage name is "Software Build"). Agents 6..7 are wraparound: Partner engages
// the buyer / integrator ecosystem post-delivery, Impact measures the change
// in the world. No DB, no AI call — pure editorial catalog copy.

import 'server-only';
import type { CoreAgents } from '@/lib/contracts/agents';

export const CORE_AGENTS: CoreAgents = {
  items: [
    {
      id: 'discovery',
      ordinal: 1,
      role: 'Discovery',
      roleLong: 'Need Discovery agent',
      mandate:
        'Translates a one-line inbound brief into a testable problem statement card with named must-not-happen clauses and a named buyer approver. The case is only legible to the rest of the pipeline once Discovery has approved the framing.',
      relatesToStage: 'Discovery',
      scope: 'Pipeline',
    },
    {
      id: 'readiness',
      ordinal: 2,
      role: 'Readiness',
      roleLong: 'Readiness Review agent',
      mandate:
        'Audits data sources, integrations, and regulatory regimes before code. Writes the build-versus-buy comparison statement to the case file (FRISS / Shift / Guidewire ClaimCenter or equivalent) and locks the data-minimisation clause.',
      relatesToStage: 'Readiness',
      scope: 'Pipeline',
    },
    {
      id: 'workflow',
      ordinal: 3,
      role: 'Workflow',
      roleLong: 'Workflow Design agent',
      mandate:
        'Designs the role/escalation diagram for the proposed system: the human checkpoints, the SIU / Compliance / Officer gates, the per-regime SLAs, and the typed-note to the buyer on what the build unlocks downstream.',
      relatesToStage: 'Workflow',
      scope: 'Pipeline',
    },
    {
      id: 'governance',
      ordinal: 4,
      role: 'Governance',
      roleLong: 'Governance Check agent',
      mandate:
        'Confirms the logging, oversight, and stop-the-line controls hold under the named human approvals at every gate. Produces the binding spec handed to Agent 5 (AI Build) — every route handler and prisma model below is derived from this matrix.',
      relatesToStage: 'Governance',
      scope: 'Pipeline',
    },
    {
      id: 'ai-build',
      ordinal: 5,
      role: 'AI Build',
      roleLong: 'AI Build agent',
      mandate:
        'Runs Stage 5 (Software Build) of the pipeline and ships the runnable Next.js + TypeScript codebase from the binding spec handed over by Governance: route handlers, the append-only audit-trail prisma model, the immutable hash chain, and the developer-facing case file receipt. AI Build is the agent name; "Software Build" is the stage name it operates.',
      relatesToStage: 'Software Build',
      scope: 'Pipeline',
    },
    {
      id: 'partner',
      ordinal: 6,
      role: 'Partner',
      roleLong: 'Partner agent',
      mandate:
        'Wraps around delivery. Engages the buyer-side integrator / GA / cloud partner ecosystem so the runnable software build lands on infrastructure the buyer’s own people can run. Not a stage — a wraparound that turns a repository into an operated system.',
      relatesToStage: 'Wraparound',
      scope: 'Wraparound',
    },
    {
      id: 'impact',
      ordinal: 7,
      role: 'Impact',
      roleLong: 'Impact agent',
      mandate:
        'Wraps around delivery. Measures the change in the world the build was meant to make — the agreed unit economics in production (not on a slide), the kept promise on the named must-not-happen clauses, and the learning that flows back into the next brief. Not a stage — a wraparound.',
      relatesToStage: 'Wraparound',
      scope: 'Wraparound',
    },
  ],
} as const;
