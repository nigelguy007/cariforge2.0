// @polsia:user-owned — shared zod contracts for the Forge Canvas (Agent
// Builder Release 1 vertical slice). One source of truth shared between
// the /api/forge-canvas/* handlers (server) and the canvas/Approval Desk
// client islands. Client-importable: zod only, no server-only imports.
//
// The CARI Blueprint here is the canonical workflow definition — the
// visual canvas is generated FROM it and serialises back TO it (handover
// §13: "Visual canvas generated from the blueprint. Blueprint generated
// from the canvas."). Release 1 node set: start, agent, condition,
// approval, end.

import { z } from 'zod';

// ── Node types ──────────────────────────────────────────────────────────────

export const CANVAS_NODE_TYPES = ['start', 'agent', 'condition', 'approval', 'end'] as const;
export type CanvasNodeType = (typeof CANVAS_NODE_TYPES)[number];

const NodeBase = z.object({
  id: z.string().min(1).max(64),
  // Canvas position — presentation-only, carried in the blueprint so a
  // reopened canvas restores exactly; the runtime ignores it.
  position: z.object({ x: z.number(), y: z.number() }),
  label: z.string().min(1).max(120),
});

export const StartNode = NodeBase.extend({
  type: z.literal('start'),
  config: z.object({
    // Free-text input handed to the run as its initial state.
    inputDescription: z.string().max(500),
  }),
});

export const AgentNode = NodeBase.extend({
  type: z.literal('agent'),
  config: z.object({
    // References CanvasAgentDefinition.slug — validated server-side
    // against the registry at save/run time (not here; the contract
    // can't see the DB).
    agentSlug: z.string().min(1),
  }),
});

export const ConditionNode = NodeBase.extend({
  type: z.literal('condition'),
  config: z.object({
    // Release 1 condition: does the named upstream node's output text
    // contain `contains` (case-insensitive)? True edge vs false edge.
    // Deliberately deterministic — no LLM decides a branch (handover
    // priority 5: deterministic workflow controls).
    sourceNodeId: z.string().min(1),
    contains: z.string().min(1).max(200),
  }),
});

export const ApprovalNode = NodeBase.extend({
  type: z.literal('approval'),
  config: z.object({
    title: z.string().min(1).max(200),
    // Release 1: any signed-in user may decide; role scoping arrives with
    // Trust Centre RBAC in a later release.
  }),
});

export const EndNode = NodeBase.extend({
  type: z.literal('end'),
  config: z.object({}),
});

export const CanvasNode = z.discriminatedUnion('type', [
  StartNode,
  AgentNode,
  ConditionNode,
  ApprovalNode,
  EndNode,
]);
export type CanvasNodeT = z.infer<typeof CanvasNode>;

// ── Edges ───────────────────────────────────────────────────────────────────

export const CanvasEdge = z.object({
  id: z.string().min(1).max(128),
  from: z.string().min(1),
  to: z.string().min(1),
  // Condition nodes label their two outgoing edges; every other node
  // leaves this undefined.
  branch: z.enum(['true', 'false']).optional(),
});
export type CanvasEdgeT = z.infer<typeof CanvasEdge>;

// ── Blueprint ───────────────────────────────────────────────────────────────

export const CariBlueprintDefinition = z.object({
  apiVersion: z.literal('cariforge.ai/v1alpha1'),
  kind: z.literal('AgentWorkflow'),
  objective: z.string().max(500),
  nodes: z.array(CanvasNode).min(1).max(60),
  edges: z.array(CanvasEdge).max(120),
});
export type CariBlueprintDefinitionT = z.infer<typeof CariBlueprintDefinition>;

export const BlueprintSave = z.object({
  slug: z
    .string()
    .min(1)
    .max(80)
    .regex(/^[a-z0-9][a-z0-9-]*$/, 'Lowercase letters, numbers and hyphens only.'),
  name: z.string().min(1).max(120),
  definition: CariBlueprintDefinition,
});
export type BlueprintSaveT = z.infer<typeof BlueprintSave>;

