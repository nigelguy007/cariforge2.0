# Fundraise Loop — Operator Runbook

Audience: the founder or operator. Design: `docs/FUNDRAISE-LOOP-PLAN.md`.
Runner prompt: `ops/fundraise-loop/RUNNER-PROMPT.md`.
Dashboard: `{{APP_URL}}/admin/fundraise`, where `{{APP_URL}}` is the
production origin including basePath, for example `https://www.cariforge.com/888`.

The loop works like this. Each week a scheduled Claude routine finds
investors in 8Raise and drafts a batch. You approve it. The next run pushes
only approved people into your HeyReach campaign. You record outcomes, and
the allocation re-aims toward the segments that produce **meetings**.

---

## 1. One-time setup

Do these in order. Keep **sending OFF** for the whole first week, which is a
dry run.

| # | Step | How | Done when |
|---|---|---|---|
| 1 | Generate the runner token | `openssl rand -hex 32` | You have a 64-character hex string in your password manager |
| 2 | Set `FUNDRAISE_LOOP_TOKEN` in Vercel | Vercel → **cariforge2-0** → Settings → Environment Variables → Production. Repeat for **cariforgeplatform-web**. Redeploy both, because env changes apply only to new deployments. | `curl -s -o /dev/null -w '%{http_code}' -H "Authorization: Bearer $TOKEN" {{APP_URL}}/api/fundraise-loop/runner/plan` returns `200`. A `503` means the token is not set on that deployment. |
| 3 | Apply the migration | Point `DATABASE_URL` at production, then run `npm run db:migrate:deploy` | `20260929000000_add_fundraise_loop` shows as applied |
| 4 | Connect 8Raise MCP + HeyReach | Add the 8Raise connector to the Claude account that owns the routine. In the 8Raise dashboard, connect HeyReach. | `list_outreach_destinations` lists your campaigns |
| 5 | Review the seeded segments | `/admin/fundraise` → Segments. For each of the 5 seeds, edit `query`, `mode`, `lagDays`, and **`estUniverse`**. The seeded universe sizes are rough guesses. | Every segment has a universe size you can defend |
| 6 | Write the HeyReach sequence | In HeyReach, write the connection note and at most 2 follow-ups yourself. Run the copy through the `fundraise-copy-reviewer` subagent and fix the redlines. | The campaign is ACTIVE with reviewed copy. Note its ID. |
| 7 | Create the Claude routine | New scheduled routine (fresh session per fire) on this repo. The prompt is everything below the line in `RUNNER-PROMPT.md`, with placeholders filled. Add environment secret `FUNDRAISE_LOOP_TOKEN` and allow network access to the app host. Schedule it weekly on Monday morning in your time zone. | The routine exists and the first manual fire produces a report |
| 8 | Dry-run week | Leave `sendingEnabled` **off**. Let the routine draft, then approve or reject in the dashboard to check quality. The next fire reports "sending disabled". | You trust the batches |
| 9 | Go live | `/admin/fundraise` → Config → `sendingEnabled` on | The next fire pushes the approved batch |

**Env var reference** (there is no `.env.example` in this repo, so this is
the only place it is documented):

| Variable | Where | Purpose |
|---|---|---|
| `FUNDRAISE_LOOP_TOKEN` | Vercel (both projects) and the routine's environment secrets | Bearer token for `/api/fundraise-loop/runner/*`. The server compares it in constant time. If it is unset, those endpoints return 503. Local dev: add it to your untracked `.env.local`. |

**Routine placeholders:** `{{APP_URL}}`, `{{HEYREACH_CAMPAIGN_ID}}`,
`{{EIGHTRAISE_WORKSPACE}}`, `{{CREDITS_PER_LEAD}}` (credits 8Raise charges per
lead at your tier), `{{COMPANY_ONE_LINER}}`, and `{{RUN_MODE}}` (`full`).

## 2. Weekly operating rhythm

| When | Who | What | Time |
|---|---|---|---|
| Mon AM | Routine | **Send** last week's approved batch (if sending is on), then **draft** this week's batch. Posts a report. | — |
| Mon–Wed | Founder | Open `/admin/fundraise`. Skip anyone wrong, then **approve** or **reject** the batch. Handle warm intros (the `fundraise-warm-path-scout` subagent helps). | 15 min |
| Next Mon | Routine | **Claims** each approved batch (it shows as *Sending in progress*), pushes it into HeyReach, then records exactly who was pushed. Those people become SENT, anyone not pushed becomes UNSENT, and the batch becomes SENT. | — |
| Fri | Founder | Export replies and meetings from HeyReach and your calendar, then use **CSV import** on `/admin/fundraise`. Columns: `identifier` (LinkedIn URL, email, or `Name \| Firm`), `type`, `occurredAt`, and optionally `note`. | 10 min |
| Monthly | Founder | Ask the `fundraise-segment-analyst` subagent to explain the allocation. Decide on any pauses or new segments yourself. | 15 min |

