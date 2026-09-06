// Shared test fixtures for the Forge Canvas slice. `fullGraph()` moved
// here from engine.test.ts (PR A5) so the YAML round-trip test and any
// other spec can reuse the same known-valid graph without duplicating it.

import type { AgentSnapshot } from '@/lib/business/forge-canvas/engine';
import type { CariBlueprintDefinitionT } from '@/lib/contracts/forge-canvas';

export const AGENTS = new Map<string, AgentSnapshot>([
  [
    'forge-discovery',
    {
      slug: 'forge-discovery',
      name: 'Discovery Agent',
      description: 'Frames needs.',
      riskClass: 'low',
    },
  ],
]);
export const SLUGS = new Set(AGENTS.keys());

export function bp(partial: Partial<CariBlueprintDefinitionT>): CariBlueprintDefinitionT {
  return {
    apiVersion: 'cariforge.ai/v1alpha1',
    kind: 'AgentWorkflow',
    objective: 'test',
    nodes: [],
    edges: [],
    ...partial,
  };
}

export const P: { x: number; y: number } = { x: 0, y: 0 };

// A full valid slice graph: start -> agent -> condition -> (true: approval -> end) (false: end)
export function fullGraph(): CariBlueprintDefinitionT {
  return bp({
    nodes: [
      { id: 'start', type: 'start', position: P, label: 'Start', config: { inputDescription: '' } },
      {
        id: 'a1',
        type: 'agent',
        position: P,
        label: 'Discovery',
        config: { agentSlug: 'forge-discovery' },
      },
      {
        id: 'c1',
        type: 'condition',
        position: P,
        label: 'Mentions claims?',
        config: { sourceNodeId: 'a1', contains: 'claims' },
      },
      {
        id: 'ap1',
        type: 'approval',
        position: P,
        label: 'Human gate',
        config: { title: 'Approve framing' },
      },
      { id: 'end1', type: 'end', position: P, label: 'Done', config: {} },
      { id: 'end2', type: 'end', position: P, label: 'Done (no match)', config: {} },
    ],
    edges: [
      { id: 'e1', from: 'start', to: 'a1' },
      { id: 'e2', from: 'a1', to: 'c1' },
      { id: 'e3', from: 'c1', to: 'ap1', branch: 'true' },
      { id: 'e4', from: 'c1', to: 'end2', branch: 'false' },
      { id: 'e5', from: 'ap1', to: 'end1' },
    ],
  });
}