export const BlueprintItem = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  version: z.number().int(),
  definition: CariBlueprintDefinition,
  createdAt: z.string(),
});
export type BlueprintItemT = z.infer<typeof BlueprintItem>;

export const BlueprintList = z.object({
  // Latest version per slug.
  items: z.array(BlueprintItem.omit({ definition: true })),
});
export type BlueprintListT = z.infer<typeof BlueprintList>;

// ── Validation result ───────────────────────────────────────────────────────

export const BlueprintIssue = z.object({
  nodeId: z.string().nullable(), // null = graph-level issue
  message: z.string(),
});
export const BlueprintValidation = z.object({
  ok: z.boolean(),
  issues: z.array(BlueprintIssue),
});
export type BlueprintValidationT = z.infer<typeof BlueprintValidation>;

// ── Agent registry ──────────────────────────────────────────────────────────

export const CanvasAgentItem = z.object({
  slug: z.string(),
  name: z.string(),
  version: z.number().int(),
  category: z.string(),
  description: z.string(),
  riskClass: z.enum(['low', 'medium', 'high']),
});
export type CanvasAgentItemT = z.infer<typeof CanvasAgentItem>;

export const CanvasAgentList = z.object({ items: z.array(CanvasAgentItem) });
export type CanvasAgentListT = z.infer<typeof CanvasAgentList>;

// ── Runs & trace ────────────────────────────────────────────────────────────

export const RUN_STATUS_VALUES = [
  'Running',
  'AwaitingApproval',
  'Succeeded',
  'Failed',
  'Rejected',
] as const;

export const NodeRunItem = z.object({
  ordinal: z.number().int(),
  nodeId: z.string(),
  nodeType: z.string(),
  status: z.string(),
  input: z.unknown(),
  output: z.unknown().nullable(),
  error: z.string().nullable(),
  startedAt: z.string(),
  finishedAt: z.string().nullable(),
});

export const CanvasRunDetail = z.object({
  id: z.string(),
  blueprintSlug: z.string(),
  blueprintName: z.string(),
  blueprintVersion: z.number().int(),
  status: z.enum(RUN_STATUS_VALUES),
  currentNodeId: z.string().nullable(),
  startedAt: z.string(),
  finishedAt: z.string().nullable(),
  nodeRuns: z.array(NodeRunItem),
  openTaskId: z.string().nullable(),
});
export type CanvasRunDetailT = z.infer<typeof CanvasRunDetail>;

export const CanvasRunList = z.object({
  items: z.array(
    CanvasRunDetail.omit({ nodeRuns: true, openTaskId: true, currentNodeId: true }),
  ),
});
export type CanvasRunListT = z.infer<typeof CanvasRunList>;

export const RunStart = z.object({
  slug: z.string().min(1),
  version: z.number().int().optional(), // omit = latest
  input: z.string().max(4000).default(''),
});
export type RunStartT = z.infer<typeof RunStart>;

// ── Approval Desk ───────────────────────────────────────────────────────────

export const CanvasTaskItem = z.object({
  id: z.string(),
  runId: z.string(),
  nodeId: z.string(),
  title: z.string(),
  status: z.enum(['Open', 'Approved', 'Rejected']),
  reasonText: z.string().nullable(),
  createdAt: z.string(),
  decidedAt: z.string().nullable(),
  blueprintName: z.string(),
  // What the approver must see before deciding (handover §17): the
  // upstream evidence — latest agent output preceding this approval.
  evidence: z.unknown().nullable(),
});
export type CanvasTaskItemT = z.infer<typeof CanvasTaskItem>;

export const CanvasTaskList = z.object({ items: z.array(CanvasTaskItem) });
export type CanvasTaskListT = z.infer<typeof CanvasTaskList>;

export const TaskDecide = z.object({
  decision: z.enum(['Approved', 'Rejected']),
  reasonText: z.string().min(1, 'A typed reason is required.').max(2000),
});
export type TaskDecideT = z.infer<typeof TaskDecide>;
