// Unit tests for the Forge Guide compiler (PR B). Pure function tests —
// no Anthropic call, no DB: compileGuideDraft/fallbackGuideDraft take a
// (hand-built) ConfiguratorResultT and return a CariBlueprintDefinitionT,
// which we then re-check with the real validateBlueprint against a
// registry of every seeded Forge Crew slug.

import { describe, expect, it } from 'vitest';
import { CREW_SLUG_BY_ROLE } from '@/lib/business/forge-canvas/crew-slugs';
import { compileGuideDraft, fallbackGuideDraft } from '@/lib/business/forge-canvas/guide';
import { validateBlueprint } from '@/lib/business/forge-canvas/validate';
import type { ConfiguratorResultT } from '@/lib/contracts/configurator';
import type { CariBlueprintDefinitionT } from '@/lib/contracts/forge-canvas';

// Every forge-* slug the crew-slugs mapping can ever produce, plus one
// ops-* slug thrown in to prove the assertion below is actually testing
// something (a graph that used ops-* would still "pass" a registry that
// only ever contained forge-* slugs).
const REGISTRY = new Set([...Object.values(CREW_SLUG_BY_ROLE), 'ops-invoice-extraction']);

function nodesByType(def: CariBlueprintDefinitionT, type: string) {
  return def.nodes.filter((n) => n.type === type);
}

describe('compileGuideDraft', () => {
  it('strong fit, two agents, no risk flags: Start-agent-agent-approval-End, valid', () => {
    const result: ConfiguratorResultT = {
      fit: 'strong',
      summary: 'A well-scoped invoice triage workflow with a named owner.',
      agentFocus: [
        { agent: 'Discovery', why: 'Frames the intake.' },
        { agent: 'Readiness', why: 'Checks data access.' },
      ],
      riskFlags: [],
      clarifyingQuestions: [],
    };
    const def = compileGuideDraft({ description: 'Triage inbound invoices.', result });

    expect(def.nodes.map((n) => n.type)).toEqual(['start', 'agent', 'agent', 'approval', 'end']);
    expect(
      nodesByType(def, 'agent').map(
        (n) => (n as { config: { agentSlug: string } }).config.agentSlug,
      ),
    ).toEqual(['forge-discovery', 'forge-readiness']);
    const validation = validateBlueprint(def, REGISTRY);
    expect(validation).toEqual({ ok: true, issues: [] });
  });

  it('unlikely fit with risk flags: condition with both branches, an approval on each', () => {
    const result: ConfiguratorResultT = {
      fit: 'unlikely',
      summary: 'Fully autonomous trading — no human in the loop.',
      agentFocus: [{ agent: 'Governance', why: 'Flags the missing oversight.' }],
      riskFlags: ['No human approval before trades execute.'],
      clarifyingQuestions: ['Who authorises a trade?'],
    };
    const def = compileGuideDraft({ description: 'Autonomous trading bot.', result });

    const condition = def.nodes.find((n) => n.type === 'condition');
    expect(condition).toBeDefined();
    const trueEdges = def.edges.filter((e) => e.from === condition?.id && e.branch === 'true');
    const falseEdges = def.edges.filter((e) => e.from === condition?.id && e.branch === 'false');
    expect(trueEdges).toHaveLength(1);
    expect(falseEdges).toHaveLength(1);

    const approvals = nodesByType(def, 'approval');
    expect(approvals.length).toBeGreaterThanOrEqual(2);
    // Both branches lead to a real approval node, not straight to End.
    const approvalIds = new Set(approvals.map((n) => n.id));
    expect(approvalIds.has(trueEdges[0]?.to ?? '')).toBe(true);
    expect(approvalIds.has(falseEdges[0]?.to ?? '')).toBe(true);

    const validation = validateBlueprint(def, REGISTRY);
    expect(validation).toEqual({ ok: true, issues: [] });
  });

  it('possible fit with no risk flags still adds a risk-check branch (fit !== strong)', () => {
    const result: ConfiguratorResultT = {
      fit: 'possible',
      summary: 'Plausible but under-specified.',
      agentFocus: [{ agent: 'Workflow', why: 'Needs the escalation path.' }],
      riskFlags: [],
      clarifyingQuestions: [],
    };
    const def = compileGuideDraft({ description: 'Some workflow.', result });
    expect(def.nodes.some((n) => n.type === 'condition')).toBe(true);
    expect(validateBlueprint(def, REGISTRY)).toEqual({ ok: true, issues: [] });
  });

  it('every mapped agent node uses a forge-* slug, never ops-*', () => {
    const result: ConfiguratorResultT = {
      fit: 'strong',
      summary: 'Fine.',
      agentFocus: [
        { agent: 'Discovery', why: 'a' },
        { agent: 'Impact', why: 'b' },
        { agent: 'Partner', why: 'c' },
      ],
      riskFlags: [],
      clarifyingQuestions: [],
    };
    const def = compileGuideDraft({ description: 'x', result });
    for (const n of def.nodes) {
      if (n.type === 'agent') expect(n.config.agentSlug.startsWith('forge-')).toBe(true);
      if (n.type === 'conductor') {
        for (const slug of n.config.allowedAgentSlugs) expect(slug.startsWith('forge-')).toBe(true);
      }
    }
  });

  it('never compiles a graph without at least one approval node', () => {
    const cases: ConfiguratorResultT[] = [
      {
        fit: 'strong',
        summary: 's',
        agentFocus: [{ agent: 'Discovery', why: 'w' }],
        riskFlags: [],
        clarifyingQuestions: [],
      },
      {
        fit: 'unlikely',
        summary: 's',
        agentFocus: [{ agent: 'Discovery', why: 'w' }],
        riskFlags: ['bad'],
        clarifyingQuestions: [],
      },
    ];
    for (const result of cases) {
      const def = compileGuideDraft({ description: 'd', result });
      expect(def.nodes.some((n) => n.type === 'approval')).toBe(true);
    }
  });
});

