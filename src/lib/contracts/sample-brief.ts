// @polsia:user-owned — shared zod contract for the /sample-brief resource.
// One source of truth shared between the GET /api/sample-brief handler
// (server) and the <SampleBriefDetail/> island (client). Models the editorial
// worked-example payload: the buyer brief as submitted, the five advisor
// objections, the chairman reconciled ruling, the five-agent pipeline of
// stage handoffs (Agents 1–5), and Agent 5's working solution. Keep
// client-importable: zod only, no server-only imports.

import { z } from 'zod';

export const Brief = z.object({
  industry: z.string().min(1),
  problemStatement: z.string().min(1),
  proposedApproach: z.string().min(1),
  /** Verifiable evidence presented by the buyer (claim volume, ops hours, named stakeholders). */
  evidence: z.array(z.string().min(1)).min(1),
  /** Explicit guard-rails the buyer has written — the things the run must not produce. */
  mustNotHappen: z.array(z.string().min(1)).min(1),
});

export const AdvisorObjection = z.object({
  role: z.enum(['Risk', 'Demand', 'Growth', 'Competition', 'Money']),
  roleLong: z.string().min(1),
  stance: z.enum(['Objection', 'Supports', 'Qualifies']),
  /** The typed objection the advisor raises, verbatim into the case file. */
  objection: z.string().min(1),
  /** What the advisor asks the buyer to evidence to resolve it. */
  evidenceAskedFor: z.string().min(1),
});

export const ChairmanRuling = z.object({
  verdict: z.enum(['Build', 'Test first', 'Walk away']),
  /** The chair's reconciliation of where the advisors differed. */
  reconciliation: z.string().min(1),
  /** Any objection that was not resolved at the chair's desk, re-cast as a typed carry-forward
   *  item — preserved under the no-silent-drop rule, not dropped. */
  carriedDissent: z.array(z.string().min(1)),
});

export const Supervisor = z.object({
  name: z.string().min(1),
  role: z.string().min(1),
  decision: z.enum(['Approve', 'Return', 'Refuse']),
  /** The reason the supervisor attached, recorded verbatim with the decision. */
  typedReason: z.string().min(1),
  /** ISO-8601 timestamp. */
  signedAt: z.string().min(1),
});

export const StageArtifact = z.object({
  agentOrdinal: z.number().int().min(1).max(5),
  agentName: z.string().min(1),
  /** The concrete artifact received from the previous stage. */
  inputFromPrevious: z.string().min(1),
  /** The concrete artifact this stage produces. */
  output: z.string().min(1),
  /** What the next stage inherits from this one. */
  downstreamHandoff: z.string().min(1),
  supervisor: Supervisor,
});

export const Solution = z.object({
  /** Where the user opens the working solution. */
  component: z.string().min(1),
  route: z.string().min(1),
  /** The route handlers and the audit-trail data model the build produced. */
  dataPlane: z.array(z.string().min(1)).min(1),
  /** A short spec line on the human-in-the-loop mechanic the build ships. */
  mechanic: z.string().min(1),
});

export const RunMetadata = z.object({
  caseId: z.string().min(1),
  buyerOrg: z.string().min(1),
  submittedOn: z.string().min(1),
  closedOn: z.string().min(1),
  reviewer: z.string().min(1),
});

export const SampleBrief = z.object({
  /** Editorial-only disclaimer surfaced as the first element of the page so a
   *  regulated buyer cannot mistake the worked example for a deployed product.
   *  Verbatim wording lives in the static seed (`src/lib/business/sample-brief.ts`). */
  productionDisclaimer: z.string().min(1),
  brief: Brief,
  council: z.array(AdvisorObjection).length(5),
  ruling: ChairmanRuling,
  /** Five stages — Stages 1..5 (Discovery / Readiness / Workflow / Governance / Software Build),
   *  operated by the seven-agent core: Agents 1..7 (Discovery / Readiness / Workflow /
   *  Governance / AI Build / Partner / Impact). Agent 5 is "AI Build", not "Software Build" —
   *  "Software Build" is the name of Stage 5 that AI Build operates. */
  stages: z.array(StageArtifact).length(5),
  /** Agent 5 (AI Build) operates Stage 5 (Software Build) and ships the working solution as the
   *  end of the pipeline. */
  solution: Solution,
  runMetadata: RunMetadata,
});

export type Brief = z.infer<typeof Brief>;
export type AdvisorObjection = z.infer<typeof AdvisorObjection>;
export type ChairmanRuling = z.infer<typeof ChairmanRuling>;
export type Supervisor = z.infer<typeof Supervisor>;
export type StageArtifact = z.infer<typeof StageArtifact>;
export type Solution = z.infer<typeof Solution>;
export type RunMetadata = z.infer<typeof RunMetadata>;
export type SampleBrief = z.infer<typeof SampleBrief>;
