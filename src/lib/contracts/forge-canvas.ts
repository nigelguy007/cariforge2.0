// @polsia:user-owned — shared zod contracts for the Forge Canvas (Agent
// Builder Release 1 vertical slice). One source of truth shared between
// the /api/forge-canvas/* handlers (server) and the canvas/Approval Desk
// client islands. Client-importable: zod only, no server-only imports.
//
// The CARI Blueprint here is the canonical workflow definition — the
// visual canvas is generated FROM it and serialises back TO it (handover
// §13: "Visual canvas generated from the blueprint. Blueprint generated
// from the canvas."). Release 1 node set: start, agent, condition,
// approval, end. Release 2 (PR C) adds conductor + http — see each
// node's own comment below.

import { z } from 'zod';

// ── Node types ──────────────────────────────────────────────────────────────

export const CANVAS_NODE_TYPES = [
  'start',
  'agent',
  'condition',
  'approval',
  'end',
  'conductor',
  'http',
] as const;
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

// Release 2 (PR C) — conductor + http. Neither makes a live call: the
// simulated engine (engine.ts) returns a labelled `{ simulated: true, ... }`
// result for each, exactly like the existing `agent` node's
// simulateAgent(). Real execution arrives with Connector Hub going live,
// behind the same AgentExecutor-style seam. Both have exactly ONE
// outgoing edge — the "routing" a Conductor does is entirely internal
// (which allowlisted agent slug to simulate against), never a choice of
// which edge to follow; the graph author puts the human-approval node on
// that single outgoing edge themselves (the engine never invents one).

export const ConductorNode = NodeBase.extend({
  type: z.literal('conductor'),
  config: z.object({
    // Agent slugs this Conductor may ever pick. A route whose slug isn't
    // in this list is blocked at run time (policy block) even if it
    // otherwise matched — never trust a later pick over the allowlist.
    allowedAgentSlugs: z.array(z.string().min(1)).min(1).max(12),
    // Ordered match rules: does the upstream output contain `contains`
    // (case-insensitive, same deterministic check as ConditionNode)? The
    // first match wins. Deliberately not an LLM decision.
    routes: z
      .array(
        z.object({
          contains: z.string().min(1).max(200),
          agentSlug: z.string().min(1),
        }),
      )
      .min(1),
    // Call budget for this Conductor within a single run — loop/repeat
    // protection independent of the graph shape. Deliberately required
    // (no zod `.default()`): a schema default makes `_input` and
    // `_output` diverge (input optional, output required), which breaks
    // `apiFetch`'s `ZodType<T>` (Input defaults to Output) for every
    // discriminated-union member that embeds it — the "2" default lives
    // at the app layer instead (defaultConfig()/guide.ts always set it).
    maxCalls: z.number().int().min(1).max(8),
    // What the author intends the single outgoing edge to lead to — pure
    // documentation/inspector hint, has no effect on engine traversal
    // (there is only ever one outgoing edge regardless).
    fallback: z.enum(['approval', 'end']),
  }),
});

export const HttpNode = NodeBase.extend({
  type: z.literal('http'),
  config: z.object({
    method: z.enum(['GET', 'POST']),
    url: z.string().min(1).max(2000),
    // Always true in this release — Connector Hub isn't live, so an http
    // node can never do anything but simulate. Locked, not merely
    // defaulted, so a stray client can't flip it.
    dryRun: z.literal(true),
  }),
});

export const CanvasNode = z.discriminatedUnion('type', [
  StartNode,
  AgentNode,
  ConditionNode,
  ApprovalNode,
  EndNode,
  ConductorNode,
  HttpNode,
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
  // UX review C2: mission this blueprint was created from (null when built
  // free-standing). missionSlug/missionName are enriched server-side so
  // the canvas toolbar can link back without a second fetch. All optional
  // so pre-enrichment payloads still parse.
  missionId: z.string().nullable().optional(),
  missionSlug: z.string().nullable().optional(),
  missionName: z.string().nullable().optional(),
  // Publish/promote (Release 1 gap closure): a saved version starts
  // Draft; runs may still execute a Draft version (testing is the
  // point). Publishing is a one-way Draft -> Published promotion of the
  // latest Draft version, no richer lifecycle than that.
  status: z.enum(['Draft', 'Published']),
});
export type BlueprintItemT = z.infer<typeof BlueprintItem>;

// UX review C2: request body for POST /api/forge-canvas/blueprints/from-mission —
// creates (or returns) the blueprint linked to a mission's Software Build gate.
export const BlueprintFromMission = z.object({
  missionId: z.string().min(1).max(64),
});
export type BlueprintFromMissionT = z.infer<typeof BlueprintFromMission>;

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
  // Milliseconds, derived from finishedAt - startedAt at read time —
  // null while the node hasn't finished yet (still running/paused).
  // Token/cost stay out of scope until a real (non-simulated) executor
  // exists.
  durationMs: z.number().int().nonnegative().nullable(),
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
  items: z.array(CanvasRunDetail.omit({ nodeRuns: true, openTaskId: true, currentNodeId: true })),
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
  // Real user testing feedback (2026-09-04): an admin's Approvals inbox
  // shows every task system-wide (listTasks: `where: isAdmin ? {} : {...}`)
  // with nothing distinguishing "yours" from "everyone's, because you're an
  // admin" — pre-existing demo/seed runs ("Judge Demo", "QA E2E") read as
  // unexplained noise mixed into the user's own real activity. No other
  // user's identity is exposed (email/name), only this boolean, computed
  // server-side against the requesting user's own id.
  isOwn: z.boolean(),
});
export type CanvasTaskItemT = z.infer<typeof CanvasTaskItem>;

export const CanvasTaskList = z.object({ items: z.array(CanvasTaskItem) });
export type CanvasTaskListT = z.infer<typeof CanvasTaskList>;

export const TaskDecide = z.object({
  decision: z.enum(['Approved', 'Rejected']),
  reasonText: z.string().min(1, 'A typed reason is required.').max(2000),
});
export type TaskDecideT = z.infer<typeof TaskDecide>;
