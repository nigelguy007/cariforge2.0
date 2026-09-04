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
import { type AgentSnapshot, advance, type RunState, resumeAfterDecision } from './engine';
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
export async function saveBlueprint(
  userId: string,
  save: BlueprintSaveT,
  // UX review C2: mission link. Explicit when creating from a mission's
  // Software Build gate; omitted on ordinary saves, where it's carried
  // forward from the prior version so a mission-linked blueprint never
  // silently loses its mission on re-save.
  missionId?: string,
) {
  const validation = await validateForSave(save.definition);
  if (!validation.ok) {
    const err = new Error('CANVAS_INVALID');
    (err as Error & { issues?: BlueprintValidationT['issues'] }).issues = validation.issues;
    throw err;
  }
  const latest = await prisma.canvasBlueprint.findFirst({
    where: { slug: save.slug },
    orderBy: { version: 'desc' },
    select: { version: true, missionId: true, createdById: true },
  });
  // SECURITY (2026-09-03 audit): this previously read only version/missionId
  // off the prior version, never createdById — so ANY signed-in user could
  // POST a new version under someone else's slug and become createdById of
  // the new "latest". publishBlueprint() checks ownership against the latest
  // version, so that check would then pass for the attacker: full slug
  // takeover, victim's published blueprint replaced by attacker content.
  // A brand-new slug (no prior version) is unaffected; re-saving your own
  // blueprint is unchanged.
  if (latest && latest.createdById !== userId) throw new Error('FORGE_FORBIDDEN');
  const linkedMissionId = missionId ?? latest?.missionId ?? null;
  const row = await prisma.canvasBlueprint.create({
    data: {
      slug: save.slug,
      name: save.name,
      version: (latest?.version ?? 0) + 1,
      definition: save.definition,
      createdById: userId,
      missionId: linkedMissionId,
      // PR A6: every save writes a fresh Draft — publishing is a
      // separate, explicit act (POST .../publish), never implied by save.
      status: 'Draft',
    },
  });
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    version: row.version,
    definition: save.definition,
    createdAt: row.createdAt.toISOString(),
    status: row.status as 'Draft' | 'Published',
    ...(await missionLinkFields(linkedMissionId)),
  };
}

// PR A6: promote the latest Draft version of a slug to Published. One-way
// (no Published -> Draft), no richer lifecycle than that. 409s if the
// latest version is already Published — publishing twice is a no-op error,
// not a silent success, so the caller notices they raced themselves.
export async function publishBlueprint(args: { userId: string; isAdmin: boolean; slug: string }) {
  const latest = await prisma.canvasBlueprint.findFirst({
    where: { slug: args.slug },
    orderBy: { version: 'desc' },
  });
  if (!latest) throw new Error('FORGE_NOT_FOUND');
  if (!args.isAdmin && latest.createdById !== args.userId) throw new Error('FORGE_FORBIDDEN');
  if (latest.status === 'Published') throw new Error('FORGE_CONFLICT');
  const row = await prisma.canvasBlueprint.update({
    where: { id: latest.id },
    data: { status: 'Published' },
  });
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    version: row.version,
    definition: CariBlueprintDefinition.parse(row.definition),
    createdAt: row.createdAt.toISOString(),
    status: row.status as 'Draft' | 'Published',
    ...(await missionLinkFields(row.missionId ?? null)),
  };
}

// Resolve the {missionId, missionSlug, missionName} trio for one blueprint.
async function missionLinkFields(missionId: string | null) {
  if (!missionId) return { missionId: null, missionSlug: null, missionName: null };
  const mission = await prisma.mission.findUnique({
    where: { id: missionId },
    select: { slug: true, name: true },
  });
  return {
    missionId,
    missionSlug: mission?.slug ?? null,
    missionName: mission?.name ?? null,
  };
}

export async function listBlueprints() {
  // Latest version per slug — small-N groupBy in JS, same pragmatism as
  // business/leads.ts (revisit if blueprint count grows past thousands).
  const rows = await prisma.canvasBlueprint.findMany({
    orderBy: [{ slug: 'asc' }, { version: 'desc' }],
    select: {
      id: true,
      slug: true,
      name: true,
      version: true,
      createdAt: true,
      missionId: true,
      status: true,
    },
  });
  const seen = new Set<string>();
  const latest = [];
  for (const r of rows) {
    if (seen.has(r.slug)) continue;
    seen.add(r.slug);
    latest.push(r);
  }
  // UX review C2: one batched mission lookup enriches slug/name for every
  // mission-linked blueprint so list consumers can link back to /missions/*.
  const missionIds = [...new Set(latest.map((r) => r.missionId).filter((v): v is string => !!v))];
  const missions =
    missionIds.length === 0
      ? []
      : await prisma.mission.findMany({
          where: { id: { in: missionIds } },
          select: { id: true, slug: true, name: true },
        });
  const missionById = new Map(missions.map((m) => [m.id, m] as const));
  const items = latest.map((r) => ({
    id: r.id,
    slug: r.slug,
    name: r.name,
    version: r.version,
    createdAt: r.createdAt.toISOString(),
    missionId: r.missionId ?? null,
    missionSlug: r.missionId ? (missionById.get(r.missionId)?.slug ?? null) : null,
    missionName: r.missionId ? (missionById.get(r.missionId)?.name ?? null) : null,
    status: r.status as 'Draft' | 'Published',
  }));
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
    status: row.status as 'Draft' | 'Published',
    ...(await missionLinkFields(row.missionId ?? null)),
  };
}

