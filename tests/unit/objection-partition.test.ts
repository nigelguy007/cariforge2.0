// @polsia:user-owned — real user report (2026-09-05, live screenshots):
// "it says there are 3 outstanding concerns unresolved .. yet the system
// says they are resolved". The Concerns list used to render every
// objection ever raised on the mission — across every past draft version
// of every step — as one flat, undifferentiated pile. partitionObjections
// (supporting-detail.tsx) splits objections into "current" (attached to
// a still-live, non-superseded handoff) and "historical" (attached to a
// handoff that's since been redrafted away), so it's unambiguous which
// ones are actually still open.
import { describe, expect, it } from 'vitest';
import { partitionObjections } from '@/components/custom/app/supporting-detail';
import {
  type HandoffItemT,
  MissionDetail,
  type MissionDetailT,
  type ObjectionItemT,
  StageNameValues,
} from '@/lib/contracts/forge';

const T0 = '2026-09-05T10:00:00.000Z';

function handoff(over: Partial<HandoffItemT> = {}): HandoffItemT {
  return {
    id: 'h1',
    stage: 'Discovery',
    version: 1,
    parentVersionId: null,
    correctionOfId: null,
    supersededById: null,
    replayOfMissionId: null,
    invalidationReasonCode: null,
    confidence: 0.5,
    gateIndexThatApproves: 0,
    payload: { summary: 'Draft.' },
    missingEvidence: [],
    toolRefs: [],
    producedByToolActionId: null,
    createdById: 'u1',
    createdAt: T0,
    ...over,
  };
}

function objection(over: Partial<ObjectionItemT> = {}): ObjectionItemT {
  return {
    id: 'o1',
    stageHandoffId: 'h1',
    raisedByRole: 'Growth',
    text: 'No target user defined.',
    evidenceRefId: null,
    raisedAt: T0,
    resolution: null,
    resolutionText: null,
    ...over,
  };
}

function detail(over: Partial<MissionDetailT> = {}): MissionDetailT {
  return MissionDetail.parse({
    mission: {
      id: 'm1',
      slug: 'tourism-ai-adoption',
      name: 'Tourism AI adoption',
      status: 'InDiscovery',
      currentStageIndex: 0,
      confidence: 0.2,
      createdAt: T0,
      updatedAt: T0,
      domainTags: [],
      elderOracleUserId: null,
      intake: 'Tourism AI adoption to use AI to book flights, hotels, travel.',
      normalizedNeed: '',
      currentDraftVersion: 2,
      pausedAt: null,
      completedAt: null,
      rolledBackAt: null,
      previousStatus: null,
      createdById: 'u1',
    },
    handoffs: [],
    approvals: [],
    objections: [],
    evidence: [],
    toolActions: [],
    audits: [],
    gates: StageNameValues.map((stage, gateIndex) => ({
      missionId: 'm1',
      gateIndex,
      stage,
      state: 'Awaiting',
      currentStageHandoffId: null,
      currentHandoffVersion: null,
      lastApprovalId: null,
      allowedReasonCodes: ['Approved'],
    })),
    workItems: [],
    oracleRoster: [],
    handoffAttesters: [],
    ...over,
  });
}

describe('partitionObjections', () => {
  it('puts an objection on the live (non-superseded) handoff in "current"', () => {
    const d = detail({
      handoffs: [handoff({ id: 'h1', supersededById: null })],
      objections: [objection({ id: 'o1', stageHandoffId: 'h1' })],
    });
    const { current, historical } = partitionObjections(d);
    expect(current.map((o) => o.id)).toEqual(['o1']);
    expect(historical).toEqual([]);
  });

  it('puts an objection on a superseded (redrafted-away) handoff in "historical", even if still unresolved', () => {
    const d = detail({
      handoffs: [
        handoff({ id: 'h1', version: 1, supersededById: 'h2' }),
        handoff({ id: 'h2', version: 2, supersededById: null }),
      ],
      // The exact bug: an objection left with resolution: null on a
      // handoff that's since been superseded — before the fix in
      // service.ts's carryForwardStaleObjections, this would sit here
      // forever, permanently counted as an "outstanding concern" by
      // nextActionFor even though h1 is no longer the live draft.
      objections: [objection({ id: 'stale', stageHandoffId: 'h1', resolution: null })],
    });
    const { current, historical } = partitionObjections(d);
    expect(current).toEqual([]);
    expect(historical.map((o) => o.id)).toEqual(['stale']);
  });

  it('puts an objection on an INVALIDATED (not superseded) downstream handoff in "historical" too', () => {
    // Real user report (2026-09-05): "all say resolution closed yet
    // showing 3 unresolved concerns" — after a redraft/replay/rollback,
    // downstream stage handoffs get invalidationReasonCode set but
    // supersededById stays null (they weren't replaced, just marked
    // stale). Their own objections need the same "not current" treatment
    // or they're invisible next to the step someone's actually redrafted,
    // yet still permanently block the mission.
    const d = detail({
      handoffs: [handoff({ id: 'h1', invalidationReasonCode: 'StaleInformation' })],
      objections: [objection({ id: 'stale-downstream', stageHandoffId: 'h1', resolution: null })],
    });
    const { current, historical } = partitionObjections(d);
    expect(current).toEqual([]);
    expect(historical.map((o) => o.id)).toEqual(['stale-downstream']);
  });

  it('separates a real mixed history: resolved-on-old-drafts vs genuinely open on the current one', () => {
    const d = detail({
      handoffs: [
        handoff({ id: 'h1', version: 1, supersededById: 'h2' }),
        handoff({ id: 'h2', version: 2, supersededById: null }),
      ],
      objections: [
        objection({
          id: 'old-resolved',
          stageHandoffId: 'h1',
          raisedByRole: 'Demand',
          resolution: 'OwnerResolved',
          resolutionText: 'Addressed in the redraft.',
        }),
        objection({ id: 'new-open-1', stageHandoffId: 'h2', raisedByRole: 'Growth' }),
        objection({ id: 'new-open-2', stageHandoffId: 'h2', raisedByRole: 'Competition' }),
      ],
    });
    const { current, historical } = partitionObjections(d);
    expect(current.map((o) => o.id).sort()).toEqual(['new-open-1', 'new-open-2']);
    expect(historical.map((o) => o.id)).toEqual(['old-resolved']);
  });
});
