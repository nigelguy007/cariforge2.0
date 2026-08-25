import { describe, expect, it } from 'vitest';

import { type CoreAgent, CoreAgents } from '@/lib/contracts/agents';

// The seven-agent core dataset is the public contract for /api/agents; the
// business/agents.ts module owns the `as const` export. To unit-test without
// pulling in `server-only`, mirror the dataset here in the test fixture and
// parse it through the shared contract — single source of truth is the
// contract shape; what changes between the live route and this test is only
// where the data lives.
const FIXTURE: { items: CoreAgent[] } = {
  items: [
    {
      id: 'discovery',
      ordinal: 1,
      role: 'Discovery',
      roleLong: 'Need Discovery agent',
      mandate:
        'Translates a one-line inbound brief into a testable problem statement card with named must-not-happen clauses and a named buyer approver.',
      relatesToStage: 'Discovery',
      scope: 'Pipeline',
    },
    {
      id: 'readiness',
      ordinal: 2,
      role: 'Readiness',
      roleLong: 'Readiness Review agent',
      mandate:
        'Audits data sources, integrations, and regulatory regimes before code; writes the build-vs-buy comparison statement.',
      relatesToStage: 'Readiness',
      scope: 'Pipeline',
    },
    {
      id: 'workflow',
      ordinal: 3,
      role: 'Workflow',
      roleLong: 'Workflow Design agent',
      mandate:
        'Designs the role/escalation diagram and per-regime SLAs; writes the typed note on downstream reuse.',
      relatesToStage: 'Workflow',
      scope: 'Pipeline',
    },
    {
      id: 'governance',
      ordinal: 4,
      role: 'Governance',
      roleLong: 'Governance Check agent',
      mandate:
        'Confirms logging, oversight, and stop-the-line controls; produces the binding spec handed to Agent 5 (AI Build).',
      relatesToStage: 'Governance',
      scope: 'Pipeline',
    },
    {
      id: 'ai-build',
      ordinal: 5,
      role: 'AI Build',
      roleLong: 'AI Build agent',
      mandate:
        'Runs Stage 5 (Software Build) of the pipeline and ships the runnable Next.js + TypeScript codebase.',
      relatesToStage: 'Software Build',
      scope: 'Pipeline',
    },
    {
      id: 'partner',
      ordinal: 6,
      role: 'Partner',
      roleLong: 'Partner agent',
      mandate:
        'Wraps around delivery; lands the runnable codebase on infrastructure the buyer operators can run.',
      relatesToStage: 'Wraparound',
      scope: 'Wraparound',
    },
    {
      id: 'impact',
      ordinal: 7,
      role: 'Impact',
      roleLong: 'Impact agent',
      mandate:
        'Wraps around delivery; measures the change in the world the build was meant to make.',
      relatesToStage: 'Wraparound',
      scope: 'Wraparound',
    },
  ],
};

describe('agents contract — seven-agent core', () => {
  const parsed = CoreAgents.parse(FIXTURE);
  const items = parsed.items;

  it('parses the seven-agent dataset round trip', () => {
    expect(items).toHaveLength(7);
  });

  it('lists exactly seven agents', () => {
    expect(items).toHaveLength(7);
  });

  it('uses ordinals 1..7 ascending, unique', () => {
    const ordinals = items.map((a) => a.ordinal);
    expect(ordinals).toEqual([1, 2, 3, 4, 5, 6, 7]);
    const sortedAsc = [...ordinals].sort((a, b) => a - b);
    expect(ordinals).toEqual(sortedAsc);
    expect(new Set(ordinals).size).toBe(7);
  });

  it('names Agent 5 as AI Build (not Software Build)', () => {
    expect(items[4]?.role).toBe('AI Build');
    expect(items[4]?.role).not.toBe('Software Build');
  });

  it('lists the canonical seven agent names in order', () => {
    const names = items.map((a) => a.role);
    expect(names).toEqual([
      'Discovery',
      'Readiness',
      'Workflow',
      'Governance',
      'AI Build',
      'Partner',
      'Impact',
    ]);
  });

  it('assigns distinct names — no collisions among the seven agents', () => {
    const names = items.map((a) => a.role);
    expect(new Set(names).size).toBe(7);
  });

  it('requires every mandate string to be non-empty', () => {
    for (const agent of items) {
      expect(agent.mandate.length).toBeGreaterThan(0);
      expect(agent.roleLong.length).toBeGreaterThan(0);
    }
  });

  it('maps Agents 1..4 to the first four pipeline stages', () => {
    expect(items[0]?.relatesToStage).toBe('Discovery');
    expect(items[1]?.relatesToStage).toBe('Readiness');
    expect(items[2]?.relatesToStage).toBe('Workflow');
    expect(items[3]?.relatesToStage).toBe('Governance');
  });

  it('maps Agent 5 (AI Build) to the Software Build stage — distinct agent name from stage name', () => {
    expect(items[4]?.relatesToStage).toBe('Software Build');
    // The contract is unambiguous: the agent is "AI Build", the stage is "Software Build".
    expect(items[4]?.role).not.toBe(items[4]?.relatesToStage);
  });

  it('marks Agents 6 (Partner) and 7 (Impact) as wraparound, not pipeline', () => {
    expect(items[5]?.relatesToStage).toBe('Wraparound');
    expect(items[5]?.scope).toBe('Wraparound');
    expect(items[6]?.relatesToStage).toBe('Wraparound');
    expect(items[6]?.scope).toBe('Wraparound');
  });

  it('does not assign an Agent name equal to the literal stage name "Software Build"', () => {
    const names = items.map((a) => a.role);
    expect(names).not.toContain('Software Build');
  });
});
