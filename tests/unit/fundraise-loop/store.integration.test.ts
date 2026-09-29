// @vitest-environment node
// @polsia:user-owned — end-to-end fundraise loop against a REAL Postgres.
// Skipped unless FUNDRAISE_IT_DATABASE_URL points at a disposable database
// with migrations applied (it truncates the fundraise tables). Run:
//   FUNDRAISE_IT_DATABASE_URL=postgresql://… DATABASE_URL=$FUNDRAISE_IT_DATABASE_URL npx vitest run tests/unit/fundraise-loop/store.integration.test.ts
import { beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const IT = process.env.FUNDRAISE_IT_DATABASE_URL;

describe.skipIf(!IT)('fundraise loop store (Postgres integration)', () => {
  let store: typeof import('@/lib/business/fundraise-loop/store');
  let prisma: typeof import('@/lib/db')['prisma'];

  beforeAll(async () => {
    // biome-ignore lint/style/noRestrictedImports: integration test drives the real Prisma client
    ({ prisma } = await import('@/lib/db'));
    await prisma.$executeRawUnsafe(
      'TRUNCATE "FundraiseEvent","FundraiseProspect","FundraiseBatch","FundraiseSegment","FundraiseLoopConfig" CASCADE',
    );
    const { seed } = await import('@/lib/seed');
    await seed();
    await seed(); // idempotent: second boot must not throw or duplicate
    store = await import('@/lib/business/fundraise-loop/store');
  });

  it('seeds 5 segments and a kill-switched config', async () => {
    expect(await prisma.fundraiseSegment.count()).toBe(5);
    expect((await store.getConfig()).sendingEnabled).toBe(false);
    const plan = await store.computePlan();
    expect(plan.segments.reduce((s, x) => s + x.allocation, 0)).toBe(40);
  });

  let batchId = '';
  it('ingests, dedupes, and diverts warm paths', async () => {
    const r = await store.ingestBatch({
      prospects: [
        {
          segmentKey: 'diaspora-angels',
          fullName: 'Ana A',
          linkedinUrl: 'https://linkedin.com/in/ana-a/',
        },
        {
          segmentKey: 'diaspora-angels',
          fullName: 'Ana dup',
          linkedinUrl: 'linkedin.com/in/ANA-A',
        },
        {
          segmentKey: 'govtech-applied-ai-seed',
          fullName: 'Ben B',
          firm: 'Fund B',
          email: 'ben@fundb.vc',
        },
        {
          segmentKey: 'development-finance',
          fullName: 'Cy C',
          firm: 'DFI',
          warmPath: 'Board member knows Cy',
        },
        { segmentKey: 'nope', fullName: 'X', email: 'x@x.com' },
        { segmentKey: 'diaspora-angels', fullName: 'No identifiers' },
      ],
    });
    expect(r).toMatchObject({ created: 3, duplicates: 1, warm: 1, unknownSegment: 1, invalid: 1 });
    expect(r.batchId).toBeTruthy();
    batchId = r.batchId ?? '';

    const again = await store.ingestBatch({
      prospects: [
        { segmentKey: 'diaspora-angels', fullName: 'Ana', linkedinUrl: 'linkedin.com/in/ana-a' },
      ],
    });
    expect(again).toMatchObject({ created: 0, duplicates: 1, batchId: null });

    const summary = await store.getSummary();
    expect(summary.warmIntros).toHaveLength(1);
    expect(summary.totals.pendingApproval).toBe(1);
    expect(summary.batches[0]?.prospects).toHaveLength(2); // warm prospect not in the cold batch
  });

  it('enforces the approval gate and kill switch', async () => {
    await expect(store.markSent(batchId)).rejects.toThrow(); // not approved
    const batch = (await store.getSummary()).batches[0];
    const ben = batch?.prospects.find((p) => p.fullName === 'Ben B');
    await store.decideBatch(
      batchId,
      { action: 'skip', prospectIds: [ben?.id ?? ''] },
      'founder@cariforge.com',
    );
    await store.decideBatch(batchId, { action: 'approve' }, 'founder@cariforge.com');
    await expect(store.decideBatch(batchId, { action: 'approve' }, 'x')).rejects.toThrow();

    expect((await store.listApprovedForSend()).batches).toHaveLength(0); // sending OFF
    await expect(store.markSent(batchId)).rejects.toThrow();

    await store.updateConfig({ sendingEnabled: true });
    const approved = await store.listApprovedForSend();
    expect(approved.batches[0]?.prospects.map((p) => p.fullName)).toEqual(['Ana A']); // skipped Ben excluded
    const sent = await store.markSent(batchId);
    expect(sent.status).toBe('SENT');
    await expect(store.markSent(batchId)).rejects.toThrow(); // no double send
  });

  it('records outcomes idempotently and feeds the plan', async () => {
    const input = {
      events: [
        {
          identifier: 'https://www.linkedin.com/in/ana-a',
          type: 'REPLY' as const,
          occurredAt: new Date(),
        },
        {
          identifier: 'https://www.linkedin.com/in/ana-a',
          type: 'MEETING' as const,
          occurredAt: new Date(),
        },
        { identifier: 'nobody@nowhere.com', type: 'REPLY' as const, occurredAt: new Date() },
      ],
    };
    expect(await store.recordEvents(input.events, 'manual')).toMatchObject({
      recorded: 2,
      alreadyRecorded: 0,
      unmatched: ['nobody@nowhere.com'],
    });
    expect(await store.recordEvents(input.events, 'manual')).toMatchObject({
      recorded: 0,
      alreadyRecorded: 2,
    });

    const seg = (await store.computePlan()).segments.find((s) => s.key === 'diaspora-angels');
    expect(seg).toMatchObject({ contacted: 1, meetings: 1, maturedTrials: 1 });
  });

  it('exports exclusions for every known identity', async () => {
    const ex = await store.exclusionList();
    expect(ex).toContain('https://www.linkedin.com/in/ana-a');
    expect(ex).toContain('ben@fundb.vc');
  });
});
