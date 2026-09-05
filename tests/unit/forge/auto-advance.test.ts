// @vitest-environment node — not the suite's default jsdom: auto-advance.ts
// imports 'server-only' directly, and under jsdom Vite's import-analysis
// tries to actually resolve that bare specifier (it isn't a real npm
// package) before vi.mock('server-only', ...) below gets a chance to
// intercept it, and the whole file fails to load. Matches the same fix
// already used in tests/unit/example/contract.test.ts for the same reason.
//
// @polsia:user-owned — coverage for the auto-advance policy engine (the
// core of this session's "AI actually does the work" architecture). Every
// dependency (Oracle review/reconciliation, the AI drafter, the governance
// service layer) is mocked so this exercises the ORCHESTRATION LOGIC only:
// which branch fires for a given review outcome, that the redraft retry is
// capped at exactly one round (never a loop), and that a real gate
// decision is only ever requested when every stated condition holds.

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { reviewAndMaybeAdvance } from '@/lib/business/forge/auto-advance';

vi.mock('server-only', () => ({}));

const service = vi.hoisted(() => ({
  addHandoffAttester: vi.fn(),
  correctHandoff: vi.fn(),
  createObjection: vi.fn(),
  decideGate: vi.fn(),
  getMissionDetail: vi.fn(),
  resolveObjection: vi.fn(),
}));
vi.mock('@/lib/business/forge/service', () => service);

const oracleReview = vi.hoisted(() => ({
  reconcileConcerns: vi.fn(),
  reviewStepDraft: vi.fn(),
}));
vi.mock('@/lib/business/forge/oracle-review', () => oracleReview);

const aiDraft = vi.hoisted(() => ({ draftStepOutput: vi.fn() }));
vi.mock('@/lib/business/forge/ai-draft', () => aiDraft);

const ROLES = ['Risk', 'Demand', 'Growth', 'Competition', 'Money'] as const;

function allClear() {
  return {
    status: 'ok' as const,
    verdicts: ROLES.map((role) => ({ role, verdict: 'clear' as const, note: 'looks fine' })),
  };
}

function oneConcern(role: (typeof ROLES)[number] = 'Risk') {
  return {
    status: 'ok' as const,
    verdicts: ROLES.map((r) => ({
      role: r,
      verdict: r === role ? ('concern' as const) : ('clear' as const),
      note: r === role ? 'the scope looks unbounded' : 'looks fine',
    })),
  };
}

function missionDetail(overrides: {
  objections?: readonly {
    id: string;
    stageHandoffId: string;
    raisedByRole: string;
    text: string;
    raisedAt: string;
    resolution: string | null;
  }[];
  handoffs?: readonly {
    id: string;
    stage: string;
    supersededById: string | null;
    payload: Record<string, unknown>;
    createdAt: string;
  }[];
  toolActions?: readonly { decision: string | null }[];
  evidence?: readonly { label: string; kind: string }[];
}) {
  return {
    mission: { intake: 'the intake text', normalizedNeed: 'the normalized need' },
    objections: overrides.objections ?? [],
    handoffs: overrides.handoffs ?? [],
    toolActions: overrides.toolActions ?? [],
    // Real gap fixed 2026-09-05: the self-redraft branch now reads
    // stillOpen.evidence to pass it to draftStepOutput — default empty,
    // matching the real MissionDetailT shape.
    evidence: overrides.evidence ?? [],
  };
}

