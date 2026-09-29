// @polsia:user-owned — Prisma-backed store for the fundraise loop. Every
// admin + runner route handler goes through here; the pure rules live in
// allocation.ts / dedupe.ts / state.ts and are re-checked on every write.

import 'server-only';
import type { Prisma } from '@prisma/client';
import type {
  BatchDecision,
  BatchIngest,
  BatchIngestResult,
  BatchStatus,
  BatchView,
  ConfigUpdate,
  EventIngestResult,
  EventInput,
  LoopPlan,
  LoopSummary,
  ProspectView,
  SegmentUpsert,
} from '@/lib/contracts/fundraise-loop';
import { prisma } from '@/lib/db';
import { planAllocation, type SegmentInput } from './allocation';
import { dedupeKeyFor, dedupeKeyForIdentifier } from './dedupe';
import { ConflictError, NotFoundError } from './errors';
import { assertTransition, canEditItems, canSend, laneFor, TransitionError } from './state';

export { ConflictError, NotFoundError, TransitionError };

const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);

/** ISO-8601 week as YYYYWW — stable seed for the whole week. */
export function isoWeekSeed(now: Date): number {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = Date.UTC(d.getUTCFullYear(), 0, 1);
  const week = Math.ceil(((d.getTime() - yearStart) / 86_400_000 + 1) / 7);
  return d.getUTCFullYear() * 100 + week;
}

// ── Config ─────────────────────────────────────────────────────────────────
export async function getConfig() {
  return prisma.fundraiseLoopConfig.upsert({
    where: { id: 'default' },
    create: { id: 'default' },
    update: {},
  });
}

export async function updateConfig(input: ConfigUpdate): Promise<void> {
  await prisma.fundraiseLoopConfig.upsert({
    where: { id: 'default' },
    create: { id: 'default', ...input },
    update: input,
  });
}

// ── Plan ───────────────────────────────────────────────────────────────────
export async function computePlan(now: Date = new Date()): Promise<LoopPlan> {
  const [config, segments, contactedRows, sentRows] = await Promise.all([
    getConfig(),
    prisma.fundraiseSegment.findMany({ orderBy: { key: 'asc' } }),
    prisma.fundraiseProspect.groupBy({
      by: ['segmentKey'],
      where: { status: { not: 'SKIPPED' } },
      _count: { _all: true },
    }),
    prisma.fundraiseProspect.findMany({
      where: { status: 'SENT' },
      select: {
        segmentKey: true,
        sentAt: true,
        createdAt: true,
        events: { select: { type: true } },
      },
    }),
  ]);

  const contacted = new Map(contactedRows.map((r) => [r.segmentKey, r._count._all]));
  const sentBySegment = new Map<string, SegmentInput['sent']>();
  for (const p of sentRows) {
    const list = sentBySegment.get(p.segmentKey) ?? [];
    list.push({ sentAt: p.sentAt ?? p.createdAt, events: p.events.map((e) => e.type) });
    sentBySegment.set(p.segmentKey, list);
  }

  const inputs: SegmentInput[] = segments.map((s) => ({
    key: s.key,
    status: s.status === 'PAUSED' ? 'PAUSED' : 'ACTIVE',
    estUniverse: s.estUniverse,
    lagDays: s.lagDays,
    contacted: contacted.get(s.key) ?? 0,
    sent: sentBySegment.get(s.key) ?? [],
  }));

  const results = planAllocation(inputs, config, now, isoWeekSeed(now));
  const byKey = new Map(results.map((r) => [r.key, r]));

  return {
    generatedAt: now.toISOString(),
    batchSize: config.batchSize,
    sendingEnabled: config.sendingEnabled,
    segments: segments.map((s) => {
      // biome-ignore lint/style/noNonNullAssertion: planAllocation returns one result per input segment
      const r = byKey.get(s.key)!;
      return {
        key: s.key,
        label: s.label,
        query: s.query,
        mode: s.mode,
        status: s.status === 'PAUSED' ? 'PAUSED' : 'ACTIVE',
        estUniverse: s.estUniverse,
        lagDays: s.lagDays,
        contacted: r.contacted,
        maturedTrials: r.maturedTrials,
        replies: r.replies,
        meetings: r.meetings,
        posteriorMean: r.posteriorMean,
        probBest: r.probBest,
        allocation: r.allocation,
        burnPct: r.burnPct,
        weeksOfMarketLeft: r.weeksOfMarketLeft,
        recommendation: r.recommendation,
      };
    }),
  };
}

