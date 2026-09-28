// @polsia:user-owned — async, chunked SoftwareBuild generation (2026-09-06).
// See prisma/schema/forge.prisma's SoftwareBuildJob model comment for the
// full "why": this project's Vercel plan (Hobby) kills any serverless
// function at 60s, but a real MVP's file/spec generation genuinely needs
// ~150s — confirmed live as the actual cause of "says Working… then
// crashes" on the Build stage. User's explicit choice over upgrading to
// Vercel Pro: stay on Hobby, make the generation itself resumable.
//
// Shape: one HTTP request (build-job/route.ts) advances the job by
// exactly ONE bounded step and returns. The binding per-request limit is
// now the 120s proxied-request timeout of the www.cariforge.com/888 Vercel
// external rewrite users come through (2026-09-28), so each step makes at
// most one AI call, sized to fit it where possible (see FILE_ATTEMPTS for
// the one deliberate exception, a last-resort third attempt):
//   Planning   — one AI call: the file list (path + one-line purpose) and
//                the full technical spec, NO file content yet. A failed
//                plan is retried once on the next poll before failing.
//   Generating — one AI call per poll: this step's ONE target file's full
//                content, given the plan and what's already been written.
//                A failed file is retried on the next poll (up to 3
//                attempts — see FILE_ATTEMPTS) before the job fails.
// Each step is single-flight: a request claims the current step with a
// lease (see "Single-flight" below) before its AI call, and any other
// request arriving meanwhile (a double click, a second tab, or the client
// re-polling after the proxy dropped a long attempt's reply) waits for
// that attempt instead of starting a duplicate.
//   Finalizing — no AI call: assemble the completed payload and run the
//                exact same submitHandoff + reviewAndMaybeAdvance path the
//                synchronous stages already use.
// The client (next-action-card.tsx) polls this forward until Done/Failed.
import 'server-only';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import type { Prisma } from '@prisma/client';
import { z as z4 } from 'zod/v4';
import type { MissionDetailT } from '@/lib/contracts/forge';
import { prisma } from '@/lib/db';
import { getClient } from './ai-draft';
import { reviewAndMaybeAdvance } from './auto-advance';
import { assessStep, type BuildStep, retryMarker, runMarker } from './build-job-markers';
import { getMissionDetail, submitHandoff } from './service';

const PlannedFileV4 = z4.object({
  path: z4.string(),
  // A concrete, one-sentence brief for what this file must contain — the
  // ONLY context the later per-file call gets about this file's intent,
  // so vague purposes here directly cause vague generated files.
  purpose: z4.string(),
});

// Same field set as ai-draft.ts's SoftwareBuildDraftV4, minus file
// CONTENT (that's generated one file at a time in the Generating phase —
// see the file header). Every field required, never `.optional()` — see
// ai-draft.ts's StepDraftV4 comment for the real, confirmed incident
// (mostly-optional fields hanging indefinitely against this Gateway) that
// rule protects against.
const SoftwareBuildPlanV4 = z4.object({
  summary: z4.string(),
  scope: z4.array(z4.string()),
  checksPassed: z4.array(z4.string()),
  missingEvidence: z4.array(z4.string()),
  architectureOverview: z4.string(),
  techStack: z4.array(z4.string()),
  dataModel: z4.string(),
  apiSurface: z4.array(z4.string()),
  deploymentNotes: z4.string(),
  files: z4.array(PlannedFileV4).min(5).max(20),
  confidence: z4.number().min(0).max(1),
});
type SoftwareBuildPlan = z4.infer<typeof SoftwareBuildPlanV4>;

