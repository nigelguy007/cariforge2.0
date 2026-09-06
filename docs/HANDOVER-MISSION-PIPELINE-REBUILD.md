# Handover: Mission pipeline rebuild — align with the real CARI Forge platform

**For:** ruflo
**From:** engagement carried out via Claude Code, 2026-08-26
**Status:** ready to start — no code changed yet, this is a scoped plan

## 1. What this is

`cariforge2-0.vercel.app` (this repo) is a real, database-backed governed-workflow
product — not a mockup. It independently built a 5-gate mission pipeline
(`Discovery → Readiness → Workflow → Governance → SoftwareBuild`) that lines up
closely, gate-for-gate, with the *actual* CARI Forge platform, which is a
separate, more mature codebase: `nigelguy007/cariforgeplatform` (Next.js frontend +
Python/FastAPI backend), live behind a login at `cariforge.com/888`.

This document is the rebuild brief: bring this app's authenticated product in line
with the real platform's functionality and template, using the real platform's own
source as the reference implementation. Every recommendation below cites the exact
file(s) on both sides so you can go read the real behavior before changing this repo.

**Do not treat this as "make it look like a marketing site."** Everything here is
about the signed-in product (`/dashboard`, `/missions/*`), not landing pages,
pricing, or copy.

## 2. The two systems

| | This repo (rebuild target) | Reference implementation |
|---|---|---|
| Repo | `nigelguy007/cariforge2.0` | `nigelguy007/cariforgeplatform` |
| Live URL | `https://cariforge2-0.vercel.app` | `https://www.cariforge.com/888` (login-gated) |
| Stack | Next.js 16 / React 19 / TypeScript, Prisma 6 + Postgres, better-auth | Next.js/TypeScript frontend + separate Python/FastAPI backend, LangGraph orchestration, Postgres + Neo4j + Pinecone |
| Core entity | `Mission` | `Case` |
| Auth | better-auth, client-side session redirect | Session-based, bcrypt + signed tokens, server-checked (see `docs/adr/0011` in the platform repo) |
| Demo login (reference only, printed on their own login page) | — | `demo@cariforge.dev` / `cariforge-demo` (TAG Caribbean org), `demo@mirror.cariforge.dev` / `cariforge-demo` (MIRROR org) |

**Access note:** nobody on this engagement logged into the live platform app.
Everything below is sourced directly from `cariforgeplatform`'s own committed
source — more exact than a screenshot, and it's the reference you should clone
locally and read alongside this repo while doing the rebuild.

```
git clone https://github.com/nigelguy007/cariforgeplatform.git
```

Key reference paths inside that repo, referenced throughout this doc:
- `apps/web/app/cases/**` — the authenticated route tree
- `apps/web/components/**` — StageStepper, ActivityFeed, AgentTeam, AskCari,
  QAReviewCard, CouncilResolution, etc.
- `apps/web/lib/domain/**` — stage order, agent-team stats, council roles
- `apps/web/styles/tokens.css` — the "Daylight" design tokens + multi-brand theming
- `docs/app_spec.md`, `docs/DEMO_SCRIPT.md`, `docs/COMPLIANCE_STATEMENT.md`
- `tests/api/fixtures/demo/` and `tests/api/fixtures/demo_mirror/` — real fixture
  case data for both pilot orgs (TAG Caribbean, MIRROR)

Key paths in **this** repo, referenced throughout:
- `src/app/(dashboard)/dashboard/**`
- `src/app/(custom)/missions/**`
- `src/components/custom/missions/**`, `src/components/custom/dashboard/**`
- `src/lib/contracts/forge.ts` (gate defs, reason codes, schemas)
- `src/lib/contracts/council.ts`
- `src/app/api/forge/missions/**` (~30 routes — already wired to Postgres via
  `requireAuth` + Zod + an audit trail; this is real, not stubbed)

## 3. Recommendations, in priority order

### R1 — Put Missions on the first screen a signed-in user sees
**Problem:** `src/app/(dashboard)/dashboard/page.tsx` renders 4 hardcoded
placeholder KPI cards (`Activity: '0'`, `Support: 'Open'`) and a generic
"Workspace" checklist. It never links to `/missions`. A user has to already know
that URL exists.
**Reference:** `apps/web/app/cases/page.tsx` in the platform repo — the case list
page *is* the dashboard: a prompt-first hero ("What would you like to achieve?" +
a live "Ask CARI" textarea that GETs straight into case creation), the case list
as progress-bar cards, an agent-roster table, and a recent-activity feed, all on
one screen.
**Do:**
- Replace the dashboard's placeholder cards with the real mission list (reuse
  `GET /api/forge/missions`, already implemented).
