import { describe, expect, it } from 'vitest';

import { SampleBrief } from '../../src/lib/contracts/sample-brief';

function atOrFail<T>(arr: T[], index: number): T {
  const value = arr[index];
  if (value === undefined) {
    throw new Error(`expected element at index ${index}`);
  }
  return value;
}

describe('sample-brief contract', () => {
  const payload = SampleBrief.parse({
    productionDisclaimer:
      'Editorial worked example — fixture for tests/unit/sample-brief-contract.test.ts.',
    brief: {
      industry: 'Insurance — non-life property claims, EU regulated.',
      problemStatement:
        'A 14-person claims department receives roughly 3,200 new property claims per month and wants to triage them faster without lowering the fraud-detection rate.',
      proposedApproach:
        'An internal triage tool returns a per-claim recommendation; a named human-in-the-loop workflow is the only path to a final disposition.',
      evidence: [
        '3,200 inbound property claims per month, dashboard-verified.',
        'Median time-to-first-action 9 calendar days (FY 2025).',
        'A named SIU fraud-detection rate of 7.4% for 2025.',
        'A 12-week pilot on a 320-claim holdout with 88% agreement on disposition.',
        'Named stakeholders: A. Maréchale, K. Holzapfel, L. Caulfield, J. Vargas, E. Okwuosa.',
      ],
      mustNotHappen: [
        'No auto-deny.',
        'No auto-pay.',
        'No third-party data enrichment.',
        'No skip-the-human on flagged claims.',
      ],
    },
    council: [
      {
        role: 'Risk',
        roleLong: 'Risk agent',
        stance: 'Objection',
        objection:
          'The proposed workflow lacks structural separation between the model’s stance and the officer’s click — risk of a rubber-stamp Article 22 posture.',
        evidenceAskedFor:
          'A named human-only assertion step with the officer’s typed reason, recorded per claim.',
      },
      {
        role: 'Demand',
        roleLong: 'Demand agent',
        stance: 'Supports',
        objection:
          'Evidence is corroborated by the dashboard and the named pilot; the only narrow gap is a regime-by-regime median split.',
        evidenceAskedFor: 'A regime-by-regime share of the 3,200 monthly volume.',
      },
      {
        role: 'Growth',
        roleLong: 'Growth agent',
        stance: 'Qualifies',
        objection:
          'The run is a wedge for the renewals evidence-packs pipeline and the broker-onboarding KYC pipeline, and the buyer has not been told.',
        evidenceAskedFor:
          'A typed note identifying the next two pipelines and their reuse percentage from this build.',
      },
      {
        role: 'Competition',
        roleLong: 'Competition agent',
        stance: 'Objection',
        objection:
          'FRISS, Shift, and Guidewire ClaimCenter cover a claims-triage shape; the brief must name them and state the build case against a buy case.',
        evidenceAskedFor:
          'A typed, named-tool comparison statement on the case file (which of FRISS / Shift / Guidewire ClaimCenter / internal-only is selected and why).',
      },
      {
        role: 'Money',
        roleLong: 'Money agent',
        stance: 'Qualifies',
        objection:
          'Unit economics must not regress to "the model will improve" — the cost model stands at the present-day 88% pilot agreement rate, with the 12% disagreement bucket costed as human review.',
        evidenceAskedFor:
          'A typed statement that the per-claim cost is built against the present-day 88% agreement rate, not against an aspirational future rate.',
      },
    ],
    ruling: {
      verdict: 'Build',
      reconciliation:
        'The chair sides with Risk (named human-only assertion step wired into the workflow by structure) and with Growth (typed note to the buyer on the renewals + broker-onboarding reuse). The case advances to the Software Build with both items carried forward as binding constraints.',
      carriedDissent: [
        'Risk objection carried forward as a binding design constraint on the Workflow Design stage, re-read at the Governance Check stage.',
        'Growth qualification carried forward as a typed note to the buyer for a signed scope decision during workflow design.',
      ],
    },
    stages: [
      {
        agentOrdinal: 1,
        agentName: 'Need Discovery',
        inputFromPrevious:
          'The verbatim brief, the oracles’ debate, and the Elder Oracle’s reconciled ruling.',
        output: 'A one-page problem statement card with the four must-not-happen clauses.',
        downstreamHandoff: 'Problem statement card handed to the Readiness Review stage.',
        supervisor: {
          name: 'A. Maréchale',
          role: 'Head of Claims Operations',
          decision: 'Approve',
          typedReason: 'The problem statement card matches the inbound brief verbatim.',
          signedAt: '2026-04-02T09:14:00Z',
        },
      },
      {
        agentOrdinal: 2,
        agentName: 'Readiness Review',
        inputFromPrevious:
          'Problem statement card, four must-not-happen clauses, and the named buyer approver.',
        output:
          'A data + regulatory regime audit table for IE / FR / DE with a named-tool comparison statement.',
        downstreamHandoff:
          'Audit table and named comparison statement handed to the Workflow Design stage.',
        supervisor: {
          name: 'L. Caulfield',
          role: 'Data Protection Officer',
          decision: 'Approve',
          typedReason:
            'In-scope data sources are consistent with the named data minimisation clause.',
          signedAt: '2026-04-09T11:42:00Z',
        },
      },
      {
        agentOrdinal: 3,
        agentName: 'Workflow Design',
        inputFromPrevious:
          'Audit table, named comparison statement, DPO sign-off, and the carry-forward items.',
        output:
          'A role/escalation diagram with the two-step human-only assertion (Risk binding constraint) and per-regime SLAs.',
        downstreamHandoff:
          'Role/escalation diagram and per-regime SLAs handed to the Governance Check stage.',
        supervisor: {
          name: 'K. Holzapfel',
          role: 'Head of Special Investigations Unit (SIU)',
          decision: 'Approve',
          typedReason:
            'The mandatory SIU referral gate is preserved and the 88% cost basis is named.',
          signedAt: '2026-04-22T14:08:00Z',
        },
      },
      {
        agentOrdinal: 4,
        agentName: 'Governance Check',
        inputFromPrevious:
          'Role/escalation diagram, per-regime SLAs, DPO sign-off, and the four must-not-happen clauses.',
        output:
          'A logging/oversight control matrix mapping every must-not-happen to a runtime check and an immutable hash chain.',
        downstreamHandoff:
          'Control matrix handed to the Software Build stage as the binding audit-trail spec.',
        supervisor: {
          name: 'E. Okwuosa',
          role: 'Group Chief Risk Officer',
          decision: 'Approve',
          typedReason:
            'The control matrix closes the Article 12 logging loop with a runtime check per must-not-happen.',
          signedAt: '2026-05-08T10:30:00Z',
        },
      },
      {
        agentOrdinal: 5,
        agentName: 'AI Build',
        inputFromPrevious:
          'Logging/oversight control matrix, role/escalation diagram, per-regime SLAs, must-not-happen clauses, DPO sign-off.',
        output:
          'A per-claim review queue at /claims/queue with route handlers POST /api/claims/[id]/review and POST /api/claims/[id]/refer-siu, backed by the ClaimsAuditTrail prisma model.',
        downstreamHandoff:
          'Runnable build delivered by Agent 5 (AI Build) operating Stage 5 (Software Build); audit-trail receipt attached.',
        supervisor: {
          name: 'J. Vargas',
          role: 'Group Chief Information Officer',
          decision: 'Approve',
          typedReason:
            'The build matches the Governance Check control matrix one-to-one, with append-only audit trail.',
          signedAt: '2026-05-21T16:55:00Z',
        },
      },
    ],
    solution: {
      component: 'Per-claim review queue',
      route: '/claims/queue',
      dataPlane: [
        'GET /api/claims/queue — claims officer inbox',
        'POST /api/claims/[id]/review — two-step human-only assertion + advance',
        'POST /api/claims/[id]/refer-siu — SIU referral gate',
        'ClaimsAuditTrail prisma model — append-only, hash-chained',
      ],
      mechanic: 'Human-in-the-loop approve / request-info / refer-to-SIU; append-only audit trail.',
    },
    runMetadata: {
      caseId: 'CARIFORGE-EU-CLAIMS-2026-Q2-014',
      buyerOrg: 'A regulated European non-life insurer (IE / FR / DE operations; EIOPA-supervised)',
      submittedOn: '2026-03-26',
      closedOn: '2026-05-22',
      reviewer: 'E. Okwuosa, Group Chief Risk Officer',
    },
  });

  it('parses a complete worked-example payload', () => {
    expect(payload.brief.industry).toMatch(/Insurance/);
    expect(payload.ruling.verdict).toBe('Build');
    expect(payload.solution.route).toBe('/claims/queue');
  });

  it('has exactly five advisor objections, one per canonical role', () => {
    expect(payload.council).toHaveLength(5);
    const roles = payload.council.map((o) => o.role);
    expect(roles).toEqual(['Risk', 'Demand', 'Growth', 'Competition', 'Money']);
  });

  it('has exactly five stages — one per Agent 1 through 5', () => {
    expect(payload.stages).toHaveLength(5);
    const ordinals = payload.stages.map((s) => s.agentOrdinal);
    expect(ordinals).toEqual([1, 2, 3, 4, 5]);
  });

  it('every stage carries a named supervisor with a typed reason attached', () => {
    for (const stage of payload.stages) {
      expect(stage.supervisor.name.length).toBeGreaterThan(0);
      expect(stage.supervisor.role.length).toBeGreaterThan(0);
      expect(stage.supervisor.typedReason.length).toBeGreaterThan(0);
      expect(stage.supervisor.decision).toBe('Approve');
      expect(stage.supervisor.signedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    }
  });

  it('Agent 5 (AI Build) operates Stage 5 (Software Build) and ships a route handler plus a prisma data model', () => {
    const build = atOrFail(payload.stages, 4);
    const surfaceText = `${build.output} ${build.downstreamHandoff} ${payload.solution.dataPlane.join(' ')}`;
    expect(build.agentName).toBe('AI Build');
    expect(surfaceText).toMatch(/\/api\/claims\//);
    expect(surfaceText).toMatch(/ClaimsAuditTrail|claimsAuditTrail|prisma/);
  });

  it('Agent 5 is named AI Build, not Software Build', () => {
    const build = atOrFail(payload.stages, 4);
    expect(build.agentName).toBe('AI Build');
    expect(build.agentName).not.toBe('Software Build');
  });

  it('Stage 5 of the 5-stage pipeline is still referenced by the stage name "Software Build"', () => {
    const build = atOrFail(payload.stages, 4);
    const combined = `${build.output} ${build.downstreamHandoff} ${build.supervisor.typedReason}`;
    expect(combined).toMatch(/Software Build|SoftwareBuild/);
  });

  it('exactly five stages (one per Agent 1..5) and Agent 5 is the AI Build agent', () => {
    expect(payload.stages).toHaveLength(5);
    expect(payload.stages[4]?.agentName).toBe('AI Build');
    expect(payload.stages.map((s) => s.agentOrdinal).join(',')).toBe('1,2,3,4,5');
  });

  it('the chairman’s ruling carries at least one carry-forward dissent (no silent drop)', () => {
    expect(payload.ruling.carriedDissent.length).toBeGreaterThanOrEqual(1);
  });
});
