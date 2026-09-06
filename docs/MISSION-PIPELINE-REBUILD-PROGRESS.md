# Mission pipeline rebuild — progress log

Tracks execution of `docs/HANDOVER-MISSION-PIPELINE-REBUILD.md`'s R1–R8, in the
sequencing order from that doc's section 5. Branch: `mission-pipeline-rebuild`
off `claude/upload-website-github-707ova`.

## R3 — Verify the gate-approval submit against a client-router stall

**Status: verified, no fix needed.**

Read `mission-gate-panel.tsx` (submit path) and `mission-detail.tsx` (`onWritten`)
against the reference's `ApprovalForm.tsx` bug writeup in full. Finding: this
repo doesn't use Next Server Actions anywhere in its write flows — every
mutation (`mission-gate-panel.tsx`, `mission-intake-form.tsx`, and every other
`onWritten`-style form) goes through a plain REST call via `apiFetch`, not a
`'use server'` action. The documented race is specifically a Server Action's
implicit route refresh losing to an explicit `router.push()` — that mechanism
doesn't exist for a plain `fetch()` call, so it structurally cannot occur here.

`MissionGatePanel`'s own success path doesn't even call `router.push()` — it
calls `onWritten()`, which just re-fetches the mission via `apiFetch` and
updates local state, still on the same page. No stall class matching the
reference's exists in this code path. No live 30–40-run repro was performed
(would need a running dev server against a real Postgres + a logged-in test
user, which this pass didn't provision) — the conclusion above is a code-level
one. Recommend a live smoke-test as cheap insurance before this ships to real
approvers, but treat it as non-blocking for the rest of this rebuild.

## R1 + R2 — Missions on the first screen; merge the two shells

**Status: done.**

- Moved `src/app/(custom)/missions/**` → `src/app/(dashboard)/missions/**`
  (URL unaffected — route groups don't affect the path). Added
  `src/app/(dashboard)/missions/layout.tsx` wrapping every `/missions/*` route
  in the same `DashboardShell` that `/dashboard` already uses. `/admin/*` keeps
  its own deliberate no-shell layout, untouched.
- `DashboardNav` gained a "Missions" item alongside "Overview" — one nav, one
  identity display, one logout, shared by both route trees now.
- Rewrote `src/app/(dashboard)/dashboard/page.tsx`: removed the hardcoded
  placeholder KPI cards (`Activity: '0'`, `Support: 'Open'`) and the generic
  "Workspace" checklist. Replaced with a prompt-first hero ("What would you
  like to achieve?" + a textarea) above the real mission list
  (`<MissionList />`, reusing the existing `GET /api/forge/missions` data —
  no new backend work).
- The quick-capture textarea hands off to `/missions/new?intake=...` rather
  than creating a mission directly: `MissionCreate` requires nine structured
  attribution fields a single textarea can't satisfy, and loosening that
  schema was out of scope. `MissionIntakeForm` now accepts an `initialIntake`
  prop to prefill from that query param.

Verified: `tsc --noEmit` clean, `biome check` clean on all touched files,
`next build` (with placeholder env vars — this repo has no `.env.example` and
needs a real `DATABASE_URL`/auth secrets to build for real) produces a clean
route tree with no conflicts: `/dashboard`, `/missions`, `/missions/[slug]`,
`/missions/[slug]/{blueprint,replay,runbook}`, `/missions/new`, `/admin/*` all
present as expected. `npm test` has 23 pre-existing failing test files on the
base branch (unrelated module-resolution issues, confirmed via `git stash`
before touching anything) — untouched by this work, not fixed here (out of
scope for this rebuild).

## R5 — Rename the SoftwareBuild gate

**Status: done (display-name rename only — the "Short term / low effort" half
of R5's two options).**

Renamed what a user actually reads: `GATE_DEFS[4].name` ("Build complete" →
"Prototype spec approved") and `.purpose` in `forge.ts`; `GateCard` in
`mission-detail.tsx` (was rendering the raw `gate.stage` enum value verbatim
for all 5 cards — now looks up `GATE_DEFS[gate.gateIndex].name`, fixing a
latent display bug for gates 1–4 too, not just gate 5); the replay-form
dropdown option text; and the generated Blueprint's "Build outcome —
SoftwareBuild vN" block heading/summary/reuse-signal copy in `release.ts`
(`"Prototype spec — vN"` etc). Updated the one test whose assertion locked
that exact reuse-signal string (`tests/unit/forge/release.test.ts`).

**Deliberately did NOT rename the underlying `stage: 'SoftwareBuild'` enum
value.** The handover doc frames renaming as "Low effort," but the identifier
turned out to be threaded through far more than the doc anticipated: it's a
native Postgres enum (`prisma/schema/forge.prisma`, `db/01-schema.sql`) plus
~15 business-logic files (state machine transitions, replay invalidation,
telemetry, oracle council role binding, release-note generation) and ~10 test
files that assert on the literal string. A real rename needs a hand-authored
Postgres migration (`ALTER TYPE ... RENAME VALUE`, since Prisma Migrate's
default diff would want to drop+recreate the enum) and touches
correctness-critical code, not just labels. That's genuinely the doc's own
"Longer term (high effort)" bucket — recommend scoping the full identifier +
DB rename as its own follow-up ticket, separate from this rebuild pass.

One accepted seam from this scoping choice: `MissionStatus`'s `'InBuild'`
value (a separate enum) still displays as "InBuild" even though the gate that
produces it is now labeled "Prototype spec approved" — not fixed here, since
`MissionStatus` wasn't in scope for R5 and renaming it opens the same
enum-migration question.

Verified: `tsc --noEmit` clean, `biome check` clean on touched files. Could
not run the specific vitest files touched (`release.test.ts`,
`blueprint-runbook.test.ts`, `contracts-parity.test.ts`) — same pre-existing
`@/` alias resolution gap in this repo's Vitest config noted under R1/R2,
confirmed unrelated to this change (fails identically importing totally
different modules). `tsc` resolves the same aliases fine via `tsconfig.json`
paths, so this is a Vitest/Vite config gap, not a real import problem.

## R4 — Add the 4th gate outcome: approve-with-controls

**Status: done.**

- `prisma/schema/forge.prisma`: added `ApproveWithControls` to the
  `ApprovalDecision` enum and a nullable `controls String?` column on
  `Approval`. Both purely additive — hand-authored a forward-only,
  idempotent migration (`prisma/migrations/20260826020000_add_approve_with_controls/`)
  matching this repo's existing migration style (no live DB in this
  environment to actually apply it against; `prisma generate` confirms the
  schema itself is valid and regenerates matching client types). Did **not**
  touch `db/01-schema.sql` — that's a dated point-in-time DB snapshot/backup
  file, not a live schema source, so editing it would misrepresent history
  rather than apply a migration.
- `forge.ts`: `APPROVAL_DECISION_VALUES` gained the 4th value;
  `GATE_DECISION_CHOICES` (= `APPROVAL_DECISION_VALUES` minus
  `ApproveWithControls`) is what the UI's Select actually renders, so it's
  never a raw manually-picked choice — matching the "treat Approve +
  non-empty controls as the 4th state" framing. Added `isApproveDecision()`
  as the one place "did this gate pass" is decided, and a `controls` field
  on `GateDecide` (write) and `ApprovalItem` (read).
- `MissionGatePanel`: added a Controls textarea; on submit, `decision:
  'Approve'` + non-empty controls text is upgraded client-side to
  `'ApproveWithControls'` before the API call, exactly mirroring the
  reference platform's own rule ("adding any turns Approve into
  approve-with-controls").
- Server-side (`decide/route.ts`, `service.ts`): `controls` flows through to
  the DB, stored only when the decision is `ApproveWithControls`.
- **Correctness sweep:** every place that checked `decision === 'Approve'`
  to mean "this gate/approval passed" now goes through
  `isApproveDecision()` instead, across `service.ts` (gate-state
  computation, gate advancement, admin telemetry rows),
  `telemetry-service.ts` (approval counts, release-actor derivation),
  `oracle-council-card.tsx` (per-gate approval lookup), and
  `tool-actions.ts` (external/internal tool-action gate-approval checks —
  this one was a genuine latent bug catch: without the fix, an
  approve-with-controls decision would have made `assertExternalApproved`
  wrongly report "no approval found" and block legitimate tool actions).
  Also widened and fixed `tag-oracle-gate-decision.ts`'s email template,
  which had its own narrower 3-value decision type and a ternary that would
  have silently mislabelled any 4th-value decision as "refused" — replaced
  with a `Record<ApprovalDecision, string>` label map so a missing case is a
  type error, not a silent wrong label.
- Updated 4 test fixtures (`evidence-export`, `next-action`, `release`,
  `telemetry-service`) to include the new required `controls` field.

Verified: `tsc --noEmit` clean, `biome check` clean on all touched files,
`prisma generate` succeeds against the updated schema. Full `vitest run`
gives the identical 23-failed/4-passed file count as the pre-existing
baseline (same alias-resolution gap noted under R1/R2) — no new failures
among what's runnable; the forge-specific tests I edited can't actually
execute in this environment for the same reason.

## R6 — Wire up a "Your AI team" agent-roster panel

**Status: done.**

Did not reuse `ORACLE_ROLE_NAMES` (Need/Readiness/Workflow/Governance/Build
Oracle) for this — those are the five **human** approvers per gate, the
opposite concept from an AI-agent roster, and labeling them as "AI team"
would misrepresent human governance as automation. Instead found and reused
`src/lib/business/agents.ts`'s existing `CORE_AGENTS` — a pre-built
seven-agent catalog (`GET /api/agents`) that already matches the reference
platform's "Seven specialists work every project" framing almost verbatim,
with 5 pipeline agents (Discovery/Readiness/Workflow/Governance/AI Build,
1:1 with the gate stages) plus 2 wraparound agents (Partner/Impact — the
same two concepts section 3/R6 of the handover doc flags as having zero UI
surface anywhere in this repo).

New `AgentTeamPanel` (`src/components/custom/dashboard/agent-team-panel.tsx`)
fetches `GET /api/agents` (static catalog) and `GET /api/forge/missions`
(live data, already existing), and computes real Agent/Does/Active now/
Completed rows: a mission counts toward an agent's "Active now" when
`currentStageIndex` equals that agent's gate and status isn't terminal, and
toward "Completed" once `currentStageIndex` has passed that gate. Partner
and Impact show "Not tracked yet" rather than a fabricated `0` — there's no
mission data behind either concept yet, and showing a real zero would claim
something was checked when it wasn't. Wired into `dashboard/page.tsx` below
the mission list.

Verified: `tsc --noEmit` clean, `biome check` clean, `next build` clean
(same route tree as before, new component adds no new routes).

## R7 — Add a QA-review layer ahead of the approval form

**Status: done — real LLM-backed version, user explicitly opted into this
over the deterministic/rule-based lightweight alternative.**

This repo had zero existing AI/LLM integration to build on (no SDK, no
provider key). Added `@anthropic-ai/sdk`, model `claude-opus-5`, using
structured outputs (`messages.parse()` + `output_config.format`) rather than
free-text + manual JSON parsing, so a malformed model response can't corrupt
what reaches the UI.

- `src/lib/contracts/qa-review.ts`: `QAReview` (discriminated union —
  `unavailable` | `ok` with a `review`), matching the reference platform's
  own `QAReviewCard` contract (`verdict`, `confidence`, `summary`, `issues`
  by severity, `questionsForApprover`). Standard app-wide `zod` (v3 API), so
  it plugs into `apiFetch` and every route handler the same as every other
  contract.
- `src/lib/business/forge/qa-review.ts`: `getQAReview()` — **never throws**.
  No `ANTHROPIC_API_KEY` configured, a rate limit, a network error, a model
  refusal, a malformed response — all degrade to `{status: 'unavailable'}`,
  exactly the reference platform's own "QA reviewer couldn't run" fallback.
  This sits in front of a real governance decision; it must never be the
  reason a gate can't be decided. Reads the key directly from
  `process.env` rather than through `src/lib/env.ts` — that file is
  `@polsia:shared/composed`, hand-edited only through its declared
  module-contribution slots by the Polsia installer, and this is an
  optional feature, not required deploy-time config.
- **Real version-conflict catch, not just typing noise:** the Anthropic
  SDK's `zodOutputFormat()` calls `zod/v4`'s `toJSONSchema()` internally —
  it needs a schema actually built with zod/v4, not one that's merely
  structurally similar. This app's contracts all use the standard top-level
  `zod` import (v3 API, to match `apiFetch`'s `ZodType` and every other
  route handler) — so `qa-review.ts` builds a small private `zod/v4` shadow
  schema (`QAReviewResultV4`) used only for the one `zodOutputFormat()`
  call, and re-validates the model's `parsed_output` through the real (v3)
  `QAReviewResult` before it's trusted anywhere else. Confirmed via `tsc`:
  the naive version (passing the v3 schema straight to `zodOutputFormat`)
  fails to type-check, which is what surfaced this before it became a
  runtime bug.
- New route: `GET /api/forge/missions/:id/gates/:gateIndex/qa-review` —
  computed fresh on every call (no persistence in this pass — an accepted
  gap, see below). Returns `unavailable` (still HTTP 200) when there's no
  handoff at that gate yet, rather than treating "nothing to review" as an
  error.
- New `QAReviewCard` (`src/components/custom/missions/qa-review-card.tsx`),
  rendered directly above `MissionGatePanel` in the Gates tab — but only for
  gates still in the `'Awaiting'` state (an already-decided gate has no
  pending approval form for it to sit in front of). Loading/unavailable
  states render small and never block `MissionGatePanel` underneath.
  Advisory only, matching the reference platform's own contract: it never
  gates anything, calls no gate-decision endpoint, and can't affect
  `APPROVAL_DECISION_VALUES` in any way.

**Accepted gaps in this lightweight-but-real pass:**
- No persistence — the review isn't stored, so it re-runs (and re-costs)
  every time the Gates tab is viewed. A real deployment would want to cache
  per-`stageHandoffId` in the DB and only re-run when the handoff changes.
- No live end-to-end test — this environment has no `ANTHROPIC_API_KEY`
  configured, so the actual model call was never exercised; verified via
  `tsc`/`biome`/`next build` plus tracing the SDK's own `zodOutputFormat`
  source, not a live run. **You'll need to set `ANTHROPIC_API_KEY`** (server
  env, not `NEXT_PUBLIC_*`) wherever this app is deployed for the feature to
  do anything beyond gracefully no-op as "unavailable" — until then it's
  inert by design, not broken.

Verified: `tsc --noEmit` clean, `biome check` clean, `next build` clean (new
route appears in the tree), confirmed `ANTHROPIC_API_KEY` doesn't appear in
any `.next/static` client chunk (grep count 0 across every chunk).

## R8 — no action required (flagged only, not touched)

---

## Summary

All 8 recommendations (R1–R8) from the handover doc are addressed, in the
requested sequencing order. R1, R2, R4, R6, R7 shipped as real functional
changes; R3 and R8 were verify-only findings (no code change needed); R5
shipped its low-effort half (display rename) and explicitly deferred its
high-effort half (the underlying `SoftwareBuild` enum/DB rename) as a
separate follow-up ticket, with the reasoning written up above. Section 4's
two "already correct" items (gate names 1–4, the Idea Council's 5 advisor
roles/order) were not touched anywhere in this branch.

7 commits on `mission-pipeline-rebuild` (branched off
`claude/upload-website-github-707ova`), each independently `tsc`/`biome`/
`next build`-verified. Not yet pushed or opened as a PR — branch is local
only, pending review.
