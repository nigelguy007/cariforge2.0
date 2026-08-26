// @polsia:user-owned — derivation coverage for the autonomy + telemetry
// helpers: gate decision counts, release actor, draft-age bucketisation,
// admin overview scan.
import { describe, expect, it } from 'vitest';
import {
  adminOverview,
  deriveReleaseActor,
  draftAge,
  gateDecisionCounts,
} from '@/lib/business/forge/telemetry-service';
import type { ApprovalItemT, HandoffItemT, MissionStatus, StageName } from '@/lib/contracts/forge';

function tagMap(
  entries: Array<[string, { actorKind: string }[]]>,
): Map<string, { actorKind: string }[]> {
  return new Map(entries);
}

function ap(overrides: Partial<ApprovalItemT>): ApprovalItemT {
  return {
    id: 'a-1',
    gateIndex: 0,
    stageHandoffId: 'h-1',
    approverUserId: 'user-1',
    decision: 'Approve',
    controls: null,
    reasonCode: 'Approved',
    reasonText: 'ok',
    supersedesApprovalId: null,
    replayOfApprovalId: null,
    at: '2026-04-01T00:00:00.000Z',
    oracleRole: null,
    approverMatchedElder: false,
    attesterUserIds: [],
    ...overrides,
  };
}

const STAGE_BY_GATE = new Map<number, StageName>([
  [0, 'Discovery'],
  [1, 'Readiness'],
  [2, 'Workflow'],
  [3, 'Governance'],
  [4, 'SoftwareBuild'],
]);

describe('gateDecisionCounts', () => {
  it('happy path: counts approve / edit / reject and AI/Human attribution', () => {
    const approvals = [
      ap({ id: 'a1', gateIndex: 0, decision: 'Approve' }),
      ap({ id: 'a2', gateIndex: 0, decision: 'Return' }),
      ap({ id: 'a3', gateIndex: 1, decision: 'Approve' }),
      ap({ id: 'a4', gateIndex: 4, decision: 'Refuse' }),
    ];
    const tags = tagMap([
      ['a1', [{ actorKind: 'AI' }]],
      ['a3', [{ actorKind: 'Human' }]],
    ]);
    const out = gateDecisionCounts(approvals, tags, STAGE_BY_GATE);
    const g0 = out.find((g) => g.gateIndex === 0);
    expect(g0?.approved).toBe(1);
    expect(g0?.edited).toBe(1);
    expect(g0?.rejected).toBe(0);
    expect(g0?.aiOnlyApprovals).toBe(1);
    expect(g0?.humanApprovals).toBe(0);
    const g1 = out.find((g) => g.gateIndex === 1);
    expect(g1?.approved).toBe(1);
    expect(g1?.humanApprovals).toBe(1);
    const g4 = out.find((g) => g.gateIndex === 4);
    expect(g4?.rejected).toBe(1);
  });

  it('approvals with no tag set are NOT counted as AIOnly OR Human', () => {
    const approvals = [ap({ id: 'a1', gateIndex: 0, decision: 'Approve' })];
    const out = gateDecisionCounts(approvals, new Map(), STAGE_BY_GATE);
    const g0 = out.find((g) => g.gateIndex === 0);
    expect(g0?.approved).toBe(1);
    expect(g0?.aiOnlyApprovals).toBe(0);
    expect(g0?.humanApprovals).toBe(0);
  });

  it('handles empty approvals + ties (returns each gate with zero counts)', () => {
    const out = gateDecisionCounts([], new Map(), STAGE_BY_GATE);
    expect(out.length).toBe(5);
    for (const g of out) {
      expect(g.approved + g.edited + g.rejected).toBe(0);
    }
  });
});

describe('deriveReleaseActor', () => {
  it('all-AI tags => AIOnly', () => {
    const tags = tagMap([
      ['a1', [{ actorKind: 'AI' }]],
      ['a2', [{ actorKind: 'AI' }]],
    ]);
    expect(
      deriveReleaseActor(
        [
          ap({ id: 'a1', decision: 'Approve' }),
          ap({ id: 'a2', gateIndex: 1, decision: 'Approve' }),
        ],
        tags,
      ),
    ).toBe('AIOnly');
  });
  it('all-human tags => Human', () => {
    const tags = tagMap([['a1', [{ actorKind: 'Human' }]]]);
    expect(deriveReleaseActor([ap({ id: 'a1' })], tags)).toBe('Human');
  });
  it('mixed tags => Hybrid', () => {
    const tags = tagMap([
      ['a1', [{ actorKind: 'AI' }]],
      ['a2', [{ actorKind: 'Human' }]],
    ]);
    expect(
      deriveReleaseActor(
        [ap({ id: 'a1' }), ap({ id: 'a2', gateIndex: 1, decision: 'Approve' })],
        tags,
      ),
    ).toBe('Hybrid');
  });
  it('no tags => Hybrid (honest default)', () => {
    expect(deriveReleaseActor([ap({ id: 'a1' })], new Map())).toBe('Hybrid');
  });
  it('non-Approve approvals are ignored', () => {
    const tags = tagMap([['a2', [{ actorKind: 'Human' }]]]);
    expect(deriveReleaseActor([ap({ id: 'a1', decision: 'Return' }), ap({ id: 'a2' })], tags)).toBe(
      'Human',
    );
  });
});