// What the planning call is actually asked for and parsed against: the
// same shape, minus the `.max(20)` on `files`. zodOutputFormat strips array
// bounds from the JSON schema it sends to the model, but safeParse still
// enforces them — confirmed live (2026-09-28): the model returned more than
// 20 files and the whole plan was rejected ("Too big: expected array to
// have <=20 items"), losing a ~43s call. The list is dependency-ordered, so
// planSoftwareBuild keeps the first MAX_PLANNED_FILES instead of rejecting.
const SoftwareBuildPlanParseV4 = SoftwareBuildPlanV4.extend({
  files: z4.array(PlannedFileV4).min(5),
});
const MAX_PLANNED_FILES = 20;

const FileContentV4 = z4.object({ content: z4.string() });

interface GeneratedFile {
  readonly path: string;
  readonly content: string;
}

// Same check as ai-draft.ts's isSafeRelativePath — duplicated on purpose:
// it's four lines, and importing a non-exported helper across files for
// something this small invites drift worse than one more copy would.
function isSafeRelativePath(path: string): boolean {
  if (!path || path.startsWith('/') || path.includes('..')) return false;
  const segments = path.split('/');
  return segments.every((s) => s.length > 0 && s !== '.' && s !== '..');
}

async function planSoftwareBuild(args: {
  need: string;
  priorContext: readonly string[];
  feedback: readonly string[];
  evidence: readonly { label: string; kind: string }[];
}): Promise<SoftwareBuildPlan | null> {
  const client = getClient();
  if (!client) return null;

  const contextBlock =
    args.priorContext.length > 0
      ? `\n\nWhat earlier steps already established (the need, the workflow, the governance controls — build to match all of it, not just the raw need):\n${args.priorContext.map((c, i) => `${i + 1}. ${c}`).join('\n')}`
      : '';
  const feedbackBlock =
    args.feedback.length > 0
      ? `\n\nA prior attempt at this build had these unresolved reviewer concerns — address them directly in this plan:\n${args.feedback.map((c, i) => `${i + 1}. ${c}`).join('\n')}`
      : '';
  const evidenceBlock =
    args.evidence.length > 0
      ? `\n\nEvidence already attached to this project (reference it where relevant):\n${args.evidence.map((e, i) => `${i + 1}. ${e.label} (${e.kind})`).join('\n')}`
      : '';

  const system = `You are CariForge, PLANNING the "SoftwareBuild" step of a governed project —
the point where an approved plan becomes a real, production-quality MVP:
a genuine Next.js (App Router) + TypeScript implementation, not a generic
template or a placeholder. This is a planning pass only: decide the file
list and the technical specification. Do NOT write file content here —
that happens one file at a time in a later step, so keep to path +
one-line purpose per file.

List 8-15 real files that together implement the workflow described
below — the real pages/routes, the real data model, and the real core
logic implied by the need, workflow steps and governance controls already
established. Always include a package.json and a README.md among them.
Order the list so a file's own dependencies (e.g. a lib module a page
imports) come BEFORE the files that use them — later generation steps
only see files earlier in this order, not later ones.

Also produce the real technical specification:
- architectureOverview: 2-4 paragraphs — the actual shape of the
  solution, grounded in the file list above, not generic boilerplate.
- techStack: the real technologies/libraries this build actually uses.
- dataModel: the key entities and their relationships/fields.
- apiSurface: the real routes/endpoints this build exposes (method + path
  + one-line purpose each), empty only if genuinely none.
- deploymentNotes: what a team needs to do to actually run/deploy this
  (environment variables, external services, build steps) — concrete.

Also fill: summary (what this build covers, one paragraph), scope (bullet
list of what it covers), checksPassed (acceptance checks it satisfies),
missingEvidence (concrete gaps outside this MVP's scope — a real
integration needing credentials you don't have, security hardening and
load testing before real traffic, edge cases outside the described
workflow — empty only if genuinely none).

Set confidence (0-1) honestly: lower if the described workflow was vague.`;

  const userMessage = `The need, as described: ${args.need}${contextBlock}${evidenceBlock}${feedbackBlock}`;

  try {
    const response = await client.messages.parse(
      {
        model: 'anthropic/claude-sonnet-5',
        // 4_000 truncated the plan JSON ("Unterminated string in JSON") in
        // 4 of 5 live attempts (2026-09-28), each ~43s at ~93 output
        // tokens/s. 8_000 gives the plan room (~86s at that rate), inside
        // the 115s timeout below.
        max_tokens: 8_000,
        output_config: { effort: 'medium', format: zodOutputFormat(SoftwareBuildPlanParseV4) },
        system,
        messages: [{ role: 'user', content: userMessage }],
      },
      // Users reach the app through the www.cariforge.com/888 Vercel
      // external rewrite, documented with a hard 120s proxied-request
      // limit — 115s leaves room for the job reads/writes around this call.
      { timeout: PLAN_TIMEOUT_MS },
    );
    if (!response.parsed_output) return null;
    const parsed = SoftwareBuildPlanParseV4.safeParse(response.parsed_output);
    if (!parsed.success) return null;
    const safeFiles = parsed.data.files
      .filter((f) => isSafeRelativePath(f.path))
      .slice(0, MAX_PLANNED_FILES);
    if (safeFiles.length === 0) return null;
    return { ...parsed.data, files: safeFiles };
  } catch (err) {
    console.error('[forge] planSoftwareBuild failed:', err);
    return null;
  }
}

