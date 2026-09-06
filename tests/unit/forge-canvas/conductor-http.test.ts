// Unit tests for the PR C engine cases: 'conductor' and 'http'. Pure
// function tests — no DB, no network (an http node must never fetch).

import { describe, expect, it, vi } from 'vitest';
import { type AgentSnapshot, advance } from '@/lib/business/forge-canvas/engine';
import { validateBlueprint } from '@/lib/business/forge-canvas/validate';
import type { CariBlueprintDefinitionT } from '@/lib/contracts/forge-canvas';
import { P } from './fixtures';

const AGENTS = new Map<string, AgentSnapshot>([
  [
    'forge-discovery',
    {
      slug: 'forge-discovery',
      name: 'Discovery Agent',
      description: 'Frames needs.',
      riskClass: 'low',
    },
  ],
  [
    'forge-readiness',
    {
      slug: 'forge-readiness',
      name: 'Readiness Agent',
      description: 'Checks access.',
      riskClass: 'medium',
    },
  ],
]);
const SLUGS = new Set(AGENTS.keys());

function conductorGraph(overrides?: {
  allowedAgentSlugs?: string[];
  routes?: { contains: string; agentSlug: string }[];
  maxCalls?: number;
}): CariBlueprintDefinitionT {
  return {
    apiVersion: 'cariforge.ai/v1alpha1',
    kind: 'AgentWorkflow',
    objective: 'test',
    nodes: [
      { id: 'start', type: 'start', position: P, label: 'Start', config: { inputDescription: '' } },
      {
        id: 'cond1',
        type: 'conductor',
        position: P,
        label: 'Router',
        config: {
          allowedAgentSlugs: overrides?.allowedAgentSlugs ?? ['forge-discovery', 'forge-readiness'],
          routes: overrides?.routes ?? [{ contains: 'triage', agentSlug: 'forge-discovery' }],
          maxCalls: overrides?.maxCalls ?? 2,
          fallback: 'approval',
        },
      },
      { id: 'ap1', type: 'approval', position: P, label: 'Approve', config: { title: 'Approve' } },
      { id: 'end1', type: 'end', position: P, label: 'Done', config: {} },
    ],
    edges: [
      { id: 'e1', from: 'start', to: 'cond1' },
      { id: 'e2', from: 'cond1', to: 'ap1' },
      { id: 'e3', from: 'ap1', to: 'end1' },
    ],
  };
}

describe('conductor node', () => {
  it('validates cleanly when every route/allowlist slug is a real registry agent', () => {
    const res = validateBlueprint(conductorGraph(), SLUGS);
    expect(res).toEqual({ ok: true, issues: [] });
  });

  it('rejects a route whose slug is not in the allowlist', () => {
    const def = conductorGraph({
      allowedAgentSlugs: ['forge-discovery'],
      routes: [{ contains: 'invoice', agentSlug: 'ops-invoice-extraction' }],
    });
    // ops-invoice-extraction is not in SLUGS (crew-only registry here), and
    // regardless is outside the allowlist — both checks should fire.
    const res = validateBlueprint(def, SLUGS);
    expect(res.ok).toBe(false);
    expect(res.issues.some((i) => i.nodeId === 'cond1')).toBe(true);
  });

  it('routes to the first matching, allowlisted agent (simulated, never live)', () => {
    const res = advance({
      def: conductorGraph(),
      agents: AGENTS,
      state: { __input: 'please triage this' },
      startNodeId: 'start',
      ordinalStart: 1,
    });
    const conductorRecord = res.records.find((r) => r.nodeId === 'cond1');
    expect(conductorRecord?.output).toMatchObject({
      routed: true,
      routedTo: 'forge-discovery',
      simulated: true,
    });
  });

  it('blocks a route to an agent outside the allowlist even if it matches (policy, not trust)', () => {
    const def = conductorGraph({
      allowedAgentSlugs: ['forge-readiness'], // discovery is NOT allowlisted
      routes: [{ contains: 'triage', agentSlug: 'forge-discovery' }],
    });
    const res = advance({
      def,
      agents: AGENTS,
      state: { __input: 'please triage this' },
      startNodeId: 'start',
      ordinalStart: 1,
    });
    expect(res.status).toBe('Failed');
    expect(res.records.at(-1)?.error).toContain('Policy blocked route');
  });

  it('once maxCalls is reached, reports max-calls and still follows the single outgoing edge', () => {
    // Not reachable via a normal (loop-free) single advance() today, but
    // the counter itself must already be enforced defensively — assert it
    // directly by pre-seeding state as if a prior call had happened.
    const def = conductorGraph({ maxCalls: 1 });
    const res = advance({
      def,
      agents: AGENTS,
      state: { __input: 'please triage this', '__conductorCalls:cond1': 1 },
      startNodeId: 'start',
      ordinalStart: 1,
    });
    const conductorRecord = res.records.find((r) => r.nodeId === 'cond1');
    expect(conductorRecord?.output).toEqual({ routed: false, reason: 'max-calls' });
    // Still proceeds along the conductor's single outgoing edge.
    expect(res.records.map((r) => r.nodeId)).toContain('ap1');
  });

  it('no match still proceeds along the single outgoing edge, not a dead end', () => {
    const res = advance({
      def: conductorGraph(),
      agents: AGENTS,
      state: { __input: 'nothing relevant' },
      startNodeId: 'start',
      ordinalStart: 1,
    });
    const conductorRecord = res.records.find((r) => r.nodeId === 'cond1');
    expect(conductorRecord?.output).toEqual({ routed: false, reason: 'no-match' });
    expect(res.status).toBe('AwaitingApproval');
  });
});

describe('http node', () => {
  function httpGraph(): CariBlueprintDefinitionT {
    return {
      apiVersion: 'cariforge.ai/v1alpha1',
      kind: 'AgentWorkflow',
      objective: 'test',
      nodes: [
        {
          id: 'start',
          type: 'start',
          position: P,
          label: 'Start',
          config: { inputDescription: '' },
        },
        {
          id: 'http1',
          type: 'http',
          position: P,
          label: 'Call it',
          config: { method: 'GET', url: 'https://example.com/webhook', dryRun: true },
        },
        { id: 'end1', type: 'end', position: P, label: 'Done', config: {} },
      ],
      edges: [
        { id: 'e1', from: 'start', to: 'http1' },
        { id: 'e2', from: 'http1', to: 'end1' },
      ],
    };
  }

  it('never calls fetch — output is a clearly-labelled dry-run simulation', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const res = advance({
      def: httpGraph(),
      agents: AGENTS,
      state: { __input: 'x' },
      startNodeId: 'start',
      ordinalStart: 1,
    });
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();

    const httpRecord = res.records.find((r) => r.nodeId === 'http1');
    expect(httpRecord?.output).toEqual({
      simulated: true,
      dryRun: true,
      method: 'GET',
      url: 'https://example.com/webhook',
      skipped: 'Connector Hub not live',
    });
    expect(res.status).toBe('Succeeded');
  });

  it('rejects a localhost/private-network URL even in dry-run', () => {
    const def = httpGraph();
    const node = def.nodes.find((n) => n.id === 'http1');
    if (node?.type === 'http') node.config.url = 'http://127.0.0.1:8080/hook';
    const res = validateBlueprint(def, SLUGS);
    expect(res.ok).toBe(false);
    expect(res.issues.some((i) => i.nodeId === 'http1')).toBe(true);
  });
});
