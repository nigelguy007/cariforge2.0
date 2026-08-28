// @polsia:user-owned — DB service for the Forge Canvas slice. Wraps the
// pure engine (engine.ts) and validator (validate.ts) with Prisma
// persistence, following the same conventions as business/forge/service.ts:
// FORGE_*-style thrown error codes mapped by the route layer, ownership
// checks on every read/write, and transactions around multi-row writes.

import 'server-only';
import type {
  BlueprintSaveT,
  BlueprintValidationT,
  CanvasRunDetailT,
  CanvasTaskItemT,
  CariBlueprintDefinitionT,
} from '@/lib/contracts/forge-canvas';
import { CariBlueprintDefinition } from '@/lib/contracts/forge-canvas';
import { prisma } from '@/lib/db';
import { advance, type AgentSnapshot, resumeAfterDecision, type RunState } from './engine';
import { validateBlueprint } from './validate';

async function agentMap(): Promise<Map<string, AgentSnapshot>> {
  const rows = await prisma.canvasAgentDefinition.findMany({
    where: { status: 'Published' },
    select: { slug: true, name: true, description: true, riskClass: true },
  });
  return new Map(rows.map((r) => [r.slug, r]));
}

export async function listCanvasAgents() {
  const rows = await prisma.canvasAgentDefinition.findMany({
    where: { status: 'Published' },
    orderBy: [{ category: 'asc' }, { name: 'asc' }],
    select: {
      slug: true,
      name: true,
      version: true,
      category: true,
      description: true,
      riskClass: true,
    },
  });
  return { items: rows };
}

export async function validateForSave(
  def: CariBlueprintDefinitionT,
): Promise<BlueprintValidationT> {
  const agents = await agentMap();
  return validateBlueprint(def, new Set(agents.keys()));
}

// Each save writes a NEW immutable version row (slug, version) — never a
// mutation of a prior version. Runs reference the exact version they ran.
export async function saveBlueprint(userId: string, save: BlueprintSaveT) {
  const validation = await validateForSave(save.definition);
  if (!validation.ok) {
    const err = new Error('CANVAS_INVALID');
    (err as Error & { issues?: BlueprintValidationT['issues'] }).issues = validation.issues;
    throw err;
  }
  const latest = await prisma.canvasBlueprint.findFirst({
    where: { slug: save.slug },
    orderBy: { version: 'desc' },
    select: { version: true },
  });
  const row = await prisma.canvasBlueprint.create({
    data: {
      slug: save.slug,
      name: save.name,
      version: (latest?.version ?? 0) + 1,
      definition: save.definition,
      createdById: userId,
    },
  });
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    version: row.version,
    definition: save.definition,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function listBlueprints() {
  // Latest version per slug — small-N groupBy in JS, same pragmatism as
  // business/leads.ts (revisit if blueprint count grows past thousands).
  const rows = await prisma.canvasBlueprint.findMany({
    orderBy: [{ slug: 'asc' }, { version: 'desc' }],
    select: { id: true, slug: true, name: true, version: true, createdAt: true },
  });
  const seen = new Set<string>();
  const items = [];
  for (const r of rows) {
    if (seen.has(r.slug)) continue;
    seen.add(r.slug);
    items.push({ ...r, createdAt: r.createdAt.toISOString() });
  }
  return { items };
}

export async function getBlueprint(slug: string, version?: number) {
  const row = version
    ? await prisma.canvasBlueprint.findUnique({ where: { slug_version: { slug, version } } })
    : await prisma.canvasBlueprint.findFirst({ where: { slug }, orderBy: { version: 'desc' } });
  if (!row) throw new Error('FORGE_NOT_FOUND');
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    version: row.version,
    definition: CariBlueprintDefinition.parse(row.definition),
    createdAt: row.createdAt.toISOString(),
  };
}

