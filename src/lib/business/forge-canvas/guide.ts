// @polsia:user-owned — Forge Guide (PR B): deterministic TypeScript that
// turns a workflow-configurator result into a starter CARI Blueprint. This
// is NOT a second Claude persona and does not make its own model call —
// it reuses whatever getConfiguratorResult(description) already returned
// (business/configurator.ts) and compiles it into a graph with plain,
// auditable rules. Zod v3 only here (matches the shared, client-importable
// contracts) — never import the zod/v4 shadow schema from
// business/configurator.ts.
//
// The compiled graph is always a DRAFT: the canvas loads it, the author
// reviews and edits it like any other workflow, and nothing runs until
// they explicitly save and run it (POST /api/forge-canvas/guide never
// saves). A compiled graph always carries at least one human-approval
// node — there is no path through this compiler that produces a graph
// which can run to completion unattended.

import type { ConfiguratorResultT } from '@/lib/contracts/configurator';
import type {
  CanvasEdgeT,
  CanvasNodeT,
  CariBlueprintDefinitionT,
} from '@/lib/contracts/forge-canvas';
import { CREW_SLUG_BY_ROLE } from './crew-slugs';

const ROW_HEIGHT = 140;

function approveToRunNode(id: string, y: number, title: string): CanvasNodeT {
  return { id, type: 'approval', position: { x: 0, y }, label: title, config: { title } };
}

// PR C: emitted instead of a sequential agent chain once three or more
// agents are in focus — see the module-level "PR C" section below.
const STANDARD_APPROVAL_TITLE = 'Approve to run this draft';

export function compileGuideDraft(args: {
  description: string;
  result: ConfiguratorResultT;
}): CariBlueprintDefinitionT {
  const { description, result } = args;

  // Map configurator roles -> real seeded crew slugs (A1). Skip anything
  // unmapped (should not happen once every CONFIGURATOR_AGENT_VALUES role
  // has a CREW_SLUG_BY_ROLE entry — see crew-slugs.test.ts) and de-dupe a
  // role the model happened to name twice, so node ids stay unique.
  const seen = new Set<string>();
  const agentSlugs: string[] = [];
  for (const focus of result.agentFocus) {
    const slug = CREW_SLUG_BY_ROLE[focus.agent];
    if (!slug || seen.has(slug)) continue;
    seen.add(slug);
    agentSlugs.push(slug);
  }

  const nodes: CanvasNodeT[] = [];
  const edges: CanvasEdgeT[] = [];
  let y = 0;
  const row = () => {
    const v = y;
    y += ROW_HEIGHT;
    return v;
  };

  nodes.push({
    id: 'start',
    type: 'start',
    position: { x: 0, y: row() },
    label: 'Start',
    config: { inputDescription: description.slice(0, 500) },
  });

  // PR C: three or more agents in focus route through a Conductor instead
  // of a straight chain — see the sibling block below. One or two agents
  // stay the PR B sequential chain.
  let prevId = 'start';
  let lastAgentId = 'start';
  if (agentSlugs.length >= 3) {
    const conductorId = 'conductor';
    nodes.push({
      id: conductorId,
      type: 'conductor',
      position: { x: 0, y: row() },
      label: 'Route across the focus agents',
      config: {
        allowedAgentSlugs: agentSlugs,
        // Routes from the first word of each focus item's "why" — a
        // short, deterministic keyword per allowlisted agent, same
        // "does the upstream output contain X" rule the condition node
        // uses. First-word-per-agent keeps every route distinct even
        // when two "why"s share later words.
        routes: result.agentFocus
          .filter((f) => seen.has(CREW_SLUG_BY_ROLE[f.agent] ?? ''))
          .map((f) => ({
            contains: (f.why.trim().split(/\s+/)[0] ?? f.agent).slice(0, 200),
            agentSlug: CREW_SLUG_BY_ROLE[f.agent] as string,
          })),
        maxCalls: Math.min(8, Math.max(agentSlugs.length, 2)),
        fallback: 'approval',
      },
    });
    edges.push({ id: `e-${prevId}-${conductorId}`, from: prevId, to: conductorId });
    prevId = conductorId;
    lastAgentId = conductorId;
  } else {
    for (const slug of agentSlugs) {
      const id = `agent-${slug}`;
      const role =
        result.agentFocus.find((f) => CREW_SLUG_BY_ROLE[f.agent] === slug)?.agent ?? slug;
      nodes.push({
        id,
        type: 'agent',
        position: { x: 0, y: row() },
        label: role,
        config: { agentSlug: slug },
      });
      edges.push({ id: `e-${prevId}-${id}`, from: prevId, to: id });
      prevId = id;
      lastAgentId = id;
    }
  }

  const needsRiskCheck = result.fit !== 'strong' || result.riskFlags.length > 0;

  if (needsRiskCheck) {
    const conditionId = 'risk-check';
    const contains = (result.riskFlags[0] ?? 'risk').slice(0, 200);
    nodes.push({
      id: conditionId,
      type: 'condition',
      position: { x: 0, y: row() },
      label: 'Risk check',
      config: { sourceNodeId: lastAgentId, contains },
    });
    edges.push({ id: `e-${prevId}-${conditionId}`, from: prevId, to: conditionId });

    const approvalRow = row();
    const apRiskId = 'ap-risk';
    const apStandardId = 'ap-standard';
    nodes.push({
      id: apRiskId,
      type: 'approval',
      position: { x: -140, y: approvalRow },
      label: contains,
      config: { title: contains },
    });
    nodes.push(approveToRunNode(apStandardId, approvalRow, STANDARD_APPROVAL_TITLE));
    edges.push({
      id: `e-${conditionId}-${apRiskId}`,
      from: conditionId,
      to: apRiskId,
      branch: 'true',
    });
    edges.push({
      id: `e-${conditionId}-${apStandardId}`,
      from: conditionId,
      to: apStandardId,
      branch: 'false',
    });

    const endId = 'end';
    nodes.push({ id: endId, type: 'end', position: { x: 0, y: row() }, label: 'End', config: {} });
    edges.push({ id: `e-${apRiskId}-${endId}`, from: apRiskId, to: endId });
    edges.push({ id: `e-${apStandardId}-${endId}`, from: apStandardId, to: endId });
  } else {
    // Always at least one human approval, even on a "strong fit" read —
    // the Configurator's read is indicative, never a substitute for a
    // named human deciding before anything real runs.
    const apId = 'ap-standard';
    nodes.push(approveToRunNode(apId, row(), STANDARD_APPROVAL_TITLE));
    edges.push({ id: `e-${prevId}-${apId}`, from: prevId, to: apId });
    const endId = 'end';
    nodes.push({ id: endId, type: 'end', position: { x: 0, y: row() }, label: 'End', config: {} });
    edges.push({ id: `e-${apId}-${endId}`, from: apId, to: endId });
  }

  return {
    apiVersion: 'cariforge.ai/v1alpha1',
    kind: 'AgentWorkflow',
    objective: result.summary.slice(0, 500),
    nodes,
    edges,
  };
}