// File length varies enormously across a real 8-15 file MVP (a
// package.json vs. a real upload/validation API route), so no single
// static max_tokens is safe for every file. Confirmed live twice
// (2026-09-06): 4_000 truncated mid-JSON on one file
// ("lib/disclosureRules.ts"), and even after raising it to 8_192 a
// DIFFERENT, longer file ("app/api/claims/upload/route.ts") hit the
// exact same "Unterminated string in JSON..." failure — the JSON-
// escaped {content: "..."} wrapper plus this system prompt's own
// demand for real validation/error-handling means some files
// genuinely need more room than others. That originally became a
// second, larger attempt (20_000 tokens / 150s) inside the SAME request,
// but that can push one request past the 120s proxied-request limit of
// the www.cariforge.com rewrite, and timeouts weren't retried at all —
// confirmed live (2026-09-28): one 90s timeout at file 18/20 failed the
// whole build. Now each request makes exactly ONE call, and a failed file
// (timeout, truncation, bad/empty output) is retried on the client's NEXT
// poll with an escalating budget, up to FILE_ATTEMPTS.length attempts,
// before the job is marked Failed.
//
// Output is capped by the timeout, not just max_tokens: at the ~93
// output tokens/s observed live, 100s is ~9_300 tokens, 125s ~11_600 and
// 230s ~21_400. Attempt 1 fits the rewrite's documented 120s limit.
// Attempt 2 (125s) leans on a 131s request observed succeeding through
// that same rewrite (2026-09-28). Attempt 3 (230s) is a deliberate last
// resort for a genuinely long file: its reply may be lost to the browser
// at the proxy, but the server keeps running (route maxDuration 280s) and
// still saves the file; the client's re-poll waits on that attempt's lease
// (see "Single-flight" below) rather than starting a duplicate.
interface FileAttemptBudget {
  readonly maxTokens: number;
  readonly timeoutMs: number;
}
const FILE_ATTEMPTS: readonly [FileAttemptBudget, ...FileAttemptBudget[]] = [
  { maxTokens: 8_192, timeoutMs: 100_000 },
  { maxTokens: 12_000, timeoutMs: 125_000 },
  { maxTokens: 20_000, timeoutMs: 230_000 },
];

// Planning gets one retry (two attempts, same budget) on the next poll.
const PLAN_TIMEOUT_MS = 115_000;
const PLAN_ATTEMPT_TIMEOUTS: readonly number[] = [PLAN_TIMEOUT_MS, PLAN_TIMEOUT_MS];
const FILE_ATTEMPT_TIMEOUTS: readonly number[] = FILE_ATTEMPTS.map((a) => a.timeoutMs);

