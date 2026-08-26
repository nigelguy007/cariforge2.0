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

## R4, R6, R7 — not yet started

## R8 — no action required (flagged only, not touched)