- Add a prompt-first entry point above it, modeled on `AskCari.tsx` — a single
  textarea that submits into mission creation.
**Effort:** Medium. Data layer already exists; this is page composition.

### R2 — Merge the two disconnected authenticated shells into one
**Problem:** `/dashboard` (`src/components/custom/dashboard/dashboard-shell.tsx`)
and `/missions` (`src/app/(custom)/missions/**`) are two separate page templates
with separate chrome. The dashboard's own nav (`dashboard-nav.tsx`) has exactly
one item ("Overview") and never links to Missions.
**Reference:** `apps/web/app/cases/layout.tsx` — one `CasesLayout` wraps every
`/cases` route: a single floating nav pill (brand mark + wordmark linking home,
an Integrations link, identity + logout) persists across the list, case detail,
stage forms, and approval screens. There is no separate "dashboard" concept.
**Do:** Fold `/missions` under the dashboard's layout (or drop the dashboard
shell entirely and give `/missions` the persistent header) so there's one nav,
one identity display, one logout, everywhere.
**Effort:** Medium. Layout consolidation, no new data.

### R3 — Verify the gate-approval submit against a client-router stall
**Problem:** `src/components/custom/missions/mission-gate-panel.tsx` submits via
`apiFetch` inside a tab panel (`mission-detail.tsx`'s 8-tab layout), then calls
back into client state (`onWritten`).
**Reference:** `apps/web/app/cases/[caseId]/artefacts/[artefactId]/approve/ApprovalForm.tsx`
— read the comment block above `handleSubmit` in full. It documents three real,
independently-diagnosed production bugs in this *exact* spot: `useActionState` +
`router.push()` stalling 25–40% of the time; then bypassing `useActionState` and
still stalling ~10%; then finally tracing it to Next's client router itself — a
Server Action triggers an implicit route refresh that a `router.push()` can lose
a race against. Their fix: a full `<a href>` / `window.location.href` browser
navigation instead of any soft transition, specifically because "this is a real,
load-bearing business transition... not a place to accept a client-router race,
however rare." Verified with 40 repeated live runs, zero stalls, after the fix.
**Do:** Repeat-test `MissionGatePanel`'s submit live (30–40 real runs against a
real backend, not just a couple of manual clicks). If you see any stall or
silent no-navigate, copy their fix pattern: a full browser navigation on
success, not a client-side state update.
**Effort:** Low to verify; potentially high if the race is present and gate
approval currently silently strands users some percentage of the time.