// Single-flight + retry tracking, without a schema change: the nullable
// SoftwareBuildJob.error column doubles as a per-step LEASE and RETRY
// marker (formats and parsers in build-job-markers.ts), and only holds a
// human message once the job is Failed. It is never shown to users — the
// route only returns BuildJobResult, and no response here includes it.
//   run:<step>:<attempt>:<startedAtMs>  an attempt is in flight
//   retry:<step>:<failedCount>          the last attempt failed
// where <step> is `plan` or the file index. Why: confirmed in the local e2e
// harness (2026-09-28) — after the proxy dropped attempt 3's reply at 120s,
// the client's re-poll started a DUPLICATE attempt 3 for the same file;
// the duplicate failed first and marked the job Failed, then the original
// succeeded but its conditional write no-oped, so a good file was thrown
// away and the build lost. Now, per step:
//   1. A live lease for this step (younger than that attempt's timeout +
//      LEASE_GRACE_MS) → no AI call; long-poll the job for up to
//      LONG_POLL_MS and report what it becomes (waitWhileInFlight).
//   2. A stale lease (the function was killed before writing) counts as
//      that attempt having failed.
//   3. Claim the next attempt with a conditional write on the exact
//      `error` value observed; losing that race means another request
//      claimed or advanced the step → report current state, no AI call.
//   4. The result write is conditional on still holding OUR lease, so a
//      lease taken over as stale can never be overwritten by a late result.
// Finalize makes no AI call of its own, but reviewAndMaybeAdvance does:
// for SoftwareBuild, one Oracle review and at most one reconciliation,
// each bounded by getClient()'s 45s timeout (no redraft for this stage —
// see auto-advance.ts). 2 x 45s plus the handoff/DB writes and margin.
const FINALIZE_BUDGET_MS = 150_000;
const FINALIZE_ATTEMPT_TIMEOUTS: readonly number[] = [FINALIZE_BUDGET_MS];

const LONG_POLL_MS = 25_000;
const LONG_POLL_INTERVAL_MS = 2_000;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function generateFileContent(args: {
  plan: SoftwareBuildPlan;
  targetPath: string;
  targetPurpose: string;
  doneSoFar: readonly GeneratedFile[];
  /** 1-based; picks this call's budget from FILE_ATTEMPTS. */
  attempt: number;
}): Promise<{ ok: true; content: string } | { ok: false; error: unknown }> {
  const client = getClient();
  if (!client) return { ok: false, error: new Error('AI client unavailable') };

  // Full content of already-generated files the target file might
  // reasonably import from or need to match the shape of — capped so this
  // one call stays fast; a long tail of unrelated earlier files would only
  // add tokens/latency without adding useful context for THIS file.
  const relevantPriorFiles = args.doneSoFar.slice(-6);
  const priorFilesBlock =
    relevantPriorFiles.length > 0
      ? `\n\nFiles already written in this build (match their real exports/shapes exactly — do not invent a different interface for something already defined):\n${relevantPriorFiles.map((f) => `--- ${f.path} ---\n${f.content}`).join('\n\n')}`
      : '';
  const allPathsBlock = `\n\nThe full planned file list for this build (for context on what exists elsewhere, even if not shown above):\n${args.plan.files.map((f) => `- ${f.path}: ${f.purpose}`).join('\n')}`;

  const system = `You are CariForge, writing ONE real file for the "SoftwareBuild" step of a
governed project — a production-quality MVP, not a placeholder or a
"hello world". Build it to production-quality standards for its scope:
real input validation, real error handling (no swallowed errors, no
bare happy-path-only logic), and code a second developer could pick up
cold. Keep the file focused and under ~400 lines: if a full
implementation would be longer, implement the core path completely and
note in a code comment what remains. Either way the file you return must
be complete and valid — never stop mid-file, never hardcode a real
secret/API key.

Architecture this file must fit (already decided): ${args.plan.architectureOverview}
Tech stack: ${args.plan.techStack.join(', ')}
Data model: ${args.plan.dataModel}
${allPathsBlock}${priorFilesBlock}

Write the COMPLETE, real content for exactly this one file:
Path: ${args.targetPath}
Purpose: ${args.targetPurpose}`;

  const budget = FILE_ATTEMPTS[args.attempt - 1] ?? FILE_ATTEMPTS[0];
  try {
    const response = await client.messages.parse(
      {
        model: 'anthropic/claude-sonnet-5',
        max_tokens: budget.maxTokens,
        output_config: { effort: 'medium', format: zodOutputFormat(FileContentV4) },
        system,
        messages: [{ role: 'user', content: `Write ${args.targetPath} now.` }],
      },
      // Overrides getClient()'s 45s default for THIS call only. That
      // default was set for a different, already-diagnosed pathology
      // (ai-draft.ts's getClient() comment: a mostly-optional
      // 17-field schema hanging indefinitely against this Gateway —
      // raising the timeout there provably didn't help since the call
      // never progressed at all). FileContentV4 has exactly one
      // required field, so it doesn't fit that failure shape —
      // confirmed live (2026-09-06) this call instead failed with a
      // clean "Request timed out." partway through, i.e. it was still
      // actively generating, not hung. The ceiling that matters now is
      // the 120s proxied-request limit of the www.cariforge.com rewrite —
      // see FILE_ATTEMPTS for how each attempt's timeout relates to it.
      { timeout: budget.timeoutMs },
    );
    if (!response.parsed_output) return { ok: false, error: new Error('No parsed output') };
    const parsed = FileContentV4.safeParse(response.parsed_output);
    return parsed.success
      ? { ok: true, content: parsed.data.content }
      : { ok: false, error: parsed.error };
  } catch (err) {
    return { ok: false, error: err };
  }
}