export async function startRun(args: {
  userId: string;
  slug: string;
  version?: number;
  input: string;
}) {
  const bp = await getBlueprint(args.slug, args.version);
  const agents = await agentMap();
  const validation = validateBlueprint(bp.definition, new Set(agents.keys()));
  if (!validation.ok) throw new Error('CANVAS_INVALID_AT_RUN');

  const startNode = bp.definition.nodes.find((n) => n.type === 'start');
  if (!startNode) throw new Error('CANVAS_INVALID_AT_RUN');

  const initialState: RunState = { __input: args.input };
  const result = advance({
    def: bp.definition,
    agents,
    state: initialState,
    startNodeId: startNode.id,
    ordinalStart: 1,
  });

  const run = await prisma.$transaction(async (tx) => {
    const created = await tx.canvasRun.create({
      data: {
        blueprintId: bp.id,
        status: result.status === 'AwaitingApproval' ? 'AwaitingApproval' : result.status,
        state: result.state as object,
        currentNodeId: result.currentNodeId,
        createdById: args.userId,
        finishedAt: result.status === 'AwaitingApproval' ? null : new Date(),
      },
    });
    await tx.canvasNodeRun.createMany({
      data: result.records.map((r) => ({
        runId: created.id,
        ordinal: r.ordinal,
        nodeId: r.nodeId,
        nodeType: r.nodeType,
        status: r.status,
        input: (r.input ?? null) as object,
        output: (r.output ?? null) as object,
        error: r.error,
        finishedAt: r.status === 'AwaitingApproval' ? null : new Date(),
      })),
    });
    if (result.pausedApproval) {
      await tx.canvasTask.create({
        data: {
          runId: created.id,
          nodeId: result.pausedApproval.nodeId,
          title: result.pausedApproval.title,
        },
      });
    }
    return created;
  });
  return getRunDetail(run.id, args.userId, true);
}

export async function listRuns(userId: string, isAdmin: boolean) {
  const rows = await prisma.canvasRun.findMany({
    where: isAdmin ? {} : { createdById: userId },
    orderBy: { startedAt: 'desc' },
    take: 50,
    include: { blueprint: { select: { slug: true, name: true, version: true } } },
  });
  return {
    items: rows.map((r) => ({
      id: r.id,
      blueprintSlug: r.blueprint.slug,
      blueprintName: r.blueprint.name,
      blueprintVersion: r.blueprint.version,
      status: r.status,
      startedAt: r.startedAt.toISOString(),
      finishedAt: r.finishedAt?.toISOString() ?? null,
    })),
  };
}

export async function getRunDetail(
  id: string,
  userId: string,
  isOwnerKnown = false,
): Promise<CanvasRunDetailT> {
  const run = await prisma.canvasRun.findUnique({
    where: { id },
    include: {
      blueprint: { select: { slug: true, name: true, version: true } },
      nodeRuns: { orderBy: { ordinal: 'asc' } },
      tasks: { where: { status: 'Open' }, select: { id: true } },
    },
  });
  if (!run) throw new Error('FORGE_NOT_FOUND');
  if (!isOwnerKnown && run.createdById !== userId) throw new Error('FORGE_FORBIDDEN');
  return {
    id: run.id,
    blueprintSlug: run.blueprint.slug,
    blueprintName: run.blueprint.name,
    blueprintVersion: run.blueprint.version,
    status: run.status as CanvasRunDetailT['status'],
    currentNodeId: run.currentNodeId,
    startedAt: run.startedAt.toISOString(),
    finishedAt: run.finishedAt?.toISOString() ?? null,
    nodeRuns: run.nodeRuns.map((n) => ({
      ordinal: n.ordinal,
      nodeId: n.nodeId,
      nodeType: n.nodeType,
      status: n.status,
      input: n.input,
      output: n.output,
      error: n.error,
      startedAt: n.startedAt.toISOString(),
      finishedAt: n.finishedAt?.toISOString() ?? null,
    })),
    openTaskId: run.tasks[0]?.id ?? null,
  };
}