### R4 — Add the 4th gate outcome: approve-with-controls
**Problem:** `APPROVAL_DECISION_VALUES` in `src/lib/contracts/forge.ts` is
`['Approve', 'Return', 'Refuse']`. The gate form already has a free-text
Controls-adjacent concept in spirit but no schema value for "approved, but
conditionally."
**Reference:** the platform's governance artefact schema supports a 4th outcome,
`approve_with_controls` — see the worked example at
`tests/api/fixtures/demo/governance_valid.json` in the platform repo: a medium
risk ("AI-drafted brand copy could misrepresent cultural context if unreviewed")
gets a named control ("Designer sign-off on all AI-generated brand copy before
publishing") and a decision of `approve_with_controls` — not a plain approve,
not a stop. Also see `ApprovalForm.tsx`'s own Controls textarea: "adding any
turns Approve into approve-with-controls."
**Do:** Add a 4th value to `APPROVAL_DECISION_VALUES`. Add a Controls field to
`GateDecide` (schema in `forge.ts`) and to `MissionGatePanel`'s form. Treat
"Approve" + non-empty controls as the 4th state in the UI and in stored data.
**Effort:** Medium. Schema, API route (`/api/forge/missions/[id]/gates/[gateIndex]/decide`), and gate-panel UI.

### R5 — Rename the SoftwareBuild gate, or build what it promises
**Problem:** Gate 5 in `GATE_DEFS` (`forge.ts`) is named `SoftwareBuild` /
"Build complete," but its actual output (`MissionBlueprintView`,
`MissionRunbookView` — `src/components/custom/missions/mission-blueprint-view.tsx`,
`mission-runbook-view.tsx`) is a pair of schema-versioned *specification*
documents, not deployable code.
**Reference:** the platform's equivalent stage, `Prototype`
(`apps/web/app/cases/[caseId]/prototype/page.tsx`), actually generates a real
multi-file, downloadable application: a `FileBrowser`, a `.zip` download, an
honest "still needed before going live" checklist, an "unsettled by the
council" risk carry-forward section, setup instructions, and a pass/fail test
report scored against the spec's own acceptance criteria, with a "Rebuild"
action that feeds the tester's findings back to the builder.
**Do — pick one:**
- **Short term (low effort):** rename the gate to something spec-accurate, e.g.
  `"PrototypeSpec"` / "Prototype spec approved," so the name matches what it
  actually delivers.
- **Longer term (high effort, biggest functional gap found):** extend the
  Blueprint/Runbook output toward real generated source code + a test pass,
  matching the platform's actual `Prototype` stage.
**Effort:** Low (rename) or High (real codegen) — sequence the rename first,
scope the codegen work separately.

### R6 — Wire up an "Your AI team" agent-roster panel
**Problem:** No equivalent exists in this repo currently.
**Reference:** `apps/web/components/AgentTeam/AgentTeam.tsx` on the platform's
case list — a real `role="table"`: Agent · Does · Active now · Completed, one
row per agent, numbers computed live from the org's own case list (explicitly
modeled on Relevance AI's and Gumloop's own operational tables per the
component's own code comment — not a marketing icon grid).
**Do:** New read-only component reading from the existing
`GET /api/forge/missions` response (stage + status per mission is already
returned) — mostly a data-binding exercise, not new backend logic.
**Effort:** Low–medium.

### R7 — Add a QA-review layer ahead of the approval form
**Problem:** No independent second-opinion step exists before a human approves
a gate in this repo.
**Reference:** `apps/web/components/QAReviewCard/QAReviewCard.tsx` — an
independent agent critiques every artefact before the human sees the approval
form: verdict (pass/concerns), confidence, issues by severity, and "questions to
ask before you approve." Advisory only — "it never gates anything; the human
gate stays the only gate" (component's own comment).
**Do:** Even a lightweight version — one more agent call before
`MissionGatePanel` renders, surfacing issues by severity — closes a real
governance gap.
**Effort:** Medium–high. New agent step + UI card.

### R8 — Do NOT touch the reason-code taxonomy — it's already ahead
**Not a problem — flagged so it doesn't get "simplified" away.**
This repo's `GATE_REASON_CODES` (`forge.ts`) is 13 structured values
(`EvidenceRequested`, `ScopeMismatch`, `GovernanceViolation`, `DemandUnverified`,
`WalkAway`, `StaleInformation`, `OrderingCorrected`, `Replanned`,
`UserCorrection`, `ReplayRequired`, `InsufficientConfidence`, `Approved`,
`Other`). The platform's equivalent field is free-text only. This repo's
version is a stronger, more queryable audit signal — keep it exactly as-is,
including through any of the rebuild work above.

## 4. Two things confirmed to already be correctly aligned — leave alone

- **Gate names 1–4.** This repo's `GATE_DEFS` independently uses
  `Discovery → Readiness → Workflow → Governance` — the exact same names, same
  order, as the platform's real `STAGE_ORDER`
  (`apps/web/lib/domain/stages.ts`). Don't rename these.
- **The Idea Council.** `src/lib/contracts/council.ts`'s 5 advisor roles (Risk /
  Demand / Growth / Competition / Unit economics) and 3 verdicts (Build / Test
  first / Walk away) match the platform's `apps/web/lib/domain/council.ts`
  almost exactly — same 5 roles, same order, same idea under different verdict
  labels (Pursue / Pursue-but-test-first / Kill). This is the single strongest
  structural match found anywhere between the two codebases. If extending the
  council UI, match the platform's *additional* mechanics instead of changing
  what's already aligned: per-advisor typed dissent, a round-two
  `ResolveForm`, and an explicit `OverrideForm` that requires and permanently
  records a stated reason when proceeding without agreement.

## 5. Suggested sequencing

1. R3 (verify/fix the approval-submit race) — do this first; it's a reliability
   bug hunt, not a redesign, and it blocks trusting anything else.
2. R1 + R2 together (dashboard/missions merge) — they touch the same layout
   files, do them in one pass.
3. R5 rename (cheap, unblocks honest naming immediately); scope R5 codegen as
   a separate, larger follow-up ticket.
4. R4 (approve-with-controls) — schema + API + UI, self-contained.
5. R6 (agent-team panel) — low effort, good visible win once R1/R2 land.
6. R7 (QA review layer) — largest net-new scope, do last.

## 6. Full comparison reference

A tabbed, cited comparison of both apps' actual signed-in product (functionality
and platform template) was published as a Claude Artifact and is the source for
everything above:

https://claude.ai/code/artifact/120020a5-2e14-4181-8559-9d6757b9971b

It includes the full snapshot table, the platform-template writeup (nav shell,
design tokens, page-composition pattern), the pipeline/gate comparison, the
council comparison, and the deliverable comparison, each with direct file
references on both sides.
