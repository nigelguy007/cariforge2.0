// @polsia:user-owned — the full front-door-to-Completed-mission journey, as
// one continuous, re-runnable spec.
//
// Added 2026-09-04. Real user request: "explain the user journey process
// from submission to having the app built... QA against your explanation
// leaving out nothing. Make sure each step makes sense and that it works...
// find a skill to support this user journey experience tracking and QA."
//
// This IS that skill: every real step a submitter and an admin take —
// brief submission, sign-up/log-in (via the same programmatic auth as the
// rest of this suite), converting a brief to a mission, appointing a named
// Elder Oracle, and clearing all five governance gates with real handoffs
// and specialist attestations — run against the real production API, no
// UI clicked, no mocks. It's how the mission.status regression documented
// below was actually found: this same walk, done manually once, caught
// state-machine.ts's nextStageFor() returning the CURRENT stage instead of
// the NEXT one after a gate approval (fixed same day, see that file's
// history). Re-running this spec is the way to catch that class of bug
// again before a real user does.

import { expect, request as playwrightRequest, test } from '@playwright/test';

const baseURL = process.env.E2E_BASE_URL ?? 'https://cariforge2-0.vercel.app';

const SPECIALISTS = ['Risk', 'Demand', 'Growth', 'Competition', 'Money'] as const;
const STAGES = ['Discovery', 'Readiness', 'Workflow', 'Governance', 'SoftwareBuild'] as const;

