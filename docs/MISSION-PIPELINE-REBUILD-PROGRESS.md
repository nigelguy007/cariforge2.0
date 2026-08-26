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

## R5, R4, R6, R7 — not yet started

## R8 — no action required (flagged only, not touched)