// Scoped per security review: a user sees only tasks from their own runs
// (their evidence payloads are run data — unscoped listing would disclose
// other users' run contents); admins see all, matching listRuns.
export async function listTasks(
  userId: string,
  isAdmin: boolean,
): Promise<{ items: CanvasTaskItemT[] }> {
  const rows = await prisma.canvasTask.findMany({
    where: isAdmin ? {} : { run: { createdById: userId } },
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    take: 50,
    include: {
      run: {
        include: {
          blueprint: { select: { name: true } },
          nodeRuns: { orderBy: { ordinal: 'desc' } },
        },
      },
    },
  });
  return {
    items: rows.map((t) => {
      // Evidence the approver must see (handover §17): the most recent
      // succeeded node output before this approval.
      const evidence =
        t.run.nodeRuns.find((n) => n.status === 'Succeeded' && n.output !== null)?.output ?? null;
      return {
        id: t.id,
        runId: t.runId,
        nodeId: t.nodeId,
        title: t.title,
        status: t.status as CanvasTaskItemT['status'],
        reasonText: t.reasonText,
        createdAt: t.createdAt.toISOString(),
        decidedAt: t.decidedAt?.toISOString() ?? null,
        blueprintName: t.run.blueprint.name,
        evidence,
      };
    }),
  };
}

export async function decideTask(args: {
  taskId: string;
  userId: string;
  isAdmin: boolean;
  decision: 'Approved' | 'Rejected';
  reasonText: string;
}) {
  const task = await prisma.canvasTask.findUnique({
    where: { id: args.taskId },
    include: { run: { include: { blueprint: true, nodeRuns: { orderBy: { ordinal: 'desc' } } } } },
  });
  if (!task) throw new Error('FORGE_NOT_FOUND');
  // Ownership check per security review (IDOR): only the run's owner or an
  // admin may decide its approval tasks. Role-based approver scoping
  // (Trust Centre RBAC) supersedes this in a later release.
  if (task.run.createdById !== args.userId && !args.isAdmin) throw new Error('FORGE_FORBIDDEN');
  if (task.status !== 'Open') throw new Error('FORGE_ALREADY_DECIDED');
  if (task.run.status !== 'AwaitingApproval') throw new Error('FORGE_NOT_PAUSED');

  const def = CariBlueprintDefinition.parse(task.run.blueprint.definition);
  const agents = await agentMap();
  const nextOrdinal = (task.run.nodeRuns[0]?.ordinal ?? 0) + 1;
  const result = resumeAfterDecision({
    def,
    agents,
    state: (task.run.state ?? {}) as RunState,
    approvalNodeId: task.nodeId,
    decision: args.decision,
    ordinalStart: nextOrdinal,
  });

  const runStatus =
    args.decision === 'Rejected'
      ? 'Rejected'
      : result.status === 'AwaitingApproval'
        ? 'AwaitingApproval'
        : result.status;

  await prisma.$transaction(async (tx) => {
    await tx.canvasTask.update({
      where: { id: task.id },
      data: {
        status: args.decision,
        reasonText: args.reasonText,
        decidedById: args.userId,
        decidedAt: new Date(),
      },
    });
    // Close out the paused approval node-run with the decision.
    await tx.canvasNodeRun.updateMany({
      where: { runId: task.runId, nodeId: task.nodeId, status: 'AwaitingApproval' },
      data: { status: args.decision, finishedAt: new Date() },
    });
    if (result.records.length > 0) {
      await tx.canvasNodeRun.createMany({
        data: result.records.map((r) => ({
          runId: task.runId,
          ordinal: r.ordinal,
          nodeId: r.nodeId,
          nodeType: r.nodeType,
          status: r.status,
          input: (r.input ?? null) as object,
          output: (r.output ?? null) as object,
          error: r.error,
          finishedAt: r.status === 'AwaitingApproval' ? null : new Date(),
        })),
      });
    }
    if (result.pausedApproval && args.decision === 'Approved') {
      await tx.canvasTask.create({
        data: {
          runId: task.runId,
          nodeId: result.pausedApproval.nodeId,
          title: result.pausedApproval.title,
        },
      });
    }
    await tx.canvasRun.update({
      where: { id: task.runId },
      data: {
        status: runStatus,
        state: result.state as object,
        currentNodeId: result.currentNodeId,
        finishedAt: runStatus === 'AwaitingApproval' ? null : new Date(),
      },
    });
  });
  return getRunDetail(task.runId, args.userId, true);
}
