// @polsia:user-owned — pure semantic validation for a CARI Blueprint graph
// (beyond zod syntax — handover §13 "Semantic validation beyond syntax").
// No DB, no framework: takes a parsed definition (+ the known agent slugs)
// and returns structured issues, each anchored to a node where possible so
// the canvas can badge the offending node. Sibling convention:
// state-machine.ts (pure) vs service.ts (DB).

import type {
  BlueprintValidationT,
  CariBlueprintDefinitionT,
} from '@/lib/contracts/forge-canvas';

export function validateBlueprint(
  def: CariBlueprintDefinitionT,
  knownAgentSlugs: ReadonlySet<string>,
): BlueprintValidationT {
  const issues: BlueprintValidationT['issues'] = [];
  const push = (nodeId: string | null, message: string) => issues.push({ nodeId, message });

  const ids = new Set<string>();
  for (const n of def.nodes) {
    if (ids.has(n.id)) push(n.id, `Duplicate node id "${n.id}".`);
    ids.add(n.id);
  }

  const starts = def.nodes.filter((n) => n.type === 'start');
  const ends = def.nodes.filter((n) => n.type === 'end');
  if (starts.length !== 1) push(null, `Exactly one Start node is required (found ${starts.length}).`);
  if (ends.length < 1) push(null, 'At least one End node is required.');

  // Edge endpoints must exist; build adjacency as we go.
  const outgoing = new Map<string, { to: string; branch?: 'true' | 'false' }[]>();
  const incoming = new Map<string, string[]>();
  for (const e of def.edges) {
    if (!ids.has(e.from)) push(null, `Edge "${e.id}" starts at unknown node "${e.from}".`);
    if (!ids.has(e.to)) push(null, `Edge "${e.id}" ends at unknown node "${e.to}".`);
    if (ids.has(e.from) && ids.has(e.to)) {
      const list = outgoing.get(e.from) ?? [];
      list.push(e.branch ? { to: e.to, branch: e.branch } : { to: e.to });
      outgoing.set(e.from, list);
      const inc = incoming.get(e.to) ?? [];
      inc.push(e.from);
      incoming.set(e.to, inc);
    }
  }

  for (const n of def.nodes) {
    const out = outgoing.get(n.id) ?? [];
    const inc = incoming.get(n.id) ?? [];
    switch (n.type) {
      case 'start':
        if (inc.length > 0) push(n.id, 'Start must have no incoming connections.');
        if (out.length !== 1) push(n.id, 'Start needs exactly one outgoing connection.');
        break;
      case 'agent': {
        if (!knownAgentSlugs.has(n.config.agentSlug)) {
          push(n.id, `Unknown agent "${n.config.agentSlug}" — pick one from the registry.`);
        }
        if (inc.length < 1) push(n.id, 'Agent node is unreachable (no incoming connection).');
        if (out.length !== 1) push(n.id, 'Agent needs exactly one outgoing connection.');
        break;
      }
      case 'condition': {
        if (inc.length < 1) push(n.id, 'Condition node is unreachable (no incoming connection).');
        const trueEdges = out.filter((o) => o.branch === 'true');
        const falseEdges = out.filter((o) => o.branch === 'false');
        if (trueEdges.length !== 1 || falseEdges.length !== 1 || out.length !== 2) {
          push(n.id, 'Condition needs exactly two outgoing connections: one True, one False.');
        }
        if (!ids.has(n.config.sourceNodeId)) {
          push(n.id, `Condition reads output of unknown node "${n.config.sourceNodeId}".`);
        }
        break;
      }
      case 'approval':
        if (inc.length < 1) push(n.id, 'Approval node is unreachable (no incoming connection).');
        if (out.length !== 1) push(n.id, 'Approval needs exactly one outgoing connection.');
        break;
      case 'end':
        if (inc.length < 1) push(n.id, 'End node is unreachable (no incoming connection).');
        if (out.length > 0) push(n.id, 'End must have no outgoing connections.');
        break;
    }
  }

  // Reachability from Start + cycle detection (Release 1 runtime executes a
  // DAG; loops arrive with the Loop node in a later release).
  if (starts.length === 1) {
    const startId = starts[0]!.id;
    const visited = new Set<string>();
    const inStack = new Set<string>();
    let cycle = false;
    const walk = (id: string) => {
      if (inStack.has(id)) {
        cycle = true;
        return;
      }
      if (visited.has(id)) return;
      visited.add(id);
      inStack.add(id);
      for (const o of outgoing.get(id) ?? []) walk(o.to);
      inStack.delete(id);
    };
    walk(startId);
    if (cycle) push(null, 'The workflow contains a loop — Release 1 runs are one-way only.');
    for (const n of def.nodes) {
      if (!visited.has(n.id) && n.type !== 'start') {
        push(n.id, `"${n.label}" can never be reached from Start.`);
      }
    }
  }

  return { ok: issues.length === 0, issues };
}