function handoff(overrides: Partial<HandoffItemT>): HandoffItemT {
  return {
    id: 'h-1',
    stage: 'Discovery',
    version: 1,
    parentVersionId: null,
    correctionOfId: null,
    supersededById: overrides.supersededById ?? null,
    replayOfMissionId: null,
    invalidationReasonCode: null,
    confidence: 0.7,
    gateIndexThatApproves: 0,
    payload: {},
    missingEvidence: [],
    toolRefs: [],
    producedByToolActionId: null,
    createdById: 'user-1',
    createdAt: '2026-04-01T00:00:00.000Z',
    ...overrides,
  };
}

function nowPlus(iso: string, days: number): Date {
  return new Date(new Date(iso).getTime() + days * 24 * 60 * 60 * 1000);
}

describe('draftAge', () => {
  it('empty handoffs => isAwaiting: false', () => {
    const age = draftAge(new Date('2026-05-01'), [], 'InBuild' as MissionStatus, null);
    expect(age.isAwaiting).toBe(false);
    expect(age.bucket).toBe('<1d');
  });
  it('released mission => 0 / <1d', () => {
    const age = draftAge(new Date('2026-05-01'), [handoff({})], 'Completed', {
      releasedAt: new Date('2026-05-01'),
    });
    expect(age.isAwaiting).toBe(false);
    expect(age.daysOld).toBe(0);
  });
  it('fresh unreleased handoff => <1d', () => {
    const age = draftAge(nowPlus('2026-04-01', 0.5), [handoff({})], 'InBuild', null);
    expect(age.isAwaiting).toBe(true);
    expect(age.bucket).toBe('<1d');
  });
  it('5-day-old unreleased handoff => 3-7d', () => {
    const age = draftAge(nowPlus('2026-04-01', 5), [handoff({})], 'InBuild', null);
    expect(age.isAwaiting).toBe(true);
    expect(age.bucket).toBe('3-7d');
  });
  it('old unreleased handoff => 7+d', () => {
    const age = draftAge(nowPlus('2026-04-01', 12), [handoff({})], 'InBuild', null);
    expect(age.isAwaiting).toBe(true);
    expect(age.bucket).toBe('7+d');
  });
});

describe('adminOverview', () => {
  it('groups per gate + per company + per day', () => {
    const out = adminOverview({
      perGateCounts: [
        {
          gateIndex: 0,
          stage: 'Discovery',
          approved: 4,
          edited: 1,
          rejected: 0,
          aiOnlyApprovals: 2,
          humanApprovals: 2,
        },
      ],
      creditLedger: [
        { companyId: 'c-1', amountCents: 5000 },
        { companyId: 'c-1', amountCents: -1500 },
        { companyId: 'c-2', amountCents: 8000 },
      ],
      chatRows: [
        {
          windowStartIso: '2026-05-01T00:00:00.000Z',
          costCents: 100,
          messageCount: 30,
          unknownCost: false,
        },
        {
          windowStartIso: '2026-05-01T12:00:00.000Z',
          costCents: 50,
          messageCount: 10,
          unknownCost: true,
        },
        {
          windowStartIso: '2026-05-02T00:00:00.000Z',
          costCents: 60,
          messageCount: 20,
          unknownCost: false,
        },
      ],
    });
    expect(out.autonomyLadder[0]?.aiOnlyShare).toBeCloseTo(0.5);
    const c1 = out.perCompanyCredit.find((c) => c.companyId === 'c-1');
    expect(c1?.credits).toBe(5000);
    expect(c1?.debits).toBe(1500);
    expect(c1?.netCents).toBe(3500);
    const c2 = out.perCompanyCredit.find((c) => c.companyId === 'c-2');
    expect(c2?.netCents).toBe(8000);
    expect(out.chatCostByDay.length).toBe(2);
    expect(out.chatCostByDay[0]?.cents).toBe(150); // merged day 1
    expect(out.chatCostByDay[0]?.hasUnknownCost).toBe(true);
    expect(out.chatCostByDay[1]?.cents).toBe(60);
  });

  it('null safety: empty inputs produce a defined shape', () => {
    const out = adminOverview({ perGateCounts: [], creditLedger: [], chatRows: [] });
    expect(out.autonomyLadder).toEqual([]);
    expect(out.perCompanyCredit).toEqual([]);
    expect(out.chatCostByDay).toEqual([]);
  });
});