export type BuildJobResult =
  | { readonly status: 'Planning' | 'Finalizing' }
  | { readonly status: 'Generating'; readonly progress: { current: number; total: number } }
  | { readonly status: 'Done'; readonly detail: MissionDetailT }
  | { readonly status: 'Failed'; readonly error: string };

/** A conditional write matched nothing: another, overlapping request
 *  already moved this job on. Re-read it and report where it actually is,
 *  rather than overwriting that newer state. */
async function currentJobState(
  jobId: string,
  args: { missionId: string; userId: string; isAdmin: boolean },
): Promise<BuildJobResult> {
  const current = await prisma.softwareBuildJob.findUnique({ where: { id: jobId } });
  const generic: BuildJobResult = {
    status: 'Failed',
    error: 'CariForge could not continue this build right now. Try again shortly.',
  };
  if (!current) return generic;
  switch (current.status) {
    case 'Planning':
    case 'Finalizing':
      return { status: current.status };
    case 'Generating': {
      const plan = current.plan as unknown as SoftwareBuildPlan | null;
      return {
        status: 'Generating',
        progress: { current: current.nextFileIndex, total: plan?.files.length ?? 0 },
      };
    }
    case 'Done': {
      const detail = await getMissionDetail(args.missionId, args.userId, args.isAdmin);
      return detail ? { status: 'Done', detail } : generic;
    }
    default:
      return generic;
  }
}

/** Another request holds a live lease on this step: don't start a second
 *  AI call. Re-read the job every LONG_POLL_INTERVAL_MS for up to
 *  LONG_POLL_MS (keeping this request well under 30s) and report its state
 *  as soon as the step moves on (status, file index or marker changed), or
 *  its unchanged progress when the window ends — the client polls again. */