// UX review C2 (wireframe v2, screen 2d): create — or return — the blueprint
// linked to a mission's Software Build gate. Guarded: only the mission's
// owner (or an admin) may call it, and only once the mission has actually
// reached gate 5 (Software Build approved). The seeded workflow is
// deliberately minimal but VALID and honest: the mission's intake as the
// start input and its authority boundary as a mandatory human-approval
// node — the governance constraint carries into the builder instead of
// being retyped.
//
// Deliberately gated on `mission.status === 'Completed'`, NOT on
// `currentStageIndex`. currentStageIndex tracks how far evidence handoffs
// have been *submitted* (advanced unconditionally by submitHandoff, with
// no human decision involved) — it can reach its max value with zero real
// gate approvals. `status` only becomes 'Completed' when decideGate
// records an actual Approve on gate 4 (see nextStageFor). Gating on
// currentStageIndex here would let a mission owner submit all five
// handoffs back-to-back and reach the Forge Canvas builder without a
// single human ever authorising a gate — silently defeating "nothing
// jumps a gate".
export async function createBlueprintFromMission(args: {
  userId: string;
  isAdmin: boolean;
  missionId: string;
}) {
  const mission = await prisma.mission.findUnique({ where: { id: args.missionId } });
  if (!mission) throw new Error('FORGE_NOT_FOUND');
  if (!args.isAdmin && mission.createdById !== args.userId) throw new Error('FORGE_FORBIDDEN');
  if (mission.status !== 'Completed') throw new Error('FORGE_CONFLICT');

  // Already linked → hand back the latest version, idempotently.
  const existing = await prisma.canvasBlueprint.findFirst({
    where: { missionId: mission.id },
    orderBy: { version: 'desc' },
  });
  if (existing) {
    return {
      id: existing.id,
      slug: existing.slug,
      name: existing.name,
      version: existing.version,
      definition: CariBlueprintDefinition.parse(existing.definition),
      createdAt: existing.createdAt.toISOString(),
      status: existing.status as 'Draft' | 'Published',
      ...(await missionLinkFields(mission.id)),
    };
  }

  const intakeStructured = (mission.intakeStructured ?? {}) as Record<string, unknown>;
  const authorityBoundary =
    typeof intakeStructured.authorityBoundary === 'string' &&
    intakeStructured.authorityBoundary.trim().length > 0
      ? intakeStructured.authorityBoundary.trim()
      : 'A named human must approve before any real action.';

  const slug = `mission-${mission.slug}`
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);

  const definition: CariBlueprintDefinitionT = {
    apiVersion: 'cariforge.ai/v1alpha1',
    kind: 'AgentWorkflow',
    objective: mission.name.slice(0, 500),
    nodes: [
      {
        id: 'start',
        type: 'start',
        position: { x: 0, y: 0 },
        label: 'Mission input',
        config: { inputDescription: mission.intake.slice(0, 500) },
      },
      {
        id: 'authority-gate',
        type: 'approval',
        position: { x: 0, y: 140 },
        label: 'Authority boundary',
        config: { title: authorityBoundary.slice(0, 200) },
      },
      {
        id: 'end',
        type: 'end',
        position: { x: 0, y: 280 },
        label: 'Done',
        config: {},
      },
    ],
    edges: [
      { id: 'e-start-gate', from: 'start', to: 'authority-gate' },
      { id: 'e-gate-end', from: 'authority-gate', to: 'end' },
    ],
  };

  return saveBlueprint(
    args.userId,
    { slug, name: mission.name.slice(0, 120), definition },
    mission.id,
  );
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
    // A4: startedAt/finishedAt must come from the same clock. Leaving
    // startedAt to the column's DB-side `now()` default (Postgres:
    // transaction-start time) while stamping finishedAt from this
    // process's `new Date()` lets the two disagree by a millisecond in
    // either direction for a step that (in this simulated engine) takes
    // ~0 real time — durationMs then goes negative and fails
    // NodeRunItem's `.nonnegative()`, 500ing the whole run response.
    // Stamping both from one JS Date per record removes the cross-clock
    // race entirely.
    const stamp = new Date();
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
        startedAt: stamp,
        finishedAt: r.status === 'AwaitingApproval' ? null : stamp,
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
      // A4: derived, not stored — null while the node hasn't finished
      // (still running, or paused awaiting approval).
      durationMs: n.finishedAt ? n.finishedAt.getTime() - n.startedAt.getTime() : null,
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
        // 2026-09-04: see the CanvasTaskItem schema comment — lets an
        // admin's system-wide inbox distinguish their own activity from
        // everyone else's without exposing who "everyone else" is.
        isOwn: t.run.createdById === userId,
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
      // Same fix as startRun(): one JS clock for both timestamps, not a
      // DB-side default racing an app-side Date — see comment there.
      const stamp = new Date();
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
          startedAt: stamp,
          finishedAt: r.status === 'AwaitingApproval' ? null : stamp,
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
