// @polsia:user-owned — static dataset for the /sample-brief worked-example
// page. Server-only: imported by /api/sample-brief/route.ts, which parses it
// through the shared SampleBrief contract. Holds the editorial narrative of
// one complete CARI Forge run — a regulated European insurer's claims-triage
// brief, the council debate on it, the chairman's reconciled ruling, the
// five-stage pipeline of stage handoffs operated by the seven-agent core
// (Agents 1..5 run Stages 1..5; Agent 5 is "AI Build", not "Software Build",
// because "Software Build" is the name of the stage AI Build operates; Agents
// 6..7 — Partner and Impact — wrap around delivery), and Agent 5's working
// solution at the end. The worked example exercises every domain token
// in the contract; no DB, no live AI call.

import 'server-only';

import type { SampleBrief } from '@/lib/contracts/sample-brief';

export const SAMPLE_BRIEF: SampleBrief = {
  productionDisclaimer:
    'Editorial worked example. Nothing here runs in production. The CouncilRun, audit-trail model, and claims/queue route handlers are described — they are not deployed for this URL. The hand-off is the case file at the bottom.',
  brief: {
    industry:
      'Insurance — non-life property claims, EU regulated. Buyer operates across IE, FR, DE under EIOPA supervision; GDPR + Solvency II reporting in scope.',
    problemStatement:
      'A 14-person claims department receives roughly 3,200 new property claims per month from brokers and policyholders (storm, escape of water, fire, theft). Today every claim is read end to end by a claims officer before any payment decision is taken — median time-to-first-action is 9 calendar days, and the team is forecast to be 1.6 FTE short by Q4. We want to triage claims faster (median time-to-first-action of 4 calendar days, with no measurable drop in the fraud-detection rate of 7.4% reported by our internal SIU for 2025) while preserving the same statutory pay-out clocks under each national regime.',
    proposedApproach:
      'An internal triage tool that reads each incoming claim packet alongside the policy schedule and the prior-claims history, returns a recommendation (Standard / Flag / Refer to SIU) per claim with the supporting evidence highlighted, and writes the recommendation back into the claims system as a draft disposition for a human claims officer to act on. The human-in-the-loop approve / request-info / refer-to-SIU workflow is the only path to a final disposition — the model cannot auto-deny, auto-pay, or write a final disposition without a named officer click.',
    evidence: [
      'Average 3,180 inbound property claims per month across IE/FR/DE, Aug 2024 – Jul 2025 (10/12 months within ±8% of the 3,200 forecast).',
      'Median time-to-first-action 9 calendar days (source: claims ops dashboard, FY 2025), with the long-tail driven by a backlog of packets over 14 days old.',
      'Internal SIU fraud-detection rate of 7.4% reported for 2025, against a peer benchmark of 6.9–8.1% across ESBG non-life co-operative insurers.',
      'A 12-week pilot on a 320-claim holdout (May–Jul 2025) where the recommendation distribution matched the SIU retrospective at 88% agreement on disposition; the 12% disagreement bucket was the SIU retraining target.',
      'Named stakeholders: A. Maréchale (Head of Claims Operations), K. Holzapfel (Head of SIU), L. Caulfield (DPO), J. Vargas (Group CIO), and E. Okwuosa (Group Chief Risk Officer).',
    ],
    mustNotHappen: [
      'The model may never auto-deny a claim, auto-pay a claim, or close a claim file. A named claims officer must click the final disposition, every time, on every claim.',
      'The model must never be the only reviewer of a claim flagged for fraud, regulatory referral, or vulnerable-policyholder status. SIU + Compliance + the named officer remain in the loop, with their roles preserved.',
      'No personal data beyond what is already in the policy schedule and the inbound claim packet may be used as model input; no third-party data brokers, no social-media signals, no open-web enrichment.',
      'Every model call on a claim must be logged with the input artefact hash, the model version, the recommendation, the named officer who acted, and the action timestamp — append-only, immutable to the claims officer who took the action.',
      'The system may never remove, downgrade, or skip the existing EIOPA/Solvency II reporting, claims-handover, or vulnerable-customer controls. The triage tool sits beside them, not over them.',
    ],
  },

  council: [
    {
      role: 'Risk',
      roleLong: 'Risk agent',
      stance: 'Objection',
      objection:
        'The "model cannot auto-deny" guard-rail reads correctly on paper but is not enforced in the proposed approach — the proposed workflow lets the model write the recommendation back into the claims system as the draft disposition, with no separation between the model’s stance and the officer’s click. Under GDPR Article 22 + EIOPA model-risk guidance, a regulated decision is one where the automated signal materially drives the outcome even if a human click is required as a rubber-stamp. The must-not-happen list must be re-cast so that the system’s default action on a "Refer to SIU" recommendation is a hard refusal to advance until a human has reviewed the pack, not a recommendation the officer can confirm with a single click.',
      evidenceAskedFor:
        'A separate, named human-only assertion step in the workflow — the model’s recommendation cannot be acted on until that assertion is recorded with the officer’s typed reason; an explicit list of what is a "rubber-stamp" action vs. a "reviewed and confirmed" action; and a model-risk logging spec that captures the input pack hash, the model version, the recommendation, and the named officer per claim, append-only.',
    },
    {
      role: 'Demand',
      roleLong: 'Demand agent',
      stance: 'Supports',
      objection:
        'The 3,200 monthly-claim and 9-day median figures are corroborated by the named claims dashboard and the SIU retrospective, and the 12-week 320-claim pilot agreement rate (88% on disposition) gives the run enough signal to start. The objection is narrow: the buyer’s own named-claim-stack split (broker-submitted vs. policyholder-submitted) and the median pilot volume split between IE / FR / DE are not stated, so the dashboard the brief points at does not on its own prove that the 4-day median time-to-first-action budget is achievable across all three regimes simultaneously. We will not block the run on this, but Demand requires the readiness-stage output to include a regime-by-regime shares table before the workflow design can lock the SLAs.',
      evidenceAskedFor:
        'A regime-by-regime split of the 3,200 monthly-claim volume (IE / FR / DE share, broker- vs. policyholder-submitted share) attached to the readiness-stage output, against the 4-day target, so the workflow design can state the SLA per regime.',
    },
    {
      role: 'Growth',
      roleLong: 'Growth agent',
      stance: 'Qualifies',
      objection:
        'The brief names a downstream capability that is real but undersold — the same triage-shape runs against the broker onboarding pipeline (new-broker KYC packets), the renewals pipeline (policyholder renewal evidence packs), and the SIU retrospective already in place. The objection is that the brief’s "faster triage" framing is a one-off ask that ends at the Software Build, and the buyer has not asked whether the same loop would unlock the renewals queue, the broker queue, or the SIU retrospective automation. This is not a blocker. The build case still stands. But the buyer should be told — during the workflow design stage, not after delivery — that the first run is the wedge and that the next two pipelines reuse the same audit-trail shape with a different input schema.',
      evidenceAskedFor:
        'A short typed note attached to the workflow design stage by the Workflow agent identifying the two next-pipeline candidates (renewals evidence packs, broker onboarding KYC) and what reuse percentage they would carry from the claims-triage build, so the buyer can decide whether to scope them in or out of this run.',
    },
    {
      role: 'Competition',
      roleLong: 'Competition agent',
      stance: 'Objection',
      objection:
        'A credible off-the-shelf tool already exists: FRISS (FRISS Insurance), Shift Technology (Shift Claims), and Guidewire ClaimCenter each cover a claims-triage shape for non-life property — FRISS and Shift in particular ship a fraud-detection signal at the disposition step that the buyer already licenses for a different line. The objection is that the proposed approach does not name these tools, does not name why they are not being bought, and does not state the build case against a buy case. The buyer must state, by name, whether FRISS or Shift is in scope of an existing or near-term licence, and what the forge is being asked to add on top — typically the EIOPA-ready audit-trail + human-in-the-loop approval shape that the off-the-shelf tools do not ship out of the box for a 3-country single-pipeline deployment. Without that statement by name, the build case rests on claim rather than evidence.',
      evidenceAskedFor:
        'A typed, named, comparison statement attached to the readiness-stage output: which of FRISS / Shift / Guidewire ClaimCenter / an internal-only build is selected, why, and what features the forge is adding on top of (or instead of) the off-the-shelf tool — written to the case file, not buried in a slide deck.',
    },
    {
      role: 'Money',
      roleLong: 'Money agent',
      stance: 'Qualifies',
      objection:
        'The unit economics are good enough to start, with one regress-to-future caveat. The case as presented depends on absolute variance with no margin of safety: the 4-day median target depends on the 88% pilot agreement rate holding at production scale, on the named claims staff staying at 14 (no further attrition), and on the EIOPA reporting overhead staying flat. The objection is that the unit economics must not regress to "the model will get better at agreement over time" or "the team will grow into the tool" — the 88% agreement rate is a snapshot, and the unit case must hold at the present-day 88%, not at an aspirational 92%. The case is to be stated at the present-day 88% agreement rate, with the additional 4% disagreement bucket costed as ongoing human review time, not as a future model improvement line item.',
      evidenceAskedFor:
        'A typed statement attached to the workflow design stage that the per-claim cost model is built against the present-day 88% pilot agreement rate and that the 12% disagreement bucket is costed as human review, not as a future-model improvement line. The Money agent returns the case if the model regresses to "the model will improve" framing.',
    },
  ],

  ruling: {
    verdict: 'Build',
    reconciliation:
      'Two of the five advisors land on a contested point — Risk’s objection that the proposed approach lacks the separation between the model’s recommendation and the officer’s click, and Growth’s qualification that the buyer has not been told the run is a wedge for the renewals and broker-onboarding pipelines. These are not the same shape of objection and the chair rules on them separately. On the Risk objection: the Elder Oracle sides with Risk. The workflow design stage must include a named human-only assertion step with a typed reason recorded per claim, distinct from the model’s recommendation, so that a click to advance is recorded as a reviewed and confirmed action and not a rubber-stamp action. The cost of compliance here is small (one workflow column, one append-only log row per claim) and the cost of non-compliance is a mis-aligned Article 22 posture that the buyer cannot justify. On the Growth qualification: the Elder Oracle sides with Growth. The growth case is real and must be surfaced to the buyer during the workflow design stage by way of a typed note — not as a scoping change to this run, but as an honest statement of what the build unlocks. The case advances to the Software Build with the Risk objection carried forward as a binding design constraint on the workflow design stage, and the Growth statement carried forward as a typed note to the buyer.',
    carriedDissent: [
      'Risk objection (carried into the Workflow Design and Governance Check stages): the workflow must enforce — by structure, not by policy — that a Flag / Refer-to-SIU recommendation cannot be acted on until a named officer has reviewed the pack and recorded a typed reason. The Elder Oracle did not overrule this objection; it is binding on the Workflow Design stage and re-read at the Governance Check stage.',
      'Growth qualification (carried into the Workflow Design stage as a typed note to the buyer): the renewals evidence-packs pipeline and the broker-onboarding KYC pipeline reuse the same audit-trail shape with a different input schema. The Elder Oracle treats this as a carry-forward note, not a scoping change. The buyer decides during workflow design whether to include them, in writing, signed by the named human approver attached to this case file.',
    ],
  },

  stages: [
    {
      agentOrdinal: 1,
      agentName: 'Need Discovery',
      inputFromPrevious:
        'The verbatim brief as submitted (industry, problem statement, proposed approach, evidence, must-not-happen) plus the oracles’ debate transcript and the Elder Oracle’s reconciled ruling.',
      output:
        'A one-page problem statement card (triage 3,200 monthly EU property claims to a median time-to-first-action of 4 calendar days without lowering the fraud-detection rate; every model recommendation reviewed by a named claims officer before any disposition is recorded). Attached: scope in / scope out, the four unambiguous must-not-happen clauses (no auto-deny, no auto-pay, no skip-the-human on flagged, no third-party data enrichment), and the named buyer approver (E. Okwuosa, Group Chief Risk Officer).',
      downstreamHandoff:
        'The problem statement card and the four must-not-happen clauses are handed to the Readiness Review stage as inputs. The named buyer approver is added to the case file for every subsequent gate.',
      supervisor: {
        name: 'A. Maréchale',
        role: 'Head of Claims Operations',
        decision: 'Approve',
        typedReason:
          'The problem statement card matches the inbound brief verbatim, the four must-not-happen clauses are reflected one for one, and the 4-day median target is consistent with the FY2025 ops dashboard. Approve the case to advance to the Readiness Review stage.',
        signedAt: '2026-04-02T09:14:00Z',
      },
    },
    {
      agentOrdinal: 2,
      agentName: 'Readiness Review',
      inputFromPrevious:
        'The problem statement card, the four must-not-happen clauses, the named buyer approver, and the Elder Oracle’s reconciled ruling (Build, with Risk and Growth items carried forward).',
      output:
        'A data + regulatory regime audit table for IE / FR / DE: claim-packet sources (broker vs. policyholder share), payment-clock obligations per regime (IE: 10 working days acknowledgement; FR: 5-day acknowledgement under Code des Assurances Art. L113-3; DE: 1-month decision clock under VVG §146), the SIU retrospective shape, and DPO sign-off on the personal-data minimisation clause (inbound packet + policy schedule only, no third-party enrichment). Attached: a named-tool comparison statement covering FRISS, Shift Technology, and Guidewire ClaimCenter (Competition agent’s objection resolved — build case vs. buy case written out, on the case file, not in a slide deck).',
      downstreamHandoff:
        'The audit table and the named comparison statement are handed to the Workflow Design stage; the DPO sign-off on personal-data scope is handed to the Governance Check stage as a binding constraint.',
      supervisor: {
        name: 'L. Caulfield',
        role: 'Data Protection Officer',
        decision: 'Approve',
        typedReason:
          'The inbound-packet + policy-schedule data scope is consistent with GDPR Article 5(1)(c) data minimisation, no third-party data is in scope, and the named source-systems list (claims system, policy admin, prior-claims history) matches the inventory. The regime-by-regime mapping is consistent with the named statutory pay-out clocks. Approve to advance.',
        signedAt: '2026-04-09T11:42:00Z',
      },
    },
    {
      agentOrdinal: 3,
      agentName: 'Workflow Design',
      inputFromPrevious:
        'The data + regulatory regime audit table, the named comparison statement (FRISS / Shift / Guidewire ClaimCenter + the off-the-shelf build case written out), the DPO sign-off, the must-not-happen clauses, and the carry-forward items from the Elder Oracle’s reconciled ruling (Risk: a named human-only assertion step; Growth: a typed note on the renewals + broker-onboarding reuse).',
      output:
        'A role/escalation diagram for the per-claim workflow: Inbound → Model recommendation (Standard / Flag / Refer to SIU) → Named officer review (under the Risk binding constraint, the officer click is now two-step — assert pack reviewed with a typed reason, then click to advance) → SIU referral gate (mandatory for Flag / Refer-to-SIU) → Final disposition (Claims Officer, named). Attached: per-regime SLA (4-day median target per regime with the named country splits), the typed note to the buyer on the renewals + broker-onboarding pipeline reuse, and the 88% pilot-agreement unit-cost basis.',
      downstreamHandoff:
        'The role/escalation diagram and the per-regime SLAs are handed to the Governance Check stage; the typed note on the renewals + broker-onboarding reuse is returned to the buyer for a signed scope decision before the Governance Check stage begins.',
      supervisor: {
        name: 'K. Holzapfel',
        role: 'Head of Special Investigations Unit (SIU)',
        decision: 'Approve',
        typedReason:
          'The role/escalation diagram enforces a mandatory SIU referral gate on Flag / Refer-to-SIU recommendations and the named-officer assertion is now structurally separated from the advance click. The 88% agreement unit-cost basis is acceptable — the case is costed at the present-day agreement rate, not at a future-model improvement line. Approve.',
        signedAt: '2026-04-22T14:08:00Z',
      },
    },
    {
      agentOrdinal: 4,
      agentName: 'Governance Check',
      inputFromPrevious:
        'The role/escalation diagram, the per-regime SLAs, the DPO sign-off, the four must-not-happen clauses, and the Risk carry-forward (human-only assertion step) re-read at this gate.',
      output:
        'A logging/oversight control matrix: per-claim record shape (inbound packet SHA-256, model version, model recommendation, named reviewer, two-step assertion reason, final disposition, timestamp, immutable hash chain), EIOPA / Solvency II reporting hooks preserved unchanged, the four must-not-happen clauses mapped one-to-one to runtime checks, the vulnerable-customer escalation preserved, and a stop-the-line escalation path to the named CRO (E. Okwuosa).',
      downstreamHandoff:
        'The control matrix is handed to Agent 5 — AI Build — which operates Stage 5 (Software Build) — as the binding spec for the audit trail: every route handler and the prisma model below are derived from this matrix.',
      supervisor: {
        name: 'E. Okwuosa',
        role: 'Group Chief Risk Officer',
        decision: 'Approve',
        typedReason:
          'The control matrix covers all four must-not-happen clauses with runtime checks, the immutable hash chain closes the Article 12 logging loop, and the named human-only assertion step is wired in. Approve to advance to the Software Build stage. Final approve releases the Software Build.',
        signedAt: '2026-05-08T10:30:00Z',
      },
    },
    {
      agentOrdinal: 5,
      agentName: 'AI Build',
      inputFromPrevious:
        'The logging/oversight control matrix, the role/escalation diagram, the per-regime SLAs, the four must-not-happen clauses, and the DPO sign-off.',
      output:
        'A per-claim review queue at /claims/queue with a human-in-the-loop approve / request-info / refer-to-SIU workflow. Every officer action is recorded with the model input hash, the model version, the recommendation, the two-step typed assertion, and the disposition timestamp. The audit trail is persisted as the ClaimsAuditTrail prisma model with append-only semantics — the officer who took the action cannot amend the row after it is written, and the row is anchored in the immutable per-case hash chain. The build ships the following surface: GET /api/claims/queue (claims officer inbox), POST /api/claims/[id]/review (the two-step assertion + advance), POST /api/claims/[id]/refer-siu (SIU referral gate), and the ClaimsAuditTrail prisma model with inputHash, modelVersion, recommendation, reviewerId, assertionReason, disposition, createdAt. Runtime checks enforced: no auto-deny, no auto-pay, no skip-the-human on flagged, no third-party data enrichment. The named CRO retains a stop-the-line escalation in the audit-trail dashboard.',
      // COPY ACCURACY (2026-09-03, rebuild-brief review, same evidence as
      // agents.ts's ai-build entry): "a runnable Software Build" overclaimed
      // against GATE_DEFS[4]'s own documented output (a spec, not code).
      // NOTE: the `output` field above this one still describes concrete
      // generated API surface (endpoint paths, Prisma field names) as
      // though it were shipped working code — left untouched here. Deciding
      // how much implementation detail an illustrative worked example
      // should claim is a real editorial call, not a word-swap, and
      // deserves its own pass rather than a rushed edit alongside this one.
      downstreamHandoff:
        'The hand-off is the case file receipt itself: the approved Blueprint and Runbook with the audit-trail model, the named review queue design at /claims/queue, and an exportable per-case JSON bundle ready for the buyer’s compliance officer to replay.',
      supervisor: {
        name: 'J. Vargas',
        role: 'Group Chief Information Officer',
        decision: 'Approve',
        typedReason:
          'The Software Build spec matches the Governance Check control matrix one-to-one, the four must-not-happen clauses are enforced as runtime checks, and the two-step assertion (Risk carry-forward) is wired in. The ClaimsAuditTrail prisma model is append-only with the immutable hash chain. Final approve — the case is released to the buyer’s claims team as an approved build spec with the audit-trail receipt attached.',
        signedAt: '2026-05-21T16:55:00Z',
      },
    },
  ],

  solution: {
    component: 'Per-claim review queue',
    route: '/claims/queue',
    dataPlane: [
      'GET /api/claims/queue — claims officer inbox (model-recommended dispositions, the inbound packet pointer, the named reviewer field)',
      'POST /api/claims/[id]/review — two-step human-only assertion + advance (typed reason recorded; structural separation from model recommendation per Risk objection)',
      'POST /api/claims/[id]/refer-siu — mandatory SIU referral gate on Flag / Refer-to-SIU recommendations',
      'ClaimsAuditTrail prisma model — append-only, hash-chained per case; columns: inputHash, modelVersion, recommendation, reviewerId, assertionReason, disposition, createdAt',
      'GET /api/claims/[id]/audit — read-only replay of one case’s audit trail for the compliance officer, anchored to the hash chain',
    ],
    mechanic:
      'Human-in-the-loop approve / request-info / refer-to-SIU. The model writes a recommendation; a named claims officer reviews the packet, records a typed reason for the assertion, and then clicks to advance. The model never auto-denies, never auto-pays, never closes a claim file. Every action is logged to the append-only ClaimsAuditTrail table with an immutable per-case hash chain, so a compliance officer can replay any claim end-to-end.',
  },

  runMetadata: {
    caseId: 'CARIFORGE-EU-CLAIMS-2026-Q2-014',
    buyerOrg: 'A regulated European non-life insurer (IE / FR / DE operations; EIOPA-supervised)',
    submittedOn: '2026-03-26',
    closedOn: '2026-05-22',
    reviewer:
      'E. Okwuosa, Group Chief Risk Officer — the named human approver attached to the case file.',
  },
} as const;