// ── Views ──────────────────────────────────────────────────────────────────
type ProspectRow = Prisma.FundraiseProspectGetPayload<object>;
type BatchRow = Prisma.FundraiseBatchGetPayload<{ include: { prospects: true } }>;

function toProspectView(p: ProspectRow): ProspectView {
  return {
    id: p.id,
    segmentKey: p.segmentKey,
    fullName: p.fullName,
    firm: p.firm,
    title: p.title,
    linkedinUrl: p.linkedinUrl,
    sourceRef: p.sourceRef,
    lane: p.lane as ProspectView['lane'],
    warmPath: p.warmPath,
    status: p.status as ProspectView['status'],
  };
}

function toBatchView(b: BatchRow): BatchView {
  return {
    id: b.id,
    status: b.status as BatchStatus,
    note: b.note,
    createdAt: b.createdAt.toISOString(),
    decidedBy: b.decidedBy,
    decidedAt: iso(b.decidedAt),
    sentAt: iso(b.sentAt),
    prospects: b.prospects.map(toProspectView),
  };
}

const prospectOrder = { createdAt: 'asc' } as const;

async function loadBatchView(id: string): Promise<BatchView> {
  const b = await prisma.fundraiseBatch.findUnique({
    where: { id },
    include: { prospects: { orderBy: prospectOrder } },
  });
  if (!b) throw new NotFoundError('Batch');
  return toBatchView(b);
}

