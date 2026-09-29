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
      'TRUNCATE "FundraiseIdentity","FundraiseEvent","FundraiseProspect","FundraiseBatch","FundraiseSegment","FundraiseLoopConfig" CASCADE',
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
    expect(r).toMatchObject({
      created: 3,
      duplicates: 1,
      warm: 1,
      unknownSegment: 1,
      invalid: 1,
      overAllocation: 0,
    });
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

  it('enforces the approval gate, the claim, and the kill switch', async () => {
    const none = { sentProspectIds: [] };
    await expect(store.markSent(batchId, none)).rejects.toThrow(/PENDING_APPROVAL to SENT/);
    await expect(store.claimBatch(batchId)).rejects.toThrow(); // not approved
    const batch = (await store.getSummary()).batches[0];
    const ben = batch?.prospects.find((p) => p.fullName === 'Ben B');
    await store.decideBatch(
      batchId,
      { action: 'skip', prospectIds: [ben?.id ?? ''] },
      'founder@cariforge.com',
    );
    await store.decideBatch(batchId, { action: 'approve' }, 'founder@cariforge.com');
    await expect(store.decideBatch(batchId, { action: 'approve' }, 'x')).rejects.toThrow();
    await expect(store.decideBatch(batchId, { action: 'release' }, 'x')).rejects.toThrow(); // not SENDING

    // Sending OFF: nothing listed, claim refused (409), approved-but-unclaimed can't be marked.
    expect((await store.listApprovedForSend()).batches).toHaveLength(0);
    await expect(store.claimBatch(batchId)).rejects.toBeInstanceOf(store.ConflictError);
    await expect(store.markSent(batchId, none)).rejects.toBeInstanceOf(store.TransitionError);

    await store.updateConfig({ sendingEnabled: true });
    const approved = await store.listApprovedForSend();
    expect(approved.batches[0]?.prospects.map((p) => p.fullName)).toEqual(['Ana A']); // skipped Ben excluded

    const claimed = await store.claimBatch(batchId);
    expect(claimed.status).toBe('SENDING');
    expect(claimed.prospects.map((p) => p.fullName)).toEqual(['Ana A']);
    // Double claim → 409; a claimed batch is no longer listed or rejectable.
    await expect(store.claimBatch(batchId)).rejects.toBeInstanceOf(store.TransitionError);
    expect((await store.listApprovedForSend()).batches).toHaveLength(0);
    await expect(store.decideBatch(batchId, { action: 'reject' }, 'x')).rejects.toBeInstanceOf(
      store.TransitionError,
    );
    await expect(store.decideBatch(batchId, { action: 'approve' }, 'x')).rejects.toThrow();

    // Kill switch flips mid-run: recording what was already pushed still succeeds.
    await store.updateConfig({ sendingEnabled: false });
    const ana = claimed.prospects[0]?.id ?? '';
    const sent = await store.markSent(batchId, { sentProspectIds: [ana] });
    expect(sent.status).toBe('SENT');
    expect(sent.prospects.find((p) => p.id === ana)?.status).toBe('SENT');
    expect(sent.prospects.find((p) => p.fullName === 'Ben B')?.status).toBe('SKIPPED');
    await expect(store.markSent(batchId, { sentProspectIds: [ana] })).rejects.toThrow(); // once only
    await store.updateConfig({ sendingEnabled: true });
  });

  it('release returns a stuck batch to APPROVED; /sent marks the rest UNSENT', async () => {
    const mk = (n: number) => ({
      segmentKey: 'emerging-markets-impact',
      fullName: `Rel ${n}`,
      linkedinUrl: `https://www.linkedin.com/in/rel-${n}`,
    });
    const r = await store.ingestBatch({ prospects: [mk(1), mk(2), mk(3)] });
    expect(r.created).toBe(3);
    const id = r.batchId ?? '';
    await store.decideBatch(id, { action: 'approve' }, 'founder@cariforge.com');

    const first = await store.claimBatch(id);
    expect(first.prospects).toHaveLength(3);
    // Founder verified nothing reached HeyReach → release.
    const released = await store.decideBatch(id, { action: 'release' }, 'founder@cariforge.com');
    expect(released.status).toBe('APPROVED');
    await expect(store.decideBatch(id, { action: 'release' }, 'x')).rejects.toThrow();
    expect((await store.listApprovedForSend()).batches.map((b) => b.id)).toContain(id);

    const second = await store.claimBatch(id);
    const [p1, p2, p3] = second.prospects;

    // Ids that are not queued prospects of this batch are refused; batch stays SENDING.
    const other = (await store.getSummary()).batches.find((b) => b.id === batchId);
    const foreign = other?.prospects[0]?.id ?? 'nope';
    await expect(
      store.markSent(id, { sentProspectIds: [p1?.id ?? '', foreign] }),
    ).rejects.toBeInstanceOf(store.ConflictError);
    expect((await store.getSummary()).batches.find((b) => b.id === id)?.status).toBe('SENDING');

    const done = await store.markSent(id, { sentProspectIds: [p1?.id ?? ''] });
    expect(done.status).toBe('SENT');
    const statusOf = (pid?: string) => done.prospects.find((p) => p.id === pid)?.status;
    expect(statusOf(p1?.id)).toBe('SENT');
    expect(statusOf(p2?.id)).toBe('UNSENT');
    expect(statusOf(p3?.id)).toBe('UNSENT');

    // UNSENT people stay deduped: never re-sourced, never auto-resent.
    const again = await store.ingestBatch({ prospects: [mk(2)] });
    expect(again).toMatchObject({ created: 0, duplicates: 1, batchId: null });
    // Only the pushed prospect counts as a sent trial.
    const seg = (await store.computePlan()).segments.find(
      (s) => s.key === 'emerging-markets-impact',
    );
    expect(seg?.contacted).toBe(3);
  });

  it('dedupes across identifiers: an email-only record matches a LinkedIn+email prospect', async () => {
    const first = await store.ingestBatch({
      prospects: [
        {
          segmentKey: 'govtech-applied-ai-seed',
          fullName: 'Dana D',
          firm: 'Delta Ventures',
          linkedinUrl: 'https://www.linkedin.com/in/%44ana-d/',
          email: 'Dana@Delta.vc',
        },
      ],
    });
    expect(first.created).toBe(1);

    const later = await store.ingestBatch({
      prospects: [
        // Same person, only the email this time (different case, other name spelling).
        { segmentKey: 'govtech-applied-ai-seed', fullName: 'D. Dana', email: 'dana@delta.VC' },
        // Same person by name + firm only.
        { segmentKey: 'caribbean-latam-seed', fullName: 'Dana  D', firm: 'Delta Ventures' },
        // Same LinkedIn handle, decoded + lowercased differently.
        {
          segmentKey: 'govtech-applied-ai-seed',
          fullName: 'Dana',
          linkedinUrl: 'linkedin.com/in/DANA-D',
        },
      ],
    });
    expect(later).toMatchObject({ created: 0, duplicates: 3, batchId: null });

    // Within one payload, two rows sharing any key collapse to one.
    const payload = await store.ingestBatch({
      prospects: [
        {
          segmentKey: 'govtech-applied-ai-seed',
          fullName: 'Eve E',
          linkedinUrl: 'linkedin.com/in/eve-e',
          email: 'eve@e.vc',
        },
        { segmentKey: 'govtech-applied-ai-seed', fullName: 'Eve Other', email: 'EVE@e.vc' },
      ],
    });
    expect(payload).toMatchObject({ created: 1, duplicates: 1 });

    // Outcome import by email resolves to the LinkedIn-keyed prospect.
    expect(
      await store.recordEvents(
        [{ identifier: 'dana@delta.vc', type: 'REPLY', occurredAt: new Date() }],
        'manual',
      ),
    ).toMatchObject({ recorded: 1, unmatched: [] });

    const ex = await store.exclusionList();
    expect(ex).toContain('https://www.linkedin.com/in/dana-d');
    expect(ex).toContain('dana@delta.vc');
  });

  it('concurrent ingests of one person under different identifiers create one prospect', async () => {
    const [a, b] = await Promise.all([
      store.ingestBatch({
        prospects: [
          {
            segmentKey: 'caribbean-latam-seed',
            fullName: 'Race R',
            linkedinUrl: 'https://www.linkedin.com/in/race-r',
            email: 'race@r.vc',
          },
        ],
      }),
      store.ingestBatch({
        prospects: [{ segmentKey: 'caribbean-latam-seed', fullName: 'R Race', email: 'race@r.vc' }],
      }),
    ]);
    expect(a.created + b.created).toBe(1);
    expect(a.duplicates + b.duplicates).toBe(1);
    // The loser's empty batch is not left behind.
    expect([a.batchId, b.batchId].filter(Boolean)).toHaveLength(1);
    expect(await prisma.fundraiseIdentity.count({ where: { key: 'em:race@r.vc' } })).toBe(1);
  });

  it('rejects cold rows beyond the plan allocation (overAllocation)', async () => {
    const plan = await store.computePlan();
    const alloc = plan.segments.find((s) => s.key === 'development-finance')?.allocation ?? 0;
    expect(alloc).toBeGreaterThan(0);
    const rows = Array.from({ length: alloc + 3 }, (_, i) => ({
      segmentKey: 'development-finance',
      fullName: `Dfi ${i}`,
      email: `dfi${i}@dfi.org`,
    }));
    const warm = {
      segmentKey: 'development-finance',
      fullName: 'Warm W',
      email: 'warm@dfi.org',
      warmPath: 'Board member',
    };
    const r = await store.ingestBatch({ prospects: [...rows, warm] });
    expect(r).toMatchObject({ created: alloc + 1, warm: 1, overAllocation: 3, duplicates: 0 });
    // Rejected rows were not stored, so a later week can still source them.
    const ex = await store.exclusionList();
    expect(ex).not.toContain(`dfi${alloc + 2}@dfi.org`);

    // Total cold rows are capped at batchSize too.
    await store.updateConfig({ batchSize: 2 });
    const tiny = await store.ingestBatch({
      prospects: [
        'caribbean-latam-seed',
        'emerging-markets-impact',
        'govtech-applied-ai-seed',
        'development-finance',
        'caribbean-latam-seed',
      ].map((segmentKey, i) => ({ segmentKey, fullName: `Cap ${i}`, email: `cap${i}@x.vc` })),
    });
    expect(tiny.created).toBeLessThanOrEqual(2);
    expect(tiny.created + tiny.overAllocation).toBe(5);
    await store.updateConfig({ batchSize: 40 });
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
