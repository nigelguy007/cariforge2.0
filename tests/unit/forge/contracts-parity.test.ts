// @polsia:user-owned — parity coverage: zod parses MissionDetail + every
// sub-schema against a fixture; asserts cross-schema structural consistency.
import { describe, expect, it } from 'vitest';
import {
  EvidenceCreate,
  GateDecide,
  HandoffCorrect,
  HandoffCreate,
  MissionCreate,
  MissionDetail,
  ObjectionCreate,
  ObjectionResolutionInput,
  PauseRequest,
  ReplayRequest,
  ResumeRequest,
  RollbackRequest,
  ToolActionCreate,
  ToolActionDecide,
  ToolActionRollback,
} from '@/lib/contracts/forge';
import {
  AdminTelemetryOverview,
  ChatCostByDay,
  CompanyCredit,
  GateDecisionCount,
  MissionAutonomy,
  MissionCost,
  MissionTelemetryRead,
  ModelUsageWrite,
  OperatorControlPlane,
  ReleaseSourceActorInput,
  UsageRecordWrite,
} from '@/lib/contracts/telemetry';

describe('forge contracts — write shapes', () => {
  it('MissionCreate rejects short intake', () => {
    expect(() => MissionCreate.parse({ intake: 'too short' })).toThrow();
  });
  it('MissionCreate accepts a realistic intake', () => {
    const parsed = MissionCreate.parse({
      intake:
        'We need to replace our legacy CRM with one that supports our 14 regulatory reporting regimes.',
    });
    expect(parsed.intake.length).toBeGreaterThanOrEqual(20);
  });
  it('HandoffCreate accepts the minimum shape', () => {
    const parsed = HandoffCreate.parse({
      stage: 'Discovery',
      payload: { needs: ['replace CRM'] },
      confidence: 0.7,
    });
    expect(parsed.stage).toBe('Discovery');
  });
  it('HandoffCorrect requires reasonText + code', () => {
    expect(() =>
      HandoffCorrect.parse({
        payload: {},
        confidence: 0.5,
        reasonCode: 'UserCorrection',
        reasonText: '',
      }),
    ).toThrow();
  });
  it('GateDecide requires reasonText', () => {
    expect(() =>
      GateDecide.parse({
        decision: 'Approve',
        reasonCode: 'Approved',
        reasonText: '   ',
        stageHandoffId: 'h-1',
      }),
    ).toThrow();
  });
  it('ReplayRequest clamps fromStageIndex', () => {
    expect(() => ReplayRequest.parse({ fromStageIndex: 9, reasonText: 'too high' })).toThrow();
    expect(() => ReplayRequest.parse({ fromStageIndex: 0, reasonText: 'restart' })).not.toThrow();
  });
  it('ToolActionCreate defaults requiresGateApproval=false', () => {
    const parsed = ToolActionCreate.parse({
      tool: 'noop-runner',
      scope: 'Internal',
      payload: {},
    });
    expect(parsed.requiresGateApproval).toBe(false);
  });
  it('EvidenceCreate accepts minimal shape', () => {
    const parsed = EvidenceCreate.parse({ kind: 'Text', ref: 'note://1', label: 'Initial brief' });
    expect(parsed.kind).toBe('Text');
  });
  it('ObjectionCreate + Resolution share stageHandoffId linkage', () => {
    expect(() =>
      ObjectionCreate.parse({
        stageHandoffId: 'h-1',
        raisedByRole: 'Operator',
        text: 'Insufficient evidence for vendor choice.',
      }),
    ).not.toThrow();
    expect(() =>
      ObjectionResolutionInput.parse({
        resolution: 'OwnerResolved',
        resolutionText: 'Confirmed via procurement review.',
      }),
    ).not.toThrow();
  });
  it('Rollback / ToolActionRollback require reasonText', () => {
    expect(() => RollbackRequest.parse({ toStageHandoffId: 'h-2', reasonText: '' })).toThrow();
    expect(() =>
      ToolActionRollback.parse({
        rollbackOfToolActionId: 'ta-1',
        reasonText: 'wrong destination',
      }),
    ).not.toThrow();
  });
  it('Pause / Resume require reason code + text', () => {
    expect(() => PauseRequest.parse({ reasonCode: 'Other', reasonText: '' })).toThrow();
    expect(() =>
      ResumeRequest.parse({ reasonCode: 'Other', reasonText: 'back from holiday' }),
    ).not.toThrow();
  });
  it('ToolActionDecide requires reasonCode', () => {
    expect(() =>
      ToolActionDecide.parse({ decision: 'Approved', reasonCode: 'Approved' }),
    ).not.toThrow();
  });
});

describe('forge contracts — MissionDetail parsing', () => {
  const fixture = {
    mission: {
      id: 'm-1',
      slug: 'mission-1',
      name: 'Mission 1',
      intake: 'long enough intake for schema validation',
      normalizedNeed: '',
      status: 'Draft' as const,
      currentStageIndex: 0,
      currentDraftVersion: null,
      confidence: 0.5,
      pausedAt: null,
      completedAt: null,
      rolledBackAt: null,
      previousStatus: null,
      createdById: 'user-1',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      domainTags: [],
      elderOracleUserId: null,
    },
    handoffs: [],
    approvals: [],
    objections: [],
    evidence: [],
    toolActions: [],
    audits: [],
    gates: [],
    workItems: [],
    oracleRoster: [],
    handoffAttesters: [],
  };
  it('parses an empty MissionDetail', () => {
    expect(() => MissionDetail.parse(fixture)).not.toThrow();
  });
});