const BASE_ARGS = {
  missionId: 'mission-1',
  ownerUserId: 'user-1',
  gateIndex: 0,
  stage: 'Discovery' as const,
  handoffId: 'handoff-1',
  draftSummary: 'a clear, bounded problem statement',
  draftConfidence: 0.9,
  draftMissingEvidence: [] as readonly string[],
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('reviewAndMaybeAdvance — review unavailable', () => {
  it('returns unreviewed and touches nothing else', async () => {
    oracleReview.reviewStepDraft.mockResolvedValueOnce({ status: 'unavailable' });
    const outcome = await reviewAndMaybeAdvance(BASE_ARGS);
    expect(outcome).toEqual({ reviewed: false, advanced: false, concernCount: 0 });
    expect(service.addHandoffAttester).not.toHaveBeenCalled();
    expect(service.getMissionDetail).not.toHaveBeenCalled();
    expect(service.decideGate).not.toHaveBeenCalled();
  });
});

describe('reviewAndMaybeAdvance — clean review', () => {
  it('attests all five roles and auto-advances when every condition holds', async () => {
    oracleReview.reviewStepDraft.mockResolvedValueOnce(allClear());
    service.getMissionDetail.mockResolvedValueOnce(missionDetail({}));
    service.decideGate.mockResolvedValueOnce(undefined);

    const outcome = await reviewAndMaybeAdvance(BASE_ARGS);

    expect(service.addHandoffAttester).toHaveBeenCalledTimes(5);
    expect(service.decideGate).toHaveBeenCalledTimes(1);
    expect(service.decideGate).toHaveBeenCalledWith(
      expect.objectContaining({
        missionId: 'mission-1',
        gateIndex: 0,
        decision: 'Approve',
        stageHandoffId: 'handoff-1',
      }),
    );
    expect(outcome).toEqual({ reviewed: true, advanced: true, concernCount: 0 });
  });

  it('does not advance when confidence is below the threshold', async () => {
    oracleReview.reviewStepDraft.mockResolvedValueOnce(allClear());
    service.getMissionDetail.mockResolvedValueOnce(missionDetail({}));

    const outcome = await reviewAndMaybeAdvance({ ...BASE_ARGS, draftConfidence: 0.4 });

    expect(service.decideGate).not.toHaveBeenCalled();
    expect(outcome).toEqual({ reviewed: true, advanced: false, concernCount: 0 });
  });

  it('does not advance when evidence is still missing', async () => {
    oracleReview.reviewStepDraft.mockResolvedValueOnce(allClear());
    service.getMissionDetail.mockResolvedValueOnce(missionDetail({}));

    const outcome = await reviewAndMaybeAdvance({
      ...BASE_ARGS,
      draftMissingEvidence: ['a signed data-processing agreement'],
    });

    expect(service.decideGate).not.toHaveBeenCalled();
    expect(outcome).toEqual({ reviewed: true, advanced: false, concernCount: 0 });
  });

  it('does not advance when another unresolved concern exists on the mission', async () => {
    oracleReview.reviewStepDraft.mockResolvedValueOnce(allClear());
    service.getMissionDetail.mockResolvedValueOnce(
      missionDetail({
        objections: [
          {
            id: 'obj-elsewhere',
            stageHandoffId: 'some-other-handoff',
            raisedByRole: 'Risk',
            text: 'unrelated concern',
            raisedAt: '2026-01-01T00:00:00.000Z',
            resolution: null,
          },
        ],
      }),
    );

    const outcome = await reviewAndMaybeAdvance(BASE_ARGS);

    expect(service.decideGate).not.toHaveBeenCalled();
    expect(outcome).toEqual({ reviewed: true, advanced: false, concernCount: 0 });
  });

  it('does not advance while a tool action is still awaiting a decision', async () => {
    oracleReview.reviewStepDraft.mockResolvedValueOnce(allClear());
    service.getMissionDetail.mockResolvedValueOnce(
      missionDetail({ toolActions: [{ decision: null }] }),
    );

    const outcome = await reviewAndMaybeAdvance(BASE_ARGS);

    expect(service.decideGate).not.toHaveBeenCalled();
    expect(outcome).toEqual({ reviewed: true, advanced: false, concernCount: 0 });
  });

  it('falls back to the human path if decideGate itself throws', async () => {
    oracleReview.reviewStepDraft.mockResolvedValueOnce(allClear());
    service.getMissionDetail.mockResolvedValueOnce(missionDetail({}));
    service.decideGate.mockRejectedValueOnce(new Error('FORGE_ELDER_ORACLE_MISSING'));

    const outcome = await reviewAndMaybeAdvance(BASE_ARGS);

    expect(outcome).toEqual({ reviewed: true, advanced: false, concernCount: 0 });
  });
});

describe('reviewAndMaybeAdvance — a concern the Council Chair resolves', () => {
  it('advances once the Chair resolves the only concern raised', async () => {
    oracleReview.reviewStepDraft.mockResolvedValueOnce(oneConcern('Risk'));
    service.createObjection.mockResolvedValueOnce({
      objections: [
        {
          id: 'obj-1',
          stageHandoffId: 'handoff-1',
          raisedByRole: 'Risk',
          text: 'the scope looks unbounded',
          raisedAt: '2026-01-01T00:00:00.000Z',
          resolution: null,
        },
      ],
    });
    oracleReview.reconcileConcerns.mockResolvedValueOnce({
      status: 'ok',
      resolutions: [{ role: 'Risk', resolved: true, rationale: 'already bounded elsewhere' }],
    });
    // The final read (post-reconciliation) reflects the Chair's resolution.
    service.getMissionDetail.mockResolvedValueOnce(missionDetail({}));
    service.decideGate.mockResolvedValueOnce(undefined);

    const outcome = await reviewAndMaybeAdvance(BASE_ARGS);

    expect(service.resolveObjection).toHaveBeenCalledWith(
      expect.objectContaining({ objectionId: 'obj-1', resolution: 'Overruled' }),
    );
    expect(service.addHandoffAttester).toHaveBeenCalledTimes(4); // the four 'clear' roles
    expect(service.decideGate).toHaveBeenCalledTimes(1);
    expect(outcome).toEqual({ reviewed: true, advanced: true, concernCount: 0 });
  });
});

describe('reviewAndMaybeAdvance — bounded single retry', () => {
  it('redrafts once, and advances if the redraft comes back clean', async () => {
    // First pass: one unresolved concern.
    oracleReview.reviewStepDraft.mockResolvedValueOnce(oneConcern('Risk'));
    service.createObjection.mockResolvedValueOnce({
      objections: [
        {
          id: 'obj-1',
          stageHandoffId: 'handoff-1',
          raisedByRole: 'Risk',
          text: 'the scope looks unbounded',
          raisedAt: '2026-01-01T00:00:00.000Z',
          resolution: null,
        },
      ],
    });
    oracleReview.reconcileConcerns.mockResolvedValueOnce({
      status: 'ok',
      resolutions: [{ role: 'Risk', resolved: false, rationale: 'needs a real answer' }],
    });
    service.getMissionDetail.mockResolvedValueOnce(
      missionDetail({
        objections: [
          {
            id: 'obj-1',
            stageHandoffId: 'handoff-1',
            raisedByRole: 'Risk',
            text: 'the scope looks unbounded',
            raisedAt: '2026-01-01T00:00:00.000Z',
            resolution: null,
          },
        ],
      }),
    );
    aiDraft.draftStepOutput.mockResolvedValueOnce({
      status: 'ok',
      draft: {
        payload: { summary: 'v2 — scope now bounded' },
        confidence: 0.9,
        missingEvidence: [],
      },
    });
    service.correctHandoff.mockResolvedValueOnce({
      handoffs: [{ id: 'handoff-2', stage: 'Discovery', supersededById: null }],
    });

    // Second pass (the retry): clean review, nothing else outstanding.
    oracleReview.reviewStepDraft.mockResolvedValueOnce(allClear());
    service.getMissionDetail.mockResolvedValueOnce(missionDetail({}));
    service.decideGate.mockResolvedValueOnce(undefined);

    const outcome = await reviewAndMaybeAdvance(BASE_ARGS);

    expect(aiDraft.draftStepOutput).toHaveBeenCalledTimes(1);
    expect(aiDraft.draftStepOutput).toHaveBeenCalledWith(
      expect.objectContaining({ feedback: ['the scope looks unbounded'] }),
    );
    expect(service.correctHandoff).toHaveBeenCalledTimes(1);
    expect(service.correctHandoff).toHaveBeenCalledWith(
      expect.objectContaining({ handoffId: 'handoff-1', reasonCode: 'ReplayRequired' }),
    );
    expect(service.decideGate).toHaveBeenCalledTimes(1);
    expect(service.decideGate).toHaveBeenCalledWith(
      expect.objectContaining({ stageHandoffId: 'handoff-2' }),
    );
    expect(outcome).toEqual({ reviewed: true, advanced: true, concernCount: 0 });
  });

  it('escalates to a human after one retry — never a second redraft', async () => {
    const unresolvedObjection = {
      id: 'obj-1',
      stageHandoffId: 'handoff-1',
      raisedByRole: 'Risk',
      text: 'the scope looks unbounded',
      raisedAt: '2026-01-01T00:00:00.000Z',
      resolution: null,
    };
    oracleReview.reviewStepDraft.mockResolvedValueOnce(oneConcern('Risk'));
    service.createObjection.mockResolvedValueOnce({ objections: [unresolvedObjection] });
    oracleReview.reconcileConcerns.mockResolvedValueOnce({
      status: 'ok',
      resolutions: [{ role: 'Risk', resolved: false, rationale: 'still needs a human' }],
    });
    service.getMissionDetail.mockResolvedValueOnce(
      missionDetail({ objections: [unresolvedObjection] }),
    );
    aiDraft.draftStepOutput.mockResolvedValueOnce({
      status: 'ok',
      draft: { payload: { summary: 'v2' }, confidence: 0.9, missingEvidence: [] },
    });
    service.correctHandoff.mockResolvedValueOnce({
      handoffs: [{ id: 'handoff-2', stage: 'Discovery', supersededById: null }],
    });

    // The retry comes back with the SAME unresolved concern, tied to the new handoff.
    const stillUnresolvedOnRetry = { ...unresolvedObjection, stageHandoffId: 'handoff-2' };
    oracleReview.reviewStepDraft.mockResolvedValueOnce(oneConcern('Risk'));
    service.createObjection.mockResolvedValueOnce({ objections: [stillUnresolvedOnRetry] });
    oracleReview.reconcileConcerns.mockResolvedValueOnce({
      status: 'ok',
      resolutions: [{ role: 'Risk', resolved: false, rationale: 'still needs a human' }],
    });
    service.getMissionDetail.mockResolvedValueOnce(
      missionDetail({ objections: [stillUnresolvedOnRetry] }),
    );

    const outcome = await reviewAndMaybeAdvance(BASE_ARGS);

    expect(aiDraft.draftStepOutput).toHaveBeenCalledTimes(1); // capped — no second redraft
    expect(service.correctHandoff).toHaveBeenCalledTimes(1);
    expect(service.decideGate).not.toHaveBeenCalled();
    expect(outcome).toEqual({ reviewed: true, advanced: false, concernCount: 1 });
  });

  it('escalates without recursing when the redraft itself is unavailable', async () => {
    const unresolvedObjection = {
      id: 'obj-1',
      stageHandoffId: 'handoff-1',
      raisedByRole: 'Risk',
      text: 'the scope looks unbounded',
      raisedAt: '2026-01-01T00:00:00.000Z',
      resolution: null,
    };
    oracleReview.reviewStepDraft.mockResolvedValueOnce(oneConcern('Risk'));
    service.createObjection.mockResolvedValueOnce({ objections: [unresolvedObjection] });
    oracleReview.reconcileConcerns.mockResolvedValueOnce({
      status: 'ok',
      resolutions: [{ role: 'Risk', resolved: false, rationale: 'still needs a human' }],
    });
    service.getMissionDetail.mockResolvedValueOnce(
      missionDetail({ objections: [unresolvedObjection] }),
    );
    aiDraft.draftStepOutput.mockResolvedValueOnce({ status: 'unavailable' });

    const outcome = await reviewAndMaybeAdvance(BASE_ARGS);

    expect(service.correctHandoff).not.toHaveBeenCalled();
    expect(oracleReview.reviewStepDraft).toHaveBeenCalledTimes(1); // no recursive call
    expect(outcome).toEqual({ reviewed: true, advanced: false, concernCount: 1 });
  });

  it('escalates without recursing when correctHandoff itself throws', async () => {
    const unresolvedObjection = {
      id: 'obj-1',
      stageHandoffId: 'handoff-1',
      raisedByRole: 'Risk',
      text: 'the scope looks unbounded',
      raisedAt: '2026-01-01T00:00:00.000Z',
      resolution: null,
    };
    oracleReview.reviewStepDraft.mockResolvedValueOnce(oneConcern('Risk'));
    service.createObjection.mockResolvedValueOnce({ objections: [unresolvedObjection] });
    oracleReview.reconcileConcerns.mockResolvedValueOnce({
      status: 'ok',
      resolutions: [{ role: 'Risk', resolved: false, rationale: 'still needs a human' }],
    });
    service.getMissionDetail.mockResolvedValueOnce(
      missionDetail({ objections: [unresolvedObjection] }),
    );
    aiDraft.draftStepOutput.mockResolvedValueOnce({
      status: 'ok',
      draft: { payload: { summary: 'v2' }, confidence: 0.9, missingEvidence: [] },
    });
    service.correctHandoff.mockRejectedValueOnce(new Error('FORGE_HANDOFF_NOT_FOUND'));

    const outcome = await reviewAndMaybeAdvance(BASE_ARGS);

    expect(oracleReview.reviewStepDraft).toHaveBeenCalledTimes(1); // no recursive call
    expect(outcome).toEqual({ reviewed: true, advanced: false, concernCount: 1 });
  });
});
