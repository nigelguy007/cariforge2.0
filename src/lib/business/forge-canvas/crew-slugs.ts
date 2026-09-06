// @polsia:user-owned — the one mapping between the Configurator's seven
// human-readable agent role names (contracts/configurator.ts,
// CONFIGURATOR_AGENT_VALUES) and the Forge Crew's seeded registry slugs
// (src/lib/seed.ts). Both Forge Guide (PR B, compiles a configurator
// result into a canvas graph) and any other caller that needs to turn a
// role name into a real `agentSlug` go through this — never hand-roll the
// mapping a second time. Kept in business/ (not contracts/) because it's
// plain data, not a zod contract, and configurator.ts stays free of a
// dependency on the canvas slice.

import type { ConfiguratorAgent } from '@/lib/contracts/configurator';

export const CREW_SLUG_BY_ROLE: Record<ConfiguratorAgent, string> = {
  Discovery: 'forge-discovery',
  Readiness: 'forge-readiness',
  Workflow: 'forge-workflow',
  Governance: 'forge-governance',
  'AI Build': 'forge-ai-build',
  Partner: 'forge-partner',
  Impact: 'forge-impact',
};
