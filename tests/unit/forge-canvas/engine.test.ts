// Unit tests for the Forge Canvas pure engine + validator (Release 1
// vertical slice). Pure functions — no DB, no mocks.

import { describe, expect, it } from 'vitest';
import {
  advance,
  type AgentSnapshot,
  resumeAfterDecision,
  simulateAgent,
} from '@/lib/business/forge-canvas/engine';
import { validateBlueprint } from '@/lib/business/forge-canvas/validate';
import type { CariBlueprintDefinitionT } from '@/lib/contracts/forge-canvas';

const AGENTS = new Map<string, AgentSnapshot>([
  [
    'forge-discovery',
    { slug: 'forge-discovery', name: 'Discovery Agent', description: 'Frames needs.', riskClass: 'low' },
  ],
]);
const SLUGS = new Set(AGENTS.keys());

function bp(partial: Partial<CariBlueprintDefinitionT>): CariBlueprintDefinitionT {
  return {
    apiVersion: 'cariforge.ai/v1alpha1',
    kind: 'AgentWorkflow',
    objective: 'test',
    nodes: [],
    edges: [],
    ...partial,
  };
}

const P = { x: 0, y: 0 };

// A full valid slice graph: start -> agent -> condition -> (true: approval -> end) (false: end)
function fullGraph(): CariBlueprintDefinitionT {
  return bp({
    nodes: [
      { id: 'start', type: 'start', position: P, label: 'Start', config: { inputDescription: '' } },
      { id: 'a1', type: 'agent', position: P, label: 'Discovery', config: { agentSlug: 'forge-discovery' } },
      {
        id: 'c1',
        type: 'condition',
        position: P,
        label: 'Mentions claims?',
        config: { sourceNodeId: 'a1', contains: 'claims' },
      },
      { id: 'ap1', type: 'approval', position: P, label: 'Human gate', config: { title: 'Approve framing' } },
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

describe('validateBlueprint', () => {
  it('accepts the full slice graph', () => {
    expect(validateBlueprint(fullGraph(), SLUGS)).toEqual({ ok: true, issues: [] });
  });

  it('requires exactly one start', () => {
    const def = fullGraph();
    def.nodes = def.nodes.filter((n) => n.type !== 'start');
    const res = validateBlueprint(def, SLUGS);
    expect(res.ok).toBe(false);
    expect(res.issues.some((i) => i.message.includes('Exactly one Start'))).toBe(true);
  });

  it('flags an unknown agent slug on the offending node', () => {
    const def = fullGraph();
    const agent = def.nodes.find((n) => n.id === 'a1');
    if (agent?.type === 'agent') agent.config.agentSlug = 'nope';
    const res = validateBlueprint(def, SLUGS);
    expect(res.issues.some((i) => i.nodeId === 'a1' && i.message.includes('Unknown agent'))).toBe(true);
  });

  it('requires condition to have exactly one true and one false branch', () => {
    const def = fullGraph();
    def.edges = def.edges.filter((e) => e.id !== 'e4');
    const res = validateBlueprint(def, SLUGS);
    expect(res.issues.some((i) => i.nodeId === 'c1')).toBe(true);
  });

  it('detects loops', () => {
    const def = fullGraph();
    def.edges.push({ id: 'loop', from: 'ap1', to: 'a1' });
    const res = validateBlueprint(def, SLUGS);
    expect(res.issues.some((i) => i.message.includes('loop'))).toBe(true);
  });

  it('flags unreachable nodes', () => {
    const def = fullGraph();
    def.nodes.push({ id: 'orphan', type: 'end', position: P, label: 'Orphan', config: {} });
    const res = validateBlueprint(def, SLUGS);
    expect(res.issues.some((i) => i.nodeId === 'orphan')).toBe(true);
  });
});

describe('advance', () => {
  it('runs start -> agent -> condition(false) -> end without pausing', () => {
    const res = advance({
      def: fullGraph(),
      agents: AGENTS,
      state: { __input: 'nothing relevant here' },
      startNodeId: 'start',
      ordinalStart: 1,
    });
    expect(res.status).toBe('Succeeded');
    expect(res.records.map((r) => r.nodeId)).toEqual(['start', 'a1', 'c1', 'end2']);
    expect(res.pausedApproval).toBeNull();
  });

  it('pauses at approval on the true branch and records the trace so far', () => {
    const res = advance({
      def: fullGraph(),
      agents: AGENTS,
      state: { __input: 'we need to triage claims documents' },
      startNodeId: 'start',
      ordinalStart: 1,
    });
    expect(res.status).toBe('AwaitingApproval');
    expect(res.pausedApproval).toEqual({ nodeId: 'ap1', title: 'Approve framing' });
    expect(res.records.at(-1)).toMatchObject({ nodeId: 'ap1', status: 'AwaitingApproval' });
    // ordinals are sequential from 1
    expect(res.records.map((r) => r.ordinal)).toEqual([1, 2, 3, 4]);
  });

  it('simulated agent output is clearly labelled and never a real action', () => {
    const out = simulateAgent(AGENTS.get('forge-discovery')!, { some: 'input' }) as {
      simulated: boolean;
    };
    expect(out.simulated).toBe(true);
  });

  it('fails cleanly on a missing agent', () => {
    const def = fullGraph();
    const res = advance({
      def,
      agents: new Map(),
      state: { __input: 'x' },
      startNodeId: 'start',
      ordinalStart: 1,
    });
    expect(res.status).toBe('Failed');
    expect(res.records.at(-1)?.error).toContain('not in the registry');
  });
});

describe('resumeAfterDecision', () => {
  it('approval resumes to the end node', () => {
    const paused = advance({
      def: fullGraph(),
      agents: AGENTS,
      state: { __input: 'claims' },
      startNodeId: 'start',
      ordinalStart: 1,
    });
    const res = resumeAfterDecision({
      def: fullGraph(),
      agents: AGENTS,
      state: paused.state,
      approvalNodeId: 'ap1',
      decision: 'Approved',
      ordinalStart: 5,
    });
    expect(res.status).toBe('Succeeded');
    expect(res.records.map((r) => r.nodeId)).toEqual(['end1']);
    expect(res.records[0]?.ordinal).toBe(5);
  });

  it('rejection terminates the run without executing further nodes', () => {
    const res = resumeAfterDecision({
      def: fullGraph(),
      agents: AGENTS,
      state: {},
      approvalNodeId: 'ap1',
      decision: 'Rejected',
      ordinalStart: 5,
    });
    expect(res.status).toBe('Failed');
    expect(res.records).toEqual([]);
    expect(res.state['ap1']).toEqual({ decision: 'Rejected' });
  });
});