// Reuse the sessions global-setup.ts already established — do NOT sign in
// again here. A second round of sign-in calls, this close after
// global-setup's, intermittently got rejected (a rate limit or replay
// guard on repeated sign-ins for the same account in quick succession) even
// though the same credentials worked fine standalone — loading the
// already-issued session cookie sidesteps that entirely and is the
// standard Playwright pattern besides (https://playwright.dev/docs/auth).
// Playwright requires the first callback argument to be a destructuring
// pattern (even empty) to detect which fixtures a test uses via static
// analysis — a plain named parameter here is a runtime error, not just a
// style choice.
// biome-ignore lint/correctness/noEmptyPattern: see comment above
test('full journey: brief -> mission -> five governed gates -> completed build spec', async ({}, testInfo) => {
  // This test genuinely makes ~13 sequential real HTTP round-trips (brief,
  // mission, elder-oracle, 5x[handoff + attest + decide], next-action,
  // blueprint, runbook) against production, one of them a real AI call.
  // Playwright's 30s default is comfortable running this spec alone but
  // gets tight running concurrently with the rest of the suite's workers
  // hitting the same API — hit that exact timeout once. Every other spec
  // in this suite is a handful of requests and stays well under a minute
  // regardless, so this override is scoped to just this test.
  testInfo.setTimeout(90000);
  const submitter = await playwrightRequest.newContext({
    baseURL,
    storageState: 'tests/e2e/.auth/submitter.json',
  });
  const admin = await playwrightRequest.newContext({
    baseURL,
    storageState: 'tests/e2e/.auth/admin.json',
  });

  // 1. Front door: submit a brief. Real Discovery-triage AI call runs, a
  // real acknowledgement email fires — this is the exact same code path a
  // public, unauthenticated visitor hits.
  const stamp = new Date().toISOString();
  const leadRes = await submitter.post('/api/leads', {
    data: {
      brief: `E2E JOURNEY (${stamp}): A small claims-intake team manually reads inbound insurance claim emails and tiers them before routing to an adjuster. Want an AI-assisted workflow that extracts key facts, flags missing disclosures, and routes to the right adjuster queue, with a named human approving the routing rule before go-live.`,
      email: process.env.QA_SUBMITTER_EMAIL ?? 'qa-submitter@cariforge.test',
    },
  });
  expect(leadRes.status()).toBe(201);
  const lead = await leadRes.json();
  expect(lead.notified).toBe(true);
  expect(lead.triage?.status).toBe('ok');

  // 2. It shows up in the signed-in submitter's open-briefs list (what
  // BriefConversionCard reads on the dashboard).
  const openBriefs = await submitter.get('/api/forge/briefs/open');
  expect(openBriefs.status()).toBe(200);
  const briefIds = (await openBriefs.json()).items.map((i: { id: string }) => i.id);
  expect(briefIds).toContain(lead.id);

  // 3. Convert the brief into a governed mission.
  const missionRes = await submitter.post('/api/forge/missions', {
    data: {
      intake: `E2E JOURNEY (${stamp}): claims-intake triage workflow, AI-assisted extraction and routing, human-approved routing rule before go-live.`,
      sourceLeadId: lead.id,
    },
  });
  expect(missionRes.status()).toBe(201);
  const missionId: string = (await missionRes.json()).mission.id;

  // 4. Start it — Draft -> InDiscovery.
  const start = await submitter.post(`/api/forge/missions/${missionId}/transitions/start`, {
    data: {},
  });
  expect(start.status()).toBe(200);
  expect((await start.json()).mission.status).toBe('InDiscovery');

  // 5. Admin appoints the submitter as the mission's named Elder Oracle —
  // required before gates 0 and 4 can be approved by anyone.
  const meRes = await submitter.get('/api/forge/missions/' + missionId);
  const submitterUserId: string = (await meRes.json()).mission.createdById;
  const elder = await admin.post(`/api/forge/missions/${missionId}/elder-oracle`, {
    data: { userId: submitterUserId },
  });
  expect(elder.status()).toBe(200);
  expect((await elder.json()).mission.elderOracleUserId).toBe(submitterUserId);

  // 6. Clear all five gates: submit a handoff, self-attest as a specialist,
  // decide Approve — and confirm the mission's status genuinely advances
  // after each one (the exact assertion that would have caught the
  // nextStageFor bug before it shipped).
  const expectedStatusAfterGate = [
    'InReadiness',
    'InWorkflow',
    'InGovernance',
    'InBuild',
    'Completed',
  ];
  for (let gateIndex = 0; gateIndex < STAGES.length; gateIndex++) {
    const stage = STAGES[gateIndex];
    const handoffRes = await submitter.post(`/api/forge/missions/${missionId}/handoffs`, {
      data: {
        stage,
        payload: { note: `E2E-generated ${stage} artifact for journey test ${stamp}` },
        confidence: 0.75,
        missingEvidence: [],
        toolRefs: [],
      },
    });
    expect(handoffRes.status()).toBe(201);
    const handoffId: string = (await handoffRes.json()).handoffs.at(-1).id;

    const attest = await submitter.post(
      `/api/forge/missions/${missionId}/handoffs/${handoffId}/attesters`,
      { data: { userId: submitterUserId, role: SPECIALISTS[gateIndex % SPECIALISTS.length] } },
    );
    expect(attest.status()).toBe(200);

    const decide = await submitter.post(
      `/api/forge/missions/${missionId}/gates/${gateIndex}/decide`,
      {
        data: {
          decision: 'Approve',
          reasonCode: 'Approved',
          reasonText: `E2E journey test — approving ${stage} gate ${gateIndex}.`,
          stageHandoffId: handoffId,
        },
      },
    );
    expect(decide.status()).toBe(200);
    const status = (await decide.json()).mission.status;
    expect(status, `mission status after approving gate ${gateIndex} (${stage})`).toBe(
      expectedStatusAfterGate[gateIndex],
    );
  }

  // 7. next-action agrees the mission is done — not still pointing at a
  // gate.
  const next = await submitter.get(`/api/forge/missions/${missionId}/next-action`);
  expect(next.status()).toBe(200);
  const nextBody = await next.json();
  expect(nextBody.view.kind).toBe('Complete');
  expect(nextBody.isTerminal).toBe(true);

  // 8. The final build spec — Blueprint + Runbook — exists and reflects
  // all five stages.
  const blueprint = await submitter.get(`/api/forge/missions/${missionId}/blueprint`);
  expect(blueprint.status()).toBe(200);
  const blueprintBody = await blueprint.json();
  expect(blueprintBody.blocks.length).toBeGreaterThanOrEqual(5);

  const runbook = await submitter.get(`/api/forge/missions/${missionId}/runbook`);
  expect(runbook.status()).toBe(200);
  const runbookBody = await runbook.json();
  expect(runbookBody.steps.length).toBeGreaterThanOrEqual(5);

  await submitter.dispose();
  await admin.dispose();
});
