// @polsia:user-owned — pure execution engine for the Forge Canvas safe
// test runtime (Release 1). No DB, no framework, no network: given a
// validated blueprint, the agent registry snapshot and the accumulated run
// state, it advances node-by-node until it reaches an approval (pause), an
// end (success) or a failure — returning the node-run records to persist.
// The DB wrapper lives in service.ts; keeping this pure makes the runtime
// unit-testable the same way state-machine.ts is.
//
// Agent execution here is a DELIBERATE deterministic simulation (handover
// Release 1: "Execute one workflow in a safe test runtime") — it never
// calls a model or an external system, so a test run can't take a real
// action or spend money. The executor seam (`AgentExecutor`) is where a
// governed LLM/tool runtime plugs in from Release 2 onward.

import type { CanvasNodeT, CariBlueprintDefinitionT } from '@/lib/contracts/forge-canvas';

export interface AgentSnapshot {
  slug: string;
  name: string;
  description: string;
  riskClass: string;
}

export type RunState = Record<string, unknown>;

export interface NodeRunDraft {
  ordinal: number;
  nodeId: string;
  nodeType: string;
  status: 'Succeeded' | 'Failed' | 'AwaitingApproval';
  input: unknown;
  output: unknown | null;
  error: string | null;
}

export interface AdvanceResult {
  records: NodeRunDraft[];
  state: RunState;
  status: 'AwaitingApproval' | 'Succeeded' | 'Failed';
  currentNodeId: string | null;
  pausedApproval: { nodeId: string; title: string } | null;
}

export type AgentExecutor = (agent: AgentSnapshot, input: unknown) => unknown;

// Default safe executor: a structured, clearly-labelled simulation.
export const simulateAgent: AgentExecutor = (agent, input) => ({
  simulated: true,
  agent: agent.slug,
  agentName: agent.name,
  summary: `[Safe test run] ${agent.name} processed the input and produced a simulated result. ${agent.description}`,
  receivedInput: input,
});

function nodeById(def: CariBlueprintDefinitionT, id: string): CanvasNodeT | undefined {
  return def.nodes.find((n) => n.id === id);
}

function singleNext(def: CariBlueprintDefinitionT, from: string): string | null {
  const out = def.edges.filter((e) => e.from === from);
  return out.length === 1 ? out[0]!.to : null;
}

function branchNext(
  def: CariBlueprintDefinitionT,
  from: string,
  branch: 'true' | 'false',
): string | null {
  const edge = def.edges.find((e) => e.from === from && e.branch === branch);
  return edge ? edge.to : null;
}

const MAX_STEPS = 200; // backstop far above any valid Release-1 graph

