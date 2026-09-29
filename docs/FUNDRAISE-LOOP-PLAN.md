# CariForge Fundraise Loop — Build Plan

Status: approved for build (founder instruction, 2026-09-29). Owner: founder.
Governing skill: `fundraise-run` (+ `outreach-sequencer`, `autonomous-loops`).

## 1. What this is

An internal, admin-only module inside cariforge2.0 that runs CariForge's own
investor outreach as a **loop** — find → approve → send → measure → re-aim —
instead of one-off list pushes. 8Raise (via its MCP server) is the sourcing
engine; HeyReach (via 8Raise's `send_to_heyreach`) is the sending channel; the
cariforge2.0 Postgres database is the loop's durable memory.

It deliberately does **not** copy the 8fundraising article's design. It fixes
the seven weaknesses found when that design was stress-tested:

| # | Weakness in the article's loop | Fix built here |
|---|---|---|
| 1 | Re-aims on 1–3 replies/week (noise) | Bayesian (Beta) posteriors per segment + a minimum matured-sample rule before any segment can lose its floor |
| 2 | Optimises for *replies*, not money | Success = meeting-or-better; replies count only as a weak 0.25 pseudo-signal |
| 3 | Kills slow segments (pensions/DFIs) early | Per-segment reply-lag window: a contact only counts as a failure once it is older than that segment's lag |
| 4 | Burns a finite market | Universe-size estimate per segment + weekly cap so no segment is exhausted in < N weeks; burn % on the dashboard |
| 5 | Permanent exclusion of weak first touches | Dedupe is permanent (correct), but every send is human-approved first so weak touches don't happen at volume |
| 6 | Memory in a local CSV | Postgres tables with a unique normalised dedupe key; runner re-uploads the exclusion list to 8Raise each run |
| 7 | Optimises only the cold channel | Warm-path lane: any prospect with a known warm path is diverted to an intro-request list and never cold-sent |

Plus one control the article omits entirely: a **global kill switch**
(`sendingEnabled`, default **off**) and a **human approval gate** on every batch.

## 2. Objectives and expected outcomes

| Objective | Measurable outcome | How we'll know |
|---|---|---|
| O1 Never contact the same investor twice | 0 duplicate sends | Every identity key (LinkedIn, email, name+firm) unique in `FundraiseIdentity` + server-side send claim + exclusion upload; unit-tested normaliser |
| O2 Every send is human-approved | 0 sends from a batch not in `APPROVED` | Server-enforced state machine; runner endpoint refuses otherwise |
| O3 Aim at segments that produce *meetings* | Allocation shifts only with ≥ min matured trials | Allocation engine unit tests; dashboard shows P(best) + "insufficient data" |
| O4 Don't exhaust the market | No segment projected to exhaust in < 8 weeks | Burn forecaster + weekly cap; dashboard runway column |
| O5 Warm paths beat cold | Warm-path prospects never enter a cold batch | Lane classification test; separate intro list |
| O6 Loop state survives restarts | All state in Postgres | Prisma models + migration |
| O7 Runs weekly without the founder building lists | Scheduled Claude routine drafts the batch; founder only approves + takes calls | Runner prompt + endpoints; routine created after deploy |

**Out of scope (and why):** auto-replying to investors (Ignacio's rule — the
human moment stays human); LLM-written first-touch copy without founder review;
storing inferred private contact data (skill evidence standard forbids it).

## 3. Architecture

```
 Claude routine (weekly)                       cariforge2.0 (Vercel + Supabase)
 ─────────────────────────                     ─────────────────────────────────
 1 GET  /api/fundraise-loop/runner/plan  ───▶  allocation engine → {segment: n}
 2 8Raise search_investors per segment
   (exclusion list uploaded first)
 3 POST /api/fundraise-loop/runner/batches ──▶ multi-key dedupe (li/em/nf via
                                               FundraiseIdentity) + per-segment
                                               allocation cap → batch
                                               PENDING_APPROVAL
                                               ▲
 Founder: /admin/fundraise  ── approve / skip items / reject ──┘
 4 GET  …/runner/batches/approved          ──▶ APPROVED batches (empty unless
                                               sendingEnabled)
 5 POST …/runner/batches/:id/claim         ──▶ APPROVED → SENDING, atomic, only
                                               if sendingEnabled; 2nd claim 409
 6 8Raise send_to_heyreach (claimed cold prospects only, by identity)
 7 POST …/runner/batches/:id/sent          ──▶ {sentProspectIds}: those SENT,
    (always, even if kill switch flipped)      the rest UNSENT; batch SENT
                                               ▲
 Founder: stuck SENDING batch ── verify in HeyReach ── release → APPROVED
 8 POST …/runner/events  (replies/meetings) ─▶ outcome events → posteriors
```

Batch states: `PENDING_APPROVAL → APPROVED | REJECTED`;
`APPROVED → SENDING | REJECTED`; `SENDING → SENT` (runner `/sent`);
`SENDING → APPROVED` only via the admin `release` action (a human confirmed
nothing was pushed). `REJECTED` and `SENT` are terminal. A `SENDING` batch
can't be listed, claimed again, or rejected, so a crash or kill-switch flip
mid-run can never cause a double push.

Runner endpoints authenticate with a bearer token (`FUNDRAISE_LOOP_TOKEN`,
constant-time compare; endpoints return 503 when it is unset). Admin endpoints
use the existing better-auth `role === 'admin'` gate.

## 4. Algorithm (allocation engine)

- Per segment: `trials` = sent prospects that have an outcome **or** are older
  than the segment's `lagDays`; `successes` = meeting-or-better; `+0.25` per
  reply-only.
- Posterior `Beta(1 + s, 1 + trials − s)`; seeded Monte Carlo (2,000 draws)
  estimates P(segment is best).
- Share = floor + (1 − Σfloors) × P(best). Floor = `minSegmentShare` until the
  segment has `minTrialsBeforeCut` matured trials, then `explorationFloor`.
  Never zero unless a human pauses the segment.
- Cap each segment at `remaining / minWeeksRunway` and at `remaining`.
- Largest-remainder rounding to integers; capacity freed by capped segments is
  redistributed pass after pass until the batch is full or every segment is
  capped (Σ = min(batchSize, Σcaps)). Segments with a zero target get leftover
  only once every positive-target segment is capped.
- Recommendation `consider-pausing` only when matured trials ≥ threshold AND
  P(best) < 5% AND posterior mean < ½ of the leader's. It is a recommendation;
  pausing is a human action.

## 5. How it is produced (process)

1. **Skill**: `fundraise-run` governs scope, evidence rules and "no contact
   without authorisation"; `outreach-sequencer` sets the wave/learning-loop
   shape; `autonomous-loops` sets the scheduled-runner pattern.
2. **Ruflo**: swarm initialised (hierarchical, 6 agents), decisions stored in
   ruflo memory, change-risk analysis run on the final diff.
3. **Agents** (build): Architect (me) writes the spine — schema, contracts,
   engine, tests. Then in parallel: API agent, UI agent, Ops agent. Then a
   Reviewer agent audits security + correctness before push.
4. **Agents** (operate, committed in `.claude/agents/`): loop runner, segment
   analyst, outreach copy reviewer, warm-path scout.
5. **Gates**: typecheck, Biome lint, Vitest must pass before push. No PR, no
   deploy, no routine creation, no investor contact without founder go-ahead.

## 6. Assumptions (label: inferred — founder to confirm)

| Input | Status | Value used |
|---|---|---|
| Round type / amount / instrument | unknown | Not needed for the loop; needed before copy is written |
| Target segments | inferred | 5 seed segments (see `seed.ts`), all editable |
| Universe sizes | inferred | Rough estimates; edit in admin before first run |
| Cadence | inferred | Weekly, 40 prospects/batch |
| Sending channel | provided | HeyReach via 8Raise |