describe('compileGuideDraft — PR C Conductor emission', () => {
  it('three or more agents in focus emit Start -> Conductor -> Approval -> End, not a sequential chain', () => {
    const result: ConfiguratorResultT = {
      fit: 'strong',
      summary: 'A three-agent case.',
      agentFocus: [
        { agent: 'Discovery', why: 'Frames intake.' },
        { agent: 'Readiness', why: 'Checks access.' },
        { agent: 'Governance', why: 'Flags policy gaps.' },
      ],
      riskFlags: [],
      clarifyingQuestions: [],
    };
    const def = compileGuideDraft({ description: 'A three-way routed workflow.', result });

    expect(def.nodes.some((n) => n.type === 'agent')).toBe(false);
    const conductor = def.nodes.find((n) => n.type === 'conductor');
    expect(conductor).toBeDefined();
    if (conductor?.type === 'conductor') {
      expect(conductor.config.allowedAgentSlugs.sort()).toEqual(
        ['forge-discovery', 'forge-governance', 'forge-readiness'].sort(),
      );
      expect(conductor.config.routes).toHaveLength(3);
      for (const route of conductor.config.routes) {
        expect(conductor.config.allowedAgentSlugs).toContain(route.agentSlug);
      }
    }
    expect(def.nodes.some((n) => n.type === 'approval')).toBe(true);
    const validation = validateBlueprint(def, REGISTRY);
    expect(validation).toEqual({ ok: true, issues: [] });
  });

  it('one or two agents in focus stay the PR B sequential chain, never a Conductor', () => {
    const result: ConfiguratorResultT = {
      fit: 'strong',
      summary: 'Two agents.',
      agentFocus: [
        { agent: 'Discovery', why: 'a' },
        { agent: 'Partner', why: 'b' },
      ],
      riskFlags: [],
      clarifyingQuestions: [],
    };
    const def = compileGuideDraft({ description: 'x', result });
    expect(def.nodes.some((n) => n.type === 'conductor')).toBe(false);
    expect(def.nodes.filter((n) => n.type === 'agent')).toHaveLength(2);
  });
});

describe('fallbackGuideDraft', () => {
  it('is a valid Start -> forge-discovery -> Approval -> End graph', () => {
    const def = fallbackGuideDraft('Something the model never saw.');
    expect(def.nodes.map((n) => n.type)).toEqual(['start', 'agent', 'approval', 'end']);
    const agent = def.nodes.find((n) => n.type === 'agent');
    expect(agent?.type === 'agent' && agent.config.agentSlug).toBe('forge-discovery');
    expect(validateBlueprint(def, REGISTRY)).toEqual({ ok: true, issues: [] });
  });
});