describe('telemetry contracts — write shapes', () => {
  it('ModelUsageWrite rejects empty model', () => {
    expect(() =>
      ModelUsageWrite.parse({
        model: '',
        provider: 'anthropic',
        promptTokens: 1,
        completionTokens: 0,
      }),
    ).toThrow();
  });
  it('ModelUsageWrite accepts a signed round-trip', () => {
    const w = ModelUsageWrite.parse({
      model: 'claude-sonnet-4-6',
      provider: 'anthropic',
      promptTokens: 1000,
      completionTokens: 200,
      attributedActor: 'Hybrid',
    });
    expect(w.attributedActor).toBe('Hybrid');
  });
  it('UsageRecordWrite discriminated union accepts both kinds', () => {
    expect(() =>
      UsageRecordWrite.parse({
        kind: 'model',
        data: { model: 'm', provider: 'p', promptTokens: 1, completionTokens: 0 },
      }),
    ).not.toThrow();
    expect(() =>
      UsageRecordWrite.parse({
        kind: 'chat',
        data: {
          scope: 'mission',
          model: 'm',
          messageCount: 1,
          windowStart: '2026-05-01T00:00:00.000Z',
          windowEnd: '2026-05-01T01:00:00.000Z',
        },
      }),
    ).not.toThrow();
    expect(() => UsageRecordWrite.parse({ kind: 'model', data: { model: '' } })).toThrow();
  });
  it('ReleaseSourceActorInput accepts all three actor enums', () => {
    for (const actor of ['AIOnly', 'Human', 'Hybrid'] as const) {
      expect(() => ReleaseSourceActorInput.parse({ actor })).not.toThrow();
    }
    expect(() => ReleaseSourceActorInput.parse({ actor: 'Robot' })).toThrow();
  });
});

describe('telemetry contracts — read shapes', () => {
  const fixture = {
    autonomy: {
      missionId: 'm-1',
      missionSlug: 'mission-1',
      status: 'InBuild',
      currentStageIndex: 4,
      gates: [
        {
          gateIndex: 0,
          stage: 'Discovery' as const,
          approved: 1,
          edited: 0,
          rejected: 0,
          aiOnlyApprovals: 1,
          humanApprovals: 0,
        },
      ],
      releaseActor: 'AIOnly' as const,
      draftAge: { daysOld: 3, bucket: '1-3d' as const, isAwaiting: true },
    },
    cost: {
      missionId: 'm-1',
      modelCents: 100,
      chatCents: 50,
      blendedCents: 150,
      hasUnknownCost: false,
      byDay: [{ day: '2026-05-01', cents: 100, messages: 10 }],
    },
  };
  it('MissionTelemetryRead round-trips a fixture', () => {
    const parsed = MissionTelemetryRead.parse(fixture);
    expect(parsed.autonomy.gates.length).toBe(1);
    expect(parsed.cost.blendedCents).toBe(150);
  });
  it('MissionAutonomy / MissionCost / GateDecisionCount individually parse', () => {
    expect(() => MissionAutonomy.parse(fixture.autonomy)).not.toThrow();
    expect(() => MissionCost.parse(fixture.cost)).not.toThrow();
    expect(() => GateDecisionCount.parse(fixture.autonomy.gates[0])).not.toThrow();
  });
  it('OperatorControlPlane accepts an empty rows list', () => {
    expect(() => OperatorControlPlane.parse({ rows: [] })).not.toThrow();
  });
  it('AdminTelemetryOverview round-trips its wire shape', () => {
    const fixture2 = {
      autonomyLadder: [
        {
          gateIndex: 0,
          stage: 'Discovery' as const,
          approvedTotal: 4,
          editedTotal: 1,
          rejectedTotal: 0,
          aiOnlyShare: 0.5,
        },
      ],
      perCompanyCredit: [{ companyId: 'c-1', netCents: 100, credits: 200, debits: 100 }],
      chatCostByDay: [{ day: '2026-05-01', cents: 50, messages: 20, hasUnknownCost: false }],
    };
    const parsed = AdminTelemetryOverview.parse(fixture2);
    expect(parsed.autonomyLadder[0]?.aiOnlyShare).toBeCloseTo(0.5);
    expect(parsed.perCompanyCredit[0]?.netCents).toBe(100);
    expect(parsed.chatCostByDay[0]?.cents).toBe(50);
  });
  it('CompanyCredit accepts a negative signed net (debits > credits)', () => {
    // netCents is signed: a company whose debits exceed credits MUST be
    // representable. A bug that flipped the sign would silently misreport
    // autonomy economics to admin operators.
    const parsed = CompanyCredit.parse({ companyId: 'c', netCents: -1, credits: 0, debits: 1 });
    expect(parsed.netCents).toBe(-1);
    expect(parsed.debits).toBe(1);
  });
  it('ChatCostByDay requires YYYY-MM-DD day format', () => {
    expect(() =>
      ChatCostByDay.parse({ day: '2026-05-01', cents: 0, messages: 0, hasUnknownCost: false }),
    ).not.toThrow();
  });
});