async function waitWhileInFlight(
  observed: { id: string; status: string; nextFileIndex: number; error: string | null },
  args: { missionId: string; userId: string; isAdmin: boolean },
): Promise<BuildJobResult> {
  const deadline = Date.now() + LONG_POLL_MS;
  while (Date.now() < deadline) {
    await sleep(Math.min(LONG_POLL_INTERVAL_MS, deadline - Date.now()));
    const current = await prisma.softwareBuildJob.findUnique({ where: { id: observed.id } });
    if (
      !current ||
      current.status !== observed.status ||
      current.nextFileIndex !== observed.nextFileIndex ||
      current.error !== observed.error
    ) {
      break;
    }
  }
  return currentJobState(observed.id, args);
}

/** Marks the job Failed with `stored` (the human message kept on the row),
 *  only if it still matches `where`; otherwise reports its current state. */
async function markFailed(
  where: Prisma.SoftwareBuildJobWhereInput & { id: string },
  stored: string,
  args: { missionId: string; userId: string; isAdmin: boolean },
): Promise<BuildJobResult> {
  const failed = await prisma.softwareBuildJob.updateMany({
    where,
    data: { status: 'Failed', error: stored },
  });
  if (failed.count === 0) return currentJobState(where.id, args);
  return { status: 'Failed', error: `${stored} Try again shortly.` };
}

/** Advances (creating if needed) the active SoftwareBuildJob for this
 *  mission by exactly one bounded step, and returns its new state. Safe
 *  to call repeatedly from a client poll loop — each call does real work
 *  and persists progress before returning, so a call that itself times
 *  out or fails only loses ONE file's worth of work, not the whole build —
 *  and that file is retried on the next call before the job is failed. */
