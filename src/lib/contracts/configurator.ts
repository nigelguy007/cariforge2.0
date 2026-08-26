// @polsia:user-owned — shared zod contract for the workflow configurator
// (Priority-11 item from the Aug 2026 enterprise-platform handoff doc:
// "Allow prospects to describe a workflow and receive an indicative
// readiness profile and agent workflow"). Same shape convention as
// contracts/qa-review.ts: a discriminated union covering the graceful-
// degradation case (no ANTHROPIC_API_KEY, or the call failed) so the
// client never has to special-case a thrown error. This is explicitly
// INDICATIVE, automated, and non-binding — it is not the real Discovery
// gate, which is where an actual case gets ruled on by a named human. The
// UI copy must keep saying so; this contract doesn't gate anything.

import { z } from 'zod';

export const ConfiguratorRequest = z.object({
  description: z
    .string()
    .trim()
    .min(20, 'Give us at least one full sentence about what you want to build.')
    .max(2000, 'Keep it under 2000 characters — the Discovery agent reads the full version later.'),
});
export type ConfiguratorRequestT = z.infer<typeof ConfiguratorRequest>;

export const CONFIGURATOR_FIT_VALUES = ['strong', 'possible', 'unlikely'] as const;
export type ConfiguratorFit = (typeof CONFIGURATOR_FIT_VALUES)[number];

// Must match the seven real agent role names from contracts/agents.ts —
// kept as a literal tuple here (not an import) so this client-importable
// contract has no dependency on the agents contract; the two are cross-
// checked by a unit test instead (tests/unit/configurator-contract.test.ts).
export const CONFIGURATOR_AGENT_VALUES = [
  'Discovery',
  'Readiness',
  'Workflow',
  'Governance',
  'AI Build',
  'Partner',
  'Impact',
] as const;
export type ConfiguratorAgent = (typeof CONFIGURATOR_AGENT_VALUES)[number];

export const ConfiguratorAgentFocus = z.object({
  agent: z.enum(CONFIGURATOR_AGENT_VALUES),
  why: z.string(),
});

// The structured shape Claude is asked to fill in via output_config.format.
export const ConfiguratorResult = z.object({
  fit: z.enum(CONFIGURATOR_FIT_VALUES),
  summary: z.string(),
  agentFocus: z.array(ConfiguratorAgentFocus).min(1).max(7),
  riskFlags: z.array(z.string()),
  clarifyingQuestions: z.array(z.string()),
});
export type ConfiguratorResultT = z.infer<typeof ConfiguratorResult>;

// Wire shape served from POST /api/configurator. 'unavailable' covers: no
// ANTHROPIC_API_KEY configured, or the call itself failed — same fallback
// pattern as contracts/qa-review.ts's QAReview union.
export const ConfiguratorResponse = z.discriminatedUnion('status', [
  z.object({ status: z.literal('unavailable') }),
  z.object({ status: z.literal('ok'), result: ConfiguratorResult }),
]);
export type ConfiguratorResponseT = z.infer<typeof ConfiguratorResponse>;