// Turns the free-text description into a starter slug/name for the
// "Save version" fields the canvas pre-fills after a guide draft loads —
// the author can freely edit either before actually saving.
export function suggestNameAndSlug(description: string): { name: string; slug: string } {
  const words = description.trim().split(/\s+/).filter(Boolean).slice(0, 8).join(' ');
  const name = (words || 'Untitled workflow').slice(0, 120);
  const slug =
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80) || 'guide-draft';
  return { name, slug };
}

// Used when the Configurator model itself is unavailable (no API key, or
// the call failed) — a minimal, always-valid starter so the "Draft on
// canvas" button never dead-ends into an error with nothing to show.
export function fallbackGuideDraft(description: string): CariBlueprintDefinitionT {
  return {
    apiVersion: 'cariforge.ai/v1alpha1',
    kind: 'AgentWorkflow',
    objective:
      'Offline starter — the Configurator model was unavailable, so this is a minimal template, not a read of your description. Review and edit before running.',
    nodes: [
      {
        id: 'start',
        type: 'start',
        position: { x: 0, y: 0 },
        label: 'Start',
        config: { inputDescription: description.slice(0, 500) },
      },
      {
        id: 'agent-forge-discovery',
        type: 'agent',
        position: { x: 0, y: ROW_HEIGHT },
        label: 'Discovery (offline starter)',
        config: { agentSlug: 'forge-discovery' },
      },
      approveToRunNode('ap-standard', ROW_HEIGHT * 2, STANDARD_APPROVAL_TITLE),
      { id: 'end', type: 'end', position: { x: 0, y: ROW_HEIGHT * 3 }, label: 'End', config: {} },
    ],
    edges: [
      { id: 'e-start-agent', from: 'start', to: 'agent-forge-discovery' },
      { id: 'e-agent-ap', from: 'agent-forge-discovery', to: 'ap-standard' },
      { id: 'e-ap-end', from: 'ap-standard', to: 'end' },
    ],
  };
}