Event types are `REPLY`, `MEETING`, `SECOND_MEETING`, `TERM_SHEET`, `PASS`,
and `BOUNCE`. Record meetings promptly, because meetings are what the loop
optimises for.

*Optional:* to send approved batches without waiting a week, add a second
routine on Wednesday with `RUN_MODE=send-only`.

### How a send works (claim → push → record)

1. **Claim.** The routine calls `POST /runner/batches/{id}/claim`. The
   server moves the batch from *Approved* to **Sending in progress** in one
   atomic step, and only while `sendingEnabled` is on. A second claim is
   refused, so two runs can never push the same batch.
2. **Push.** The routine pushes only the claimed people, matched by
   identity (LinkedIn handle), never by a whole search.
3. **Record.** The routine calls `POST /runner/batches/{id}/sent` with the
   exact ids it pushed. Those become **SENT**. Everyone else still queued in
   the batch becomes **UNSENT**. The batch becomes **SENT**. This step works
   even if you switch sending off mid-run, because it records what already
   happened.

**UNSENT** people were approved but never reached HeyReach (no LinkedIn
URL, an ambiguous name in the search, or a HeyReach error). They stay in the
"never contact twice" memory, so the loop never re-sources or re-pushes
them. The decided batch shows an "*n* not pushed (unsent)" badge. Add them in
HeyReach by hand if you still want to reach them.

**Stuck in SENDING.** If a run dies between claim and record, the batch
stays pinned at the top of the approval queue as *Sending in progress*, and
the run report says "stuck in SENDING". Open the HeyReach campaign and
check whether any of the batch's people were added:

- **Nobody was added:** click **Release (nothing was pushed)** and confirm.
  The batch goes back to *Approved* and the next run sends it.
- **Some or all were added:** do **not** release, because releasing would
  push them again. Leave the batch as it is (nobody in it will be
  auto-sent), handle the rest by hand in HeyReach, and ask the operator to
  record what was pushed with
  `POST /runner/batches/{id}/sent` `{"sentProspectIds": [...]}` using the
  runner token.

A *Sending in progress* batch cannot be rejected. Release it first if you
want to reject it.

## 3. How the allocation works (plain English)

Each week the batch (default **40**) is split across ACTIVE segments:

1. **Scoring.** A segment scores on meetings or better. A reply without a
   meeting counts as a quarter of a meeting. A silent contact counts as a
   "no" only after it is older than the segment's `lagDays`, so slow
   pensions and DFIs aren't punished for being slow.
2. **P(best).** The engine turns each segment's record into a probability
   that it is the best segment. Few data points means wide uncertainty, so
   early results barely move the split.
3. **Floors.** Every segment keeps a guaranteed floor. It gets **10 %**
   until it has **100** matured contacts, and **5 %** after that. It never
   drops to 0 unless *you* pause it. The rest of the batch goes to segments
   in proportion to P(best).
4. **Runway cap.** A segment gets at most remaining universe ÷ **8** per
   week, so no market is burned in under 8 weeks. Capacity freed by a capped
   segment goes to the others until the batch is full.
5. **Enforced on ingest.** The server rejects cold prospects beyond each
   segment's allocation, or beyond `batchSize` overall. The run report shows
   these as `overAllocation`, and they are not stored.

| Recommendation | Meaning | Your action |
|---|---|---|
| `insufficient-data` | Fewer than 100 matured trials | None. It is still exploring. |
| `keep` | Normal | None |
| `lean-in` | P(best) ≥ 50 % | Consider raising `estUniverse` if the market is bigger than you set, or approving a lookalike run |
| `consider-pausing` | ≥ 100 trials, P(best) < 5 %, and a hit rate under half the leader's | Decide. Pause in the dashboard if you agree. |
| `exhausted` | Universe fully contacted | Raise `estUniverse` if it was wrong, otherwise pause |

All thresholds are editable in Config: `batchSize`, `minSegmentShare`,
`explorationFloor`, `minTrialsBeforeCut`, and `minWeeksRunway`.