// Advance from `startNodeId` (inclusive) until pause/terminal. `state`
// maps nodeId -> that node's output; the caller persists returned records.
export function advance(args: {
  def: CariBlueprintDefinitionT;
  agents: ReadonlyMap<string, AgentSnapshot>;
  state: RunState;
  startNodeId: string;
  ordinalStart: number;
  executeAgent?: AgentExecutor;
}): AdvanceResult {
  const { def, agents } = args;
  const executeAgent = args.executeAgent ?? simulateAgent;
  const state: RunState = { ...args.state };
  const records: NodeRunDraft[] = [];
  let ordinal = args.ordinalStart;
  let currentId: string | null = args.startNodeId;
  let steps = 0;

  const fail = (nodeId: string, nodeType: string, input: unknown, error: string): AdvanceResult => {
    records.push({ ordinal, nodeId, nodeType, status: 'Failed', input, output: null, error });
    return { records, state, status: 'Failed', currentNodeId: nodeId, pausedApproval: null };
  };

  while (currentId) {
    if (++steps > MAX_STEPS) {
      return fail(currentId, 'unknown', null, 'Step limit exceeded — runaway run stopped.');
    }
    const node = nodeById(def, currentId);
    if (!node)
      return fail(currentId, 'unknown', null, `Node "${currentId}" not found in blueprint.`);

    switch (node.type) {
      case 'start': {
        const output = { input: state['__input'] ?? '' };
        state[node.id] = output;
        records.push({
          ordinal: ordinal++,
          nodeId: node.id,
          nodeType: 'start',
          status: 'Succeeded',
          input: state['__input'] ?? '',
          output,
          error: null,
        });
        currentId = singleNext(def, node.id);
        if (!currentId) return fail(node.id, 'start', null, 'Start has no outgoing connection.');
        break;
      }
      case 'agent': {
        const agent = agents.get(node.config.agentSlug);
        const upstreamEdge = def.edges.find((e) => e.to === node.id);
        const input = upstreamEdge ? (state[upstreamEdge.from] ?? null) : null;
        if (!agent) {
          return fail(
            node.id,
            'agent',
            input,
            `Agent "${node.config.agentSlug}" is not in the registry.`,
          );
        }
        const output = executeAgent(agent, input);
        state[node.id] = output;
        records.push({
          ordinal: ordinal++,
          nodeId: node.id,
          nodeType: 'agent',
          status: 'Succeeded',
          input,
          output,
          error: null,
        });
        currentId = singleNext(def, node.id);
        if (!currentId) return fail(node.id, 'agent', input, 'Agent has no outgoing connection.');
        break;
      }
      case 'condition': {
        const sourceOutput = state[node.config.sourceNodeId];
        const haystack = JSON.stringify(sourceOutput ?? '').toLowerCase();
        const result = haystack.includes(node.config.contains.toLowerCase());
        const output = { result, checkedFor: node.config.contains };
        state[node.id] = output;
        records.push({
          ordinal: ordinal++,
          nodeId: node.id,
          nodeType: 'condition',
          status: 'Succeeded',
          input: sourceOutput ?? null,
          output,
          error: null,
        });
        currentId = branchNext(def, node.id, result ? 'true' : 'false');
        if (!currentId) {
          return fail(node.id, 'condition', sourceOutput ?? null, `No ${result} branch connected.`);
        }
        break;
      }
      case 'approval': {
        const upstreamEdge = def.edges.find((e) => e.to === node.id);
        const input = upstreamEdge ? (state[upstreamEdge.from] ?? null) : null;
        records.push({
          ordinal: ordinal++,
          nodeId: node.id,
          nodeType: 'approval',
          status: 'AwaitingApproval',
          input,
          output: null,
          error: null,
        });
        return {
          records,
          state,
          status: 'AwaitingApproval',
          currentNodeId: node.id,
          pausedApproval: { nodeId: node.id, title: node.config.title },
        };
      }
      case 'end': {
        records.push({
          ordinal: ordinal++,
          nodeId: node.id,
          nodeType: 'end',
          status: 'Succeeded',
          input: null,
          output: null,
          error: null,
        });
        return { records, state, status: 'Succeeded', currentNodeId: null, pausedApproval: null };
      }
      // PR C: routes to at most one allowlisted agent per call, still via
      // executeAgent (simulateAgent by default) — never a live call. The
      // allowlist is enforced here too, not just at validate time: never
      // trust a later model pick over what was configured on save.
      case 'conductor': {
        const upstreamEdge = def.edges.find((e) => e.to === node.id);
        const upstream = upstreamEdge ? (state[upstreamEdge.from] ?? null) : null;
        const haystack = JSON.stringify(upstream ?? '').toLowerCase();
        const callsKey = `__conductorCalls:${node.id}`;
        const calls = (state[callsKey] as number | undefined) ?? 0;

        let output: unknown;
        if (calls >= node.config.maxCalls) {
          output = { routed: false, reason: 'max-calls' };
        } else {
          const match = node.config.routes.find((r) => haystack.includes(r.contains.toLowerCase()));
          if (!match) {
            output = { routed: false, reason: 'no-match' };
          } else if (!node.config.allowedAgentSlugs.includes(match.agentSlug)) {
            return fail(
              node.id,
              'conductor',
              upstream,
              `Policy blocked route to "${match.agentSlug}" — not in this Conductor's allowlist.`,
            );
          } else {
            const agent = agents.get(match.agentSlug);
            if (!agent) {
              return fail(
                node.id,
                'conductor',
                upstream,
                `Routed agent "${match.agentSlug}" is not in the registry.`,
              );
            }
            const agentOutput = executeAgent(agent, upstream);
            state[callsKey] = calls + 1;
            output = { routed: true, routedTo: match.agentSlug, simulated: true, agentOutput };
          }
        }

        state[node.id] = output;
        records.push({
          ordinal: ordinal++,
          nodeId: node.id,
          nodeType: 'conductor',
          status: 'Succeeded',
          input: upstream,
          output,
          error: null,
        });
        currentId = singleNext(def, node.id);
        if (!currentId)
          return fail(node.id, 'conductor', upstream, 'Conductor has no outgoing connection.');
        break;
      }
      // PR C: never fetches — Connector Hub isn't live. A labelled,
      // clearly-simulated result, same spirit as simulateAgent().
      case 'http': {
        const upstreamEdge = def.edges.find((e) => e.to === node.id);
        const upstream = upstreamEdge ? (state[upstreamEdge.from] ?? null) : null;
        const output = {
          simulated: true,
          dryRun: true,
          method: node.config.method,
          url: node.config.url,
          skipped: 'Connector Hub not live',
        };
        state[node.id] = output;
        records.push({
          ordinal: ordinal++,
          nodeId: node.id,
          nodeType: 'http',
          status: 'Succeeded',
          input: upstream,
          output,
          error: null,
        });
        currentId = singleNext(def, node.id);
        if (!currentId)
          return fail(node.id, 'http', upstream, 'HTTP node has no outgoing connection.');
        break;
      }
    }
  }
  return fail('unknown', 'unknown', null, 'Run ended without reaching an End node.');
}

// Continue after a human decision on an approval node. Approved follows
// the single outgoing edge; Rejected terminates the run.
export function resumeAfterDecision(args: {
  def: CariBlueprintDefinitionT;
  agents: ReadonlyMap<string, AgentSnapshot>;
  state: RunState;
  approvalNodeId: string;
  decision: 'Approved' | 'Rejected';
  ordinalStart: number;
  executeAgent?: AgentExecutor;
}): AdvanceResult {
  const { def, approvalNodeId, decision } = args;
  const state: RunState = { ...args.state };
  state[approvalNodeId] = { decision };
  if (decision === 'Rejected') {
    return {
      records: [],
      state,
      status: 'Failed',
      currentNodeId: approvalNodeId,
      pausedApproval: null,
    };
  }
  const next = def.edges.find((e) => e.from === approvalNodeId)?.to;
  if (!next) {
    return {
      records: [
        {
          ordinal: args.ordinalStart,
          nodeId: approvalNodeId,
          nodeType: 'approval',
          status: 'Failed',
          input: null,
          output: null,
          error: 'Approval has no outgoing connection.',
        },
      ],
      state,
      status: 'Failed',
      currentNodeId: approvalNodeId,
      pausedApproval: null,
    };
  }
  return advance({
    def,
    agents: args.agents,
    state,
    startNodeId: next,
    ordinalStart: args.ordinalStart,
    ...(args.executeAgent ? { executeAgent: args.executeAgent } : {}),
  });
}