// ── Summary ────────────────────────────────────────────────────────────────
export async function getSummary(now: Date = new Date()): Promise<LoopSummary> {
  const [plan, batches, warm, pendingApproval] = await Promise.all([
    computePlan(now),
    prisma.fundraiseBatch.findMany({
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: { prospects: { orderBy: prospectOrder } },
    }),
    prisma.fundraiseProspect.findMany({
      where: { lane: 'WARM', status: 'QUEUED' },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.fundraiseBatch.count({ where: { status: 'PENDING_APPROVAL' } }),
  ]);
  const sum = (f: (s: LoopPlan['segments'][number]) => number) =>
    plan.segments.reduce((acc, s) => acc + f(s), 0);
  return {
    plan,
    totals: {
      contacted: sum((s) => s.contacted),
      replies: sum((s) => s.replies),
      meetings: sum((s) => s.meetings),
      pendingApproval,
      warmIntros: warm.length,
    },
    batches: batches.map(toBatchView),
    warmIntros: warm.map(toProspectView),
  };
}

// ── Runner: batch ingest ───────────────────────────────────────────────────
export async function ingestBatch(input: BatchIngest): Promise<BatchIngestResult> {
  const segments = await prisma.fundraiseSegment.findMany({ select: { key: true, status: true } });
  const activeKeys = new Set(segments.filter((s) => s.status === 'ACTIVE').map((s) => s.key));

  let invalid = 0;
  let unknownSegment = 0;
  let duplicates = 0;
  const seen = new Set<string>();
  const candidates: Array<{ dedupeKey: string; p: BatchIngest['prospects'][number] }> = [];
  for (const p of input.prospects) {
    const dedupeKey = dedupeKeyFor(p);
    if (!dedupeKey) {
      invalid++;
      continue;
    }
    if (!activeKeys.has(p.segmentKey)) {
      unknownSegment++;
      continue;
    }
    if (seen.has(dedupeKey)) {
      duplicates++;
      continue;
    }
    seen.add(dedupeKey);
    candidates.push({ dedupeKey, p });
  }

  const existing = candidates.length
    ? await prisma.fundraiseProspect.findMany({
        where: { dedupeKey: { in: candidates.map((c) => c.dedupeKey) } },
        select: { dedupeKey: true },
      })
    : [];
  const known = new Set(existing.map((e) => e.dedupeKey));
  const fresh = candidates.filter((c) => !known.has(c.dedupeKey));
  duplicates += candidates.length - fresh.length;

  const row = (c: (typeof fresh)[number], batchId: string | null) => ({
    dedupeKey: c.dedupeKey,
    segmentKey: c.p.segmentKey,
    batchId,
    fullName: c.p.fullName,
    firm: c.p.firm ?? null,
    title: c.p.title ?? null,
    linkedinUrl: c.p.linkedinUrl ?? null,
    email: c.p.email ?? null,
    sourceRef: c.p.sourceRef ?? null,
    lane: laneFor(c.p.warmPath),
    warmPath: c.p.warmPath?.trim() || null,
    status: 'QUEUED',
  });
  const warmRows = fresh.filter((c) => laneFor(c.p.warmPath) === 'WARM');
  const coldRows = fresh.filter((c) => laneFor(c.p.warmPath) === 'COLD');

  // Snapshot the plan the batch was drafted against (outside the tx: read-only).
  const plan = coldRows.length ? await computePlan() : null;

  return prisma.$transaction(async (tx) => {
    const warmCreated = warmRows.length
      ? (
          await tx.fundraiseProspect.createMany({
            data: warmRows.map((c) => row(c, null)),
            skipDuplicates: true,
          })
        ).count
      : 0;

    let batchId: string | null = null;
    let coldCreated = 0;
    if (coldRows.length && plan) {
      const batch = await tx.fundraiseBatch.create({
        data: {
          status: 'PENDING_APPROVAL',
          plan: plan as unknown as Prisma.InputJsonValue,
          note: input.note ?? null,
        },
      });
      coldCreated = (
        await tx.fundraiseProspect.createMany({
          data: coldRows.map((c) => row(c, batch.id)),
          skipDuplicates: true,
        })
      ).count;
      if (coldCreated === 0) {
        // Every row lost a race to a concurrent ingest — don't leave an empty batch.
        await tx.fundraiseBatch.delete({ where: { id: batch.id } });
      } else {
        batchId = batch.id;
      }
    }

    // Rows skipped by skipDuplicates were inserted concurrently: duplicates.
    const raced = warmRows.length - warmCreated + (coldRows.length - coldCreated);
    return {
      batchId,
      created: warmCreated + coldCreated,
      duplicates: duplicates + raced,
      warm: warmCreated,
      unknownSegment,
      invalid,
    };
  });
}

// ── Admin: batch decisions ─────────────────────────────────────────────────
export async function decideBatch(
  id: string,
  decision: BatchDecision,
  actor: string,
): Promise<BatchView> {
  const batch = await prisma.fundraiseBatch.findUnique({ where: { id }, select: { status: true } });
  if (!batch) throw new NotFoundError('Batch');
  const from = batch.status as BatchStatus;

  if (decision.action === 'skip') {
    if (!canEditItems(from)) {
      throw new ConflictError(
        `Items can only be skipped while a batch is pending approval (it is ${from})`,
      );
    }
    await prisma.fundraiseProspect.updateMany({
      where: { id: { in: decision.prospectIds }, batchId: id, status: 'QUEUED' },
      data: { status: 'SKIPPED' },
    });
    return loadBatchView(id);
  }

  const to: BatchStatus = decision.action === 'approve' ? 'APPROVED' : 'REJECTED';
  assertTransition(from, to);
  // Conditional on the status we checked, so a concurrent decision can't be overwritten.
  const { count } = await prisma.fundraiseBatch.updateMany({
    where: { id, status: from },
    data: { status: to, decidedBy: actor, decidedAt: new Date(), note: decision.note ?? undefined },
  });
  if (count === 0) throw new ConflictError('Batch changed while deciding; reload and retry');
  return loadBatchView(id);
}

// ── Runner: send ───────────────────────────────────────────────────────────
export async function listApprovedForSend(): Promise<{
  sendingEnabled: boolean;
  batches: BatchView[];
}> {
  const config = await getConfig();
  if (!config.sendingEnabled) return { sendingEnabled: false, batches: [] };
  const batches = await prisma.fundraiseBatch.findMany({
    where: { status: 'APPROVED' },
    orderBy: { createdAt: 'asc' },
    include: {
      prospects: { where: { lane: 'COLD', status: 'QUEUED' }, orderBy: prospectOrder },
    },
  });
  return { sendingEnabled: true, batches: batches.map(toBatchView) };
}

export async function markSent(batchId: string): Promise<BatchView> {
  const [config, batch] = await Promise.all([
    getConfig(),
    prisma.fundraiseBatch.findUnique({ where: { id: batchId }, select: { status: true } }),
  ]);
  if (!batch) throw new NotFoundError('Batch');
  const from = batch.status as BatchStatus;
  if (!canSend(from, config.sendingEnabled)) {
    if (from !== 'APPROVED') throw new TransitionError(from, 'SENT');
    throw new ConflictError('Sending is disabled (kill switch is off)');
  }
  const now = new Date();
  await prisma.$transaction(async (tx) => {
    const { count } = await tx.fundraiseBatch.updateMany({
      where: { id: batchId, status: 'APPROVED' },
      data: { status: 'SENT', sentAt: now },
    });
    if (count === 0) throw new ConflictError('Batch changed while marking sent; reload and retry');
    await tx.fundraiseProspect.updateMany({
      where: { batchId, status: 'QUEUED', lane: 'COLD' },
      data: { status: 'SENT', sentAt: now },
    });
  });
  return loadBatchView(batchId);
}

// ── Events ─────────────────────────────────────────────────────────────────
export async function recordEvents(
  events: EventInput[],
  source: 'manual' | 'runner' | 'heyreach',
): Promise<EventIngestResult> {
  const unmatched: string[] = [];
  const resolved: Array<{ key: string; e: EventInput }> = [];
  for (const e of events) {
    const key = dedupeKeyForIdentifier(e.identifier);
    if (key) resolved.push({ key, e });
    else unmatched.push(e.identifier);
  }
  const prospects = resolved.length
    ? await prisma.fundraiseProspect.findMany({
        where: { dedupeKey: { in: [...new Set(resolved.map((r) => r.key))] } },
        select: { id: true, dedupeKey: true },
      })
    : [];
  const idByKey = new Map(prospects.map((p) => [p.dedupeKey, p.id]));

  const data: Prisma.FundraiseEventCreateManyInput[] = [];
  for (const { key, e } of resolved) {
    const prospectId = idByKey.get(key);
    if (!prospectId) {
      unmatched.push(e.identifier);
      continue;
    }
    data.push({ prospectId, type: e.type, occurredAt: e.occurredAt, source, note: e.note ?? null });
  }
  const recorded = data.length
    ? (await prisma.fundraiseEvent.createMany({ data, skipDuplicates: true })).count
    : 0;
  return { recorded, alreadyRecorded: data.length - recorded, unmatched };
}

// ── Admin: segments / intros ───────────────────────────────────────────────
export async function upsertSegment(input: SegmentUpsert): Promise<void> {
  const { key, ...fields } = input;
  await prisma.fundraiseSegment.upsert({
    where: { key },
    create: { key, ...fields },
    update: fields,
  });
}

export async function markIntroRequested(prospectId: string): Promise<void> {
  const { count } = await prisma.fundraiseProspect.updateMany({
    where: { id: prospectId, lane: 'WARM', status: 'QUEUED' },
    data: { status: 'INTRO_REQUESTED' },
  });
  if (count > 0) return;
  const exists = await prisma.fundraiseProspect.findUnique({
    where: { id: prospectId },
    select: { id: true },
  });
  if (!exists) throw new NotFoundError('Prospect');
  throw new ConflictError('Only queued warm-path prospects can be marked intro-requested');
}

/**
 * Every identity the loop has ever seen — uploaded to 8Raise as its exclusion
 * list. Stored linkedinUrl/email are emitted when present; the dedupeKey is
 * always expanded too, so rows whose contact fields were redacted (privacy
 * deletion keeps the key) still suppress re-contact.
 */
export async function exclusionList(): Promise<string[]> {
  const rows = await prisma.fundraiseProspect.findMany({
    select: { linkedinUrl: true, email: true, dedupeKey: true },
  });
  const out = new Set<string>();
  for (const r of rows) {
    if (r.linkedinUrl) out.add(r.linkedinUrl);
    if (r.email) out.add(r.email);
    if (r.dedupeKey.startsWith('li:')) {
      out.add(`https://www.linkedin.com/in/${r.dedupeKey.slice(3)}`);
    } else if (r.dedupeKey.startsWith('em:')) {
      out.add(r.dedupeKey.slice(3));
    }
  }
  return [...out];
}