## 4. Failure modes & what to do

| Symptom | Likely cause | Action |
|---|---|---|
| Report says `STOPPED (503)` | Token not set on that Vercel deployment, or the app is down | Check the env var in both projects and redeploy. Re-fire manually. |
| `STOPPED (401/403)` | Token mismatch between the routine and Vercel | Re-copy the token into both places (see rotation) |
| Worried someone gets contacted twice | — | Dedupe is permanent and multi-key: every LinkedIn handle, email, and name+firm the loop has seen for a person is stored, and a new record matching **any** of them is a duplicate. Batches must be claimed before sending, and a claimed batch can't be claimed again. The exclusion list is re-uploaded to 8Raise every run, and warm-path people never enter a cold batch. To check a person, search the dashboard by LinkedIn URL. |
| Same person listed at two firms and two URLs, with no shared email | Nothing links the records | Skip them in the batch before approving |
| Batch shows *Sending in progress* for more than a day, or the report says "stuck in SENDING" | Run died or `/sent` failed after the claim | See "Stuck in SENDING" in §2. Release only if HeyReach shows nobody from the batch was added. |
| Report says "claim refused (409)" | Another run claimed it, or sending was switched off just before the claim | Nothing to do. If sending is on, the batch is either *Sending in progress* or already sent. |
| `overAllocation` above 0 in the report | The routine returned more people than the plan allowed | Nothing to do. The extras were dropped and can be sourced in a later week. |
| "Insufficient credits" | 8Raise monthly credits used up | Top up or wait for the reset. Lower `batchSize` if this recurs. The routine never scales down on its own. |
| "query needs founder refinement" | 8Raise asked clarifying questions | Rewrite that segment's `query` to be more specific (one sector keyword per Basic search) |
| Some approved people "not pushed" / UNSENT | No LinkedIn URL, a name that is ambiguous in the 8Raise search, or a HeyReach error | They are UNSENT and never pushed automatically. Add them to HeyReach by hand, or leave them. |
| HeyReach account limits or warnings | Too much LinkedIn volume | Keep daily volume inside HeyReach's safe limits for each sender account. LinkedIn caps weekly connection requests (commonly cited as about 100–200 per account; check HeyReach's current guidance). Lower `batchSize` or add a sender account. Never raise HeyReach's daily caps to catch up. |
| Campaign not ACTIVE | Paused in HeyReach | Resume it. The routine won't fall back to another destination. |
| Routine drafted twice in one week | Manual re-fire | No harm to data, because the server dedupes, but it spent credits. Reject the extra batch. Use `RUN_MODE=send-only` for manual re-fires. |

**Token rotation** (quarterly, or immediately if exposed):
1. Generate a new token.
2. Update it in both Vercel projects and redeploy.
3. Update the routine's secret.
4. Run the curl check from §1 step 2.

The old token dies when the redeploy lands.

**Kill switch:** `/admin/fundraise` → Config → `sendingEnabled` **off**.
No new batch can be claimed from that moment. The next run sends nothing and
still drafts. A batch already claimed when you flip it finishes recording
what it pushed. For a full stop, also disable
the routine and pause the HeyReach campaign. The campaign sends on its own
schedule once leads are in it.

## 5. Data & privacy

- The loop stores **public professional data only**: name, firm, title,
  LinkedIn URL, and an email only when 8Raise returned it. It never stores
  guessed emails, phones, or personal addresses. The runner is instructed to
  drop everything else.
- Admin endpoints require `role === 'admin'`. Runner endpoints require the
  bearer token.
- **Delete on request:** run `npm run db:studio` against production, then
  go to `FundraiseProspect` and find the person by LinkedIn URL or email.
  - *Preferred (keeps "never contact again"):* blank `fullName` to
    `[deleted]`, and set `firm`, `title`, `linkedinUrl`, `email`, `sourceRef`,
    and `warmPath` to null. Keep the row, its `dedupeKey`, and its
    `FundraiseIdentity` rows so the person is never re-sourced.
    `/runner/exclusions` is built from those identity keys, so it keeps
    suppressing them in 8Raise.
  - *Full erasure:* delete the row. Its `FundraiseEvent` and
    `FundraiseIdentity` rows cascade. Also
    delete the lead in 8Raise and HeyReach. Note that the person could then
    be re-sourced later.
  - Log the request date and action taken outside the database.
- Confirm your lawful basis for B2B outreach with counsel for each
  jurisdiction you target, for example GDPR or UK PECR.