export async function advanceSoftwareBuildJob(args: {
  missionId: string;
  userId: string;
  isAdmin: boolean;
  ownerUserId: string;
  need: string;
  priorContext: readonly string[];
  feedback: readonly string[];
  evidence: readonly { label: string; kind: string }[];
}): Promise<BuildJobResult> {
  let job = await prisma.softwareBuildJob.findFirst({
    where: { missionId: args.missionId, status: { in: ['Planning', 'Generating', 'Finalizing'] } },
    orderBy: { createdAt: 'desc' },
  });
  if (!job) {
    job = await prisma.softwareBuildJob.create({
      data: { missionId: args.missionId, createdById: args.userId, status: 'Planning' },
    });
  }

  // The lease this request currently holds, if any. The catch-all below
  // may only fail a job while this request still holds its lease: a
  // WAITER's transient DB error must never fail the job (and discard the
  // holder's good attempt), and a released lease can't flip Done → Failed.
  let heldLease: string | null = null;
  // Every async return inside this try is `return await` on purpose: a bare
  // `return promise` would let its rejection skip the catch below.
  try {
    if (job.status === 'Planning') {
      const planFailed = 'CariForge could not plan this build right now.';
      const observed = { id: job.id, status: 'Planning' as const, error: job.error };
      const step = assessStep(job.error, 'plan', PLAN_ATTEMPT_TIMEOUTS, Date.now());
      if (step.kind === 'in-flight') return await waitWhileInFlight(job, args);
      if (step.kind === 'exhausted') return await markFailed(observed, planFailed, args);
      const lease = runMarker('plan', step.attempt, Date.now());
      const claimed = await prisma.softwareBuildJob.updateMany({
        where: observed,
        data: { error: lease },
      });
      if (claimed.count === 0) return await currentJobState(job.id, args);
      heldLease = lease;
      // Every write from here on requires still holding OUR lease.
      const held = { id: job.id, status: 'Planning' as const, error: lease };

      const plan = await planSoftwareBuild({
        need: args.need,
        priorContext: args.priorContext,
        feedback: args.feedback,
        evidence: args.evidence,
      });
      if (!plan) {
        if (step.attempt < PLAN_ATTEMPT_TIMEOUTS.length) {
          // Not fatal yet: stay Planning and let the client's next poll
          // (it keeps polling on { status: 'Planning' }) plan again.
          console.warn(
            `[forge] planSoftwareBuild failed (attempt ${step.attempt}/${PLAN_ATTEMPT_TIMEOUTS.length}), will retry`,
          );
          const marked = await prisma.softwareBuildJob.updateMany({
            where: held,
            data: { error: retryMarker('plan', step.attempt) },
          });
          if (marked.count === 0) return await currentJobState(job.id, args);
          return { status: 'Planning' };
        }
        return await markFailed(held, planFailed, args);
      }
      const saved = await prisma.softwareBuildJob.updateMany({
        where: held,
        data: { plan, status: 'Generating', nextFileIndex: 0, error: null },
      });
      if (saved.count === 0) return await currentJobState(job.id, args);
      return { status: 'Generating', progress: { current: 0, total: plan.files.length } };
    }

    if (job.status === 'Generating') {
      const plan = job.plan as unknown as SoftwareBuildPlan;
      const doneFiles = job.files as unknown as GeneratedFile[];
      const target = plan.files[job.nextFileIndex];
      if (!target) {
        // Shouldn't happen (nextFileIndex tracked alongside files below),
        // but finalize rather than loop forever if it ever does.
        await prisma.softwareBuildJob.update({
          where: { id: job.id },
          data: { status: 'Finalizing' },
        });
        return { status: 'Finalizing' };
      }
      const fileFailed = `CariForge could not generate ${target.path}.`;
      const fileStep: BuildStep = job.nextFileIndex;
      // Every write below is conditional on the job still being on THIS
      // file with the marker we observed/claimed, so a slow, overlapping
      // request can never move a job that has since been advanced,
      // finalized, failed or re-leased backwards — it reports that job's
      // current state instead.
      const observed = {
        id: job.id,
        status: 'Generating' as const,
        nextFileIndex: job.nextFileIndex,
        error: job.error,
      };
      const step = assessStep(job.error, fileStep, FILE_ATTEMPT_TIMEOUTS, Date.now());
      if (step.kind === 'in-flight') return await waitWhileInFlight(job, args);
      if (step.kind === 'exhausted') return await markFailed(observed, fileFailed, args);
      const attempt = step.attempt;
      const lease = runMarker(fileStep, attempt, Date.now());
      const claimed = await prisma.softwareBuildJob.updateMany({
        where: observed,
        data: { error: lease },
      });
      if (claimed.count === 0) return await currentJobState(job.id, args);
      heldLease = lease;
      const held = { ...observed, error: lease };

      const generated = await generateFileContent({
        plan,
        targetPath: target.path,
        targetPurpose: target.purpose,
        doneSoFar: doneFiles,
        attempt,
      });
      if (!generated.ok) {
        if (attempt < FILE_ATTEMPTS.length) {
          // Not fatal yet: leave nextFileIndex/files alone and record the
          // attempt, so the client's next poll retries this same file with
          // the next (larger) budget — see FILE_ATTEMPTS.
          console.warn(
            `[forge] generateFileContent failed for ${target.path} (attempt ${attempt}/${FILE_ATTEMPTS.length}), will retry:`,
            generated.error,
          );
          const marked = await prisma.softwareBuildJob.updateMany({
            where: held,
            data: { error: retryMarker(fileStep, attempt) },
          });
          if (marked.count === 0) return await currentJobState(job.id, args);
          return {
            status: 'Generating',
            progress: { current: job.nextFileIndex, total: plan.files.length },
          };
        }
        console.error(
          `[forge] generateFileContent failed for ${target.path} (attempt ${attempt}/${FILE_ATTEMPTS.length}), giving up:`,
          generated.error,
        );
        return await markFailed(held, fileFailed, args);
      }
      const updatedFiles: GeneratedFile[] = [
        ...doneFiles,
        { path: target.path, content: generated.content },
      ];
      const nextIndex = job.nextFileIndex + 1;
      const nowDone = nextIndex >= plan.files.length;
      const saved = await prisma.softwareBuildJob.updateMany({
        where: held,
        data: {
          // Cast, not `any`: GeneratedFile's `readonly` fields don't
          // structurally satisfy Prisma's mutable InputJsonObject index
          // signature, even though the runtime value is plain, valid
          // JSON — a real TS structural-typing gap for readonly-field
          // interfaces, not a type-safety hole (updatedFiles' shape is
          // fully known and controlled above).
          files: updatedFiles as unknown as Prisma.InputJsonValue,
          nextFileIndex: nextIndex,
          status: nowDone ? 'Finalizing' : 'Generating',
          // Releases our lease (the next file starts unclaimed).
          error: null,
        },
      });
      if (saved.count === 0) return await currentJobState(job.id, args);
      return nowDone
        ? { status: 'Finalizing' }
        : { status: 'Generating', progress: { current: nextIndex, total: plan.files.length } };
    }

    // job.status === 'Finalizing': no AI call of its own — assemble the
    // completed payload and hand off through the EXACT same write path
    // every other stage already uses (submitHandoff + reviewAndMaybeAdvance).
    // Leased like every other step, so two tabs (or a re-poll after a lost
    // reply) can never submit the handoff twice. One attempt: a failed or
    // stale finalize marks the job Failed (the user can start again).
    const observed = { id: job.id, status: 'Finalizing' as const, error: job.error };
    const step = assessStep(job.error, 'finalize', FINALIZE_ATTEMPT_TIMEOUTS, Date.now());
    if (step.kind === 'in-flight') return await waitWhileInFlight(job, args);
    if (step.kind === 'exhausted') {
      return await markFailed(observed, 'CariForge could not continue this build right now.', args);
    }
    const lease = runMarker('finalize', step.attempt, Date.now());
    const claimed = await prisma.softwareBuildJob.updateMany({
      where: observed,
      data: { error: lease },
    });
    if (claimed.count === 0) return await currentJobState(job.id, args);
    heldLease = lease;

    const plan = job.plan as unknown as SoftwareBuildPlan;
    const files = job.files as unknown as GeneratedFile[];
    const { files: _planFiles, ...specRest } = plan;
    const payload: Record<string, unknown> = { ...specRest, files };

    const updated = await submitHandoff({
      missionId: args.missionId,
      userId: args.userId,
      isAdmin: args.isAdmin,
      stage: 'SoftwareBuild',
      payload,
      confidence: plan.confidence,
      missingEvidence: [...plan.missingEvidence],
      toolRefs: [],
    });
    const newHandoff = updated.handoffs.find(
      (h) => h.stage === 'SoftwareBuild' && h.supersededById === null,
    );
    if (newHandoff) {
      await reviewAndMaybeAdvance({
        missionId: args.missionId,
        ownerUserId: args.ownerUserId,
        gateIndex: newHandoff.gateIndexThatApproves,
        stage: 'SoftwareBuild',
        handoffId: newHandoff.id,
        draftSummary: plan.summary,
        draftConfidence: plan.confidence,
        draftMissingEvidence: plan.missingEvidence,
      });
    }
    // Clearing the lease with Done also releases it, so nothing after this
    // (e.g. a failing getMissionDetail) can flip the job back to Failed.
    const finished = await prisma.softwareBuildJob.updateMany({
      where: { ...observed, error: lease },
      data: { status: 'Done', error: null },
    });
    heldLease = null;
    if (finished.count === 0) return await currentJobState(job.id, args);
    const final = (await getMissionDetail(args.missionId, args.userId, args.isAdmin)) ?? updated;
    return { status: 'Done', detail: final };
  } catch (err) {
    console.error('[forge] advanceSoftwareBuildJob failed:', err);
    if (heldLease) {
      await prisma.softwareBuildJob
        .updateMany({
          where: { id: job.id, error: heldLease },
          data: { status: 'Failed', error: 'Unexpected error' },
        })
        .catch(() => {});
    }
    return {
      status: 'Failed',
      error: 'CariForge could not continue this build right now. Try again shortly.',
    };
  }
}
