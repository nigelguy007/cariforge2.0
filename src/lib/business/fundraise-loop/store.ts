// @polsia:user-owned — Prisma-backed store for the fundraise loop. Every
// admin + runner route handler goes through here; the pure rules live in
// allocation.ts / dedupe.ts / state.ts and are re-checked on every write.

import 'server-only';
import { randomUUID } from 'node:crypto';
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
  MarkSentInput,
  ProspectView,
  SegmentUpsert,
} from '@/lib/contracts/fundraise-loop';
import { prisma } from '@/lib/db';
import { planAllocation, type SegmentInput } from './allocation';
import { dedupeKeyFor, dedupeKeyForIdentifier, dedupeKeysFor } from './dedupe';
import { ConflictError, NotFoundError } from './errors';
import { canEditItems, canMarkSent, decisionTarget, laneFor, TransitionError } from './state';

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
  const [plan, recent, open, warm, pendingApproval] = await Promise.all([
    computePlan(now),
    prisma.fundraiseBatch.findMany({
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: { prospects: { orderBy: prospectOrder } },
    }),
    // Batches needing a human (pending approval, or stuck SENDING) are always
    // shown, however old — they must never scroll off the dashboard.
    prisma.fundraiseBatch.findMany({
      where: { status: { in: ['PENDING_APPROVAL', 'SENDING'] } },
      orderBy: { createdAt: 'desc' },
      include: { prospects: { orderBy: prospectOrder } },
    }),
    prisma.fundraiseProspect.findMany({
      where: { lane: 'WARM', status: 'QUEUED' },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.fundraiseBatch.count({ where: { status: 'PENDING_APPROVAL' } }),
  ]);
  const byId = new Map([...open, ...recent].map((b) => [b.id, b]));
  const batches = [...byId.values()].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
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
type IngestRow = BatchIngest['prospects'][number];
type Candidate = {
  id: string;
  dedupeKey: string;
  keys: string[];
  p: IngestRow;
  lane: 'COLD' | 'WARM';
};

export async function ingestBatch(input: BatchIngest): Promise<BatchIngestResult> {
  const segments = await prisma.fundraiseSegment.findMany({ select: { key: true, status: true } });
  const activeKeys = new Set(segments.filter((s) => s.status === 'ACTIVE').map((s) => s.key));

  let invalid = 0;
  let unknownSegment = 0;
  let duplicates = 0;
  let overAllocation = 0;

  // 1. Validate + dedupe within the payload on EVERY identity key.
  const seen = new Set<string>();
  const candidates: Candidate[] = [];
  for (const p of input.prospects) {
    const keys = dedupeKeysFor(p);
    const dedupeKey = dedupeKeyFor(p);
    if (!dedupeKey || keys.length === 0) {
      invalid++;
      continue;
    }
    if (!activeKeys.has(p.segmentKey)) {
      unknownSegment++;
      continue;
    }
    if (keys.some((k) => seen.has(k))) {
      duplicates++;
      continue;
    }
    for (const k of keys) seen.add(k);
    candidates.push({ id: randomUUID(), dedupeKey, keys, p, lane: laneFor(p.warmPath) });
  }

  // 2. Drop anyone already known under ANY identifier.
  const allKeys = candidates.flatMap((c) => c.keys);
  const known = new Set(
    allKeys.length
      ? (
          await prisma.fundraiseIdentity.findMany({
            where: { key: { in: allKeys } },
            select: { key: true },
          })
        ).map((r) => r.key)
      : [],
  );
  const fresh = candidates.filter((c) => !c.keys.some((k) => known.has(k)));
  duplicates += candidates.length - fresh.length;

  // 3. Cap the cold lane at this week's plan: per-segment allocation, and
  //    batchSize overall. Warm-path rows are never sent cold, so not capped.
  const coldFresh = fresh.filter((c) => c.lane === 'COLD');
  const plan = coldFresh.length ? await computePlan() : null;
  const allowed = new Map(plan?.segments.map((s) => [s.key, s.allocation]) ?? []);
  const taken = new Map<string, number>();
  let coldTotal = 0;
  const accepted: Candidate[] = [];
  for (const c of fresh) {
    if (c.lane === 'COLD') {
      const used = taken.get(c.p.segmentKey) ?? 0;
      if (used >= (allowed.get(c.p.segmentKey) ?? 0) || coldTotal >= (plan?.batchSize ?? 0)) {
        overAllocation++;
        continue;
      }
      taken.set(c.p.segmentKey, used + 1);
      coldTotal++;
    }
    accepted.push(c);
  }
  const coldCount = accepted.filter((c) => c.lane === 'COLD').length;

  const row = (c: Candidate, batchId: string | null): Prisma.FundraiseProspectCreateManyInput => ({
    id: c.id,
    dedupeKey: c.dedupeKey,
    segmentKey: c.p.segmentKey,
    batchId,
    fullName: c.p.fullName,
    firm: c.p.firm ?? null,
    title: c.p.title ?? null,
    linkedinUrl: c.p.linkedinUrl ?? null,
    email: c.p.email ?? null,
    sourceRef: c.p.sourceRef ?? null,
    lane: c.lane,
    warmPath: c.p.warmPath?.trim() || null,
    status: 'QUEUED',
  });

  // 4. Insert prospects + ALL their identity keys atomically. Conflicts are
  //    resolved with ON CONFLICT DO NOTHING (skipDuplicates) rather than by
  //    catching P2002, because a unique violation aborts a Postgres
  //    transaction. A concurrent ingest that holds one of our keys makes us
  //    wait for it; if it commits, our row lost the race → duplicate, and it
  //    is deleted again (its identities cascade) before we commit.
  return prisma.$transaction(
    async (tx) => {
      let batchId: string | null = null;
      if (coldCount > 0 && plan) {
        const batch = await tx.fundraiseBatch.create({
          data: {
            status: 'PENDING_APPROVAL',
            plan: plan as unknown as Prisma.InputJsonValue,
            note: input.note ?? null,
          },
        });
        batchId = batch.id;
      }

      const inserted = accepted.length
        ? await tx.fundraiseProspect.createManyAndReturn({
            data: accepted.map((c) => row(c, c.lane === 'COLD' ? batchId : null)),
            skipDuplicates: true,
            select: { id: true },
          })
        : [];
      const insertedIds = new Set(inserted.map((r) => r.id));
      const live = accepted.filter((c) => insertedIds.has(c.id));

      const identities = live.length
        ? await tx.fundraiseIdentity.createManyAndReturn({
            data: live.flatMap((c) => c.keys.map((key) => ({ key, prospectId: c.id }))),
            skipDuplicates: true,
            select: { prospectId: true },
          })
        : [];
      const got = new Map<string, number>();
      for (const r of identities) got.set(r.prospectId, (got.get(r.prospectId) ?? 0) + 1);
      const lost = live.filter((c) => (got.get(c.id) ?? 0) < c.keys.length).map((c) => c.id);
      if (lost.length) await tx.fundraiseProspect.deleteMany({ where: { id: { in: lost } } });
      const lostSet = new Set(lost);
      const created = live.filter((c) => !lostSet.has(c.id));

      const warmCreated = created.filter((c) => c.lane === 'WARM').length;
      const coldCreated = created.length - warmCreated;
      if (batchId && coldCreated === 0) {
        // Every cold row lost a race to a concurrent ingest — no empty batch.
        await tx.fundraiseBatch.delete({ where: { id: batchId } });
        batchId = null;
      }

      return {
        batchId,
        created: created.length,
        duplicates: duplicates + (accepted.length - created.length),
        warm: warmCreated,
        unknownSegment,
        invalid,
        overAllocation,
      };
    },
    { timeout: 30_000, maxWait: 10_000 },
  );
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

  // approve: PENDING→APPROVED · reject: PENDING|APPROVED→REJECTED (never
  // SENDING) · release: SENDING→APPROVED (human verified nothing was pushed).
  const to = decisionTarget(decision.action, from);
  // Conditional on the status we checked, so a concurrent decision or runner
  // claim can't be overwritten.
  const { count } = await prisma.fundraiseBatch.updateMany({
    where: { id, status: from },
    data: { status: to, decidedBy: actor, decidedAt: new Date(), note: decision.note ?? undefined },
  });
  if (count === 0) throw new ConflictError('Batch changed while deciding; reload and retry');
  return loadBatchView(id);
}

// ── Runner: send (list → claim → push → /sent) ─────────────────────────────
const sendableProspects = {
  where: { lane: 'COLD', status: 'QUEUED' },
  orderBy: prospectOrder,
} as const;

export async function listApprovedForSend(): Promise<{
  sendingEnabled: boolean;
  batches: BatchView[];
}> {
  const config = await getConfig();
  if (!config.sendingEnabled) return { sendingEnabled: false, batches: [] };
  const batches = await prisma.fundraiseBatch.findMany({
    where: { status: 'APPROVED' },
    orderBy: { createdAt: 'asc' },
    include: { prospects: sendableProspects },
  });
  return { sendingEnabled: true, batches: batches.map(toBatchView) };
}

/**
 * APPROVED → SENDING, atomically and only while the kill switch is on (one
 * statement checks both). The runner must claim before pushing anything; a
 * second claim, a claim of a non-APPROVED batch, or a claim with sending
 * disabled is a 409. Returns the batch with its cold, queued prospects.
 */
export async function claimBatch(batchId: string): Promise<BatchView> {
  // Make sure the config singleton exists so the EXISTS check below can see it.
  await getConfig();
  const count = await prisma.$executeRaw`
    UPDATE "FundraiseBatch" SET "status" = 'SENDING'
    WHERE "id" = ${batchId} AND "status" = 'APPROVED'
      AND EXISTS (
        SELECT 1 FROM "FundraiseLoopConfig" WHERE "id" = 'default' AND "sendingEnabled" = true
      )`;
  if (count === 0) {
    const [config, batch] = await Promise.all([
      getConfig(),
      prisma.fundraiseBatch.findUnique({ where: { id: batchId }, select: { status: true } }),
    ]);
    if (!batch) throw new NotFoundError('Batch');
    const from = batch.status as BatchStatus;
    if (from !== 'APPROVED') throw new TransitionError(from, 'SENDING');
    if (!config.sendingEnabled) throw new ConflictError('Sending is disabled (kill switch is off)');
    throw new ConflictError('Batch changed while claiming; reload and retry');
  }
  const b = await prisma.fundraiseBatch.findUnique({
    where: { id: batchId },
    include: { prospects: sendableProspects },
  });
  if (!b) throw new NotFoundError('Batch');
  return toBatchView(b);
}

/**
 * SENDING → SENT. Records exactly which prospects reached HeyReach; every
 * other queued prospect in the batch becomes UNSENT (still deduped, never
 * auto-resent). Deliberately NOT gated on the kill switch: it records a fact
 * about pushes that already happened.
 */
export async function markSent(batchId: string, input: MarkSentInput): Promise<BatchView> {
  const batch = await prisma.fundraiseBatch.findUnique({
    where: { id: batchId },
    select: { status: true },
  });
  if (!batch) throw new NotFoundError('Batch');
  const from = batch.status as BatchStatus;
  if (!canMarkSent(from)) throw new TransitionError(from, 'SENT');

  const ids = [...new Set(input.sentProspectIds)];
  const now = new Date();
  await prisma.$transaction(async (tx) => {
    // Flip the batch first: the conditional update serialises concurrent /sent calls.
    const { count } = await tx.fundraiseBatch.updateMany({
      where: { id: batchId, status: 'SENDING' },
      data: { status: 'SENT', sentAt: now },
    });
    if (count === 0) throw new ConflictError('Batch changed while marking sent; reload and retry');
    if (ids.length) {
      const queued = await tx.fundraiseProspect.findMany({
        where: { id: { in: ids }, batchId, status: 'QUEUED', lane: 'COLD' },
        select: { id: true },
      });
      if (queued.length !== ids.length) {
        // Rolls the whole transaction back: the batch stays SENDING.
        throw new ConflictError(
          `${ids.length - queued.length} of the sentProspectIds are not queued prospects of this batch`,
        );
      }
      await tx.fundraiseProspect.updateMany({
        where: { id: { in: ids }, batchId, status: 'QUEUED' },
        data: { status: 'SENT', sentAt: now },
      });
    }
    await tx.fundraiseProspect.updateMany({
      where: { batchId, status: 'QUEUED' },
      data: { status: 'UNSENT' },
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
  // Resolve through every identity key, so an email-only export still finds a
  // prospect that was sourced by LinkedIn URL (and vice versa).
  const identities = resolved.length
    ? await prisma.fundraiseIdentity.findMany({
        where: { key: { in: [...new Set(resolved.map((r) => r.key))] } },
        select: { key: true, prospectId: true },
      })
    : [];
  const idByKey = new Map(identities.map((i) => [i.key, i.prospectId]));

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
 * list. Stored linkedinUrl/email are emitted when present, and every recorded
 * identity key is expanded too (li: → profile URL, em: → email), so rows whose
 * contact fields were redacted (privacy deletion keeps the keys) and alternate
 * identifiers of the same person still suppress re-sourcing.
 */
export async function exclusionList(): Promise<string[]> {
  const [rows, identities] = await Promise.all([
    prisma.fundraiseProspect.findMany({ select: { linkedinUrl: true, email: true } }),
    prisma.fundraiseIdentity.findMany({ select: { key: true } }),
  ]);
  const out = new Set<string>();
  for (const r of rows) {
    if (r.linkedinUrl) out.add(r.linkedinUrl);
    if (r.email) out.add(r.email);
  }
  for (const { key } of identities) {
    if (key.startsWith('li:'))
      out.add(`https://www.linkedin.com/in/${encodeURIComponent(key.slice(3))}`);
    else if (key.startsWith('em:')) out.add(key.slice(3));
  }
  return [...out];
}
