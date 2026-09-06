// @polsia:user-owned — async, chunked SoftwareBuild generation (2026-09-06).
// See prisma/schema/forge.prisma's SoftwareBuildJob model comment for the
// full "why": this project's Vercel plan (Hobby) kills any serverless
// function at 60s, but a real MVP's file/spec generation genuinely needs
// ~150s — confirmed live as the actual cause of "says Working… then
// crashes" on the Build stage. User's explicit choice over upgrading to
// Vercel Pro: stay on Hobby, make the generation itself resumable.
//
// Shape: one HTTP request (build-job/route.ts) advances the job by
// exactly ONE bounded step and returns — well under 60s each time:
//   Planning   — one AI call: the file list (path + one-line purpose) and
//                the full technical spec, NO file content yet.
//   Generating — one AI call per poll: this step's ONE target file's full
//                content, given the plan and what's already been written.
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

List 5-20 real files that together implement the workflow described
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
        max_tokens: 4_000,
        output_config: { effort: 'medium', format: zodOutputFormat(SoftwareBuildPlanV4) },
        system,
        messages: [{ role: 'user', content: userMessage }],
      },
      { timeout: 45_000 },
    );
    if (!response.parsed_output) return null;
    const parsed = SoftwareBuildPlanV4.safeParse(response.parsed_output);
    if (!parsed.success) return null;
    const safeFiles = parsed.data.files.filter((f) => isSafeRelativePath(f.path));
    if (safeFiles.length === 0) return null;
    return { ...parsed.data, files: safeFiles };
  } catch (err) {
    console.error('[forge] planSoftwareBuild failed:', err);
    return null;
  }
}

async function generateFileContent(args: {
  plan: SoftwareBuildPlan;
  targetPath: string;
  targetPurpose: string;
  doneSoFar: readonly GeneratedFile[];
}): Promise<string | null> {
  const client = getClient();
  if (!client) return null;

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
cold. Never truncate mid-file, never hardcode a real secret/API key.

Architecture this file must fit (already decided): ${args.plan.architectureOverview}
Tech stack: ${args.plan.techStack.join(', ')}
Data model: ${args.plan.dataModel}
${allPathsBlock}${priorFilesBlock}

Write the COMPLETE, real content for exactly this one file:
Path: ${args.targetPath}
Purpose: ${args.targetPurpose}`;

  // File length varies enormously across a real 5-20 file MVP (a
  // package.json vs. a real upload/validation API route), so no single
  // static max_tokens is safe for every file. Confirmed live twice
  // (2026-09-06): 4_000 truncated mid-JSON on one file
  // ("lib/disclosureRules.ts"), and even after raising it to 8_192 a
  // DIFFERENT, longer file ("app/api/claims/upload/route.ts") hit the
  // exact same "Unterminated string in JSON..." failure — the JSON-
  // escaped {content: "..."} wrapper plus this system prompt's own
  // demand for real validation/error-handling means some files
  // genuinely need more room than others. Rather than keep raising one
  // static number and hitting a new wall on the next long file, retry
  // ONCE with a much larger budget specifically when the failure looks
  // like this exact truncation shape (not for other failures — a
  // genuine timeout or refusal wouldn't be helped by more tokens).
  const attempts: ReadonlyArray<{ maxTokens: number; timeoutMs: number }> = [
    { maxTokens: 8_192, timeoutMs: 90_000 },
    { maxTokens: 20_000, timeoutMs: 150_000 },
  ];
  let lastErr: unknown;
  for (const attempt of attempts) {
    try {
      const response = await client.messages.parse(
        {
          model: 'anthropic/claude-sonnet-5',
          max_tokens: attempt.maxTokens,
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
        // actively generating, not hung. getClient()'s own comment also
        // confirms this project's real function ceiling is ~300s (a
        // /draft request chaining five 45s-default calls hit that as
        // the platform limit), so even the larger retry here leaves the
        // finalize step and the platform itself real headroom.
        { timeout: attempt.timeoutMs },
      );
      if (!response.parsed_output) return null;
      const parsed = FileContentV4.safeParse(response.parsed_output);
      return parsed.success ? parsed.data.content : null;
    } catch (err) {
      lastErr = err;
      const looksTruncated =
        err instanceof Error && /unterminated string in json/i.test(err.message);
      if (!looksTruncated) break; // a real timeout/refusal — more tokens won't fix it, don't retry
    }
  }
  console.error('[forge] generateFileContent failed:', lastErr);
  return null;
}

export type BuildJobResult =
  | { readonly status: 'Planning' | 'Finalizing' }
  | { readonly status: 'Generating'; readonly progress: { current: number; total: number } }
  | { readonly status: 'Done'; readonly detail: MissionDetailT }
  | { readonly status: 'Failed'; readonly error: string };

/** Advances (creating if needed) the active SoftwareBuildJob for this
 *  mission by exactly one bounded step, and returns its new state. Safe
 *  to call repeatedly from a client poll loop — each call does real work
 *  and persists progress before returning, so a call that itself times
 *  out or fails only loses ONE file's worth of work, not the whole build. */
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

  try {
    if (job.status === 'Planning') {
      const plan = await planSoftwareBuild({
        need: args.need,
        priorContext: args.priorContext,
        feedback: args.feedback,
        evidence: args.evidence,
      });
      if (!plan) {
        await prisma.softwareBuildJob.update({
          where: { id: job.id },
          data: { status: 'Failed', error: 'CariForge could not plan this build right now.' },
        });
        return {
          status: 'Failed',
          error: 'CariForge could not plan this build right now. Try again shortly.',
        };
      }
      await prisma.softwareBuildJob.update({
        where: { id: job.id },
        data: { plan, status: 'Generating', nextFileIndex: 0 },
      });
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
      const content = await generateFileContent({
        plan,
        targetPath: target.path,
        targetPurpose: target.purpose,
        doneSoFar: doneFiles,
      });
      if (content === null) {
        await prisma.softwareBuildJob.update({
          where: { id: job.id },
          data: { status: 'Failed', error: `CariForge could not generate ${target.path}.` },
        });
        return {
          status: 'Failed',
          error: `CariForge could not generate ${target.path}. Try again shortly.`,
        };
      }
      const updatedFiles: GeneratedFile[] = [...doneFiles, { path: target.path, content }];
      const nextIndex = job.nextFileIndex + 1;
      const nowDone = nextIndex >= plan.files.length;
      await prisma.softwareBuildJob.update({
        where: { id: job.id },
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
        },
      });
      return nowDone
        ? { status: 'Finalizing' }
        : { status: 'Generating', progress: { current: nextIndex, total: plan.files.length } };
    }

    // job.status === 'Finalizing': no AI call — assemble the completed
    // payload and hand off through the EXACT same write path every other
    // stage already uses (submitHandoff + reviewAndMaybeAdvance).
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
    await prisma.softwareBuildJob.update({ where: { id: job.id }, data: { status: 'Done' } });
    const final = (await getMissionDetail(args.missionId, args.userId, args.isAdmin)) ?? updated;
    return { status: 'Done', detail: final };
  } catch (err) {
    console.error('[forge] advanceSoftwareBuildJob failed:', err);
    await prisma.softwareBuildJob
      .update({ where: { id: job.id }, data: { status: 'Failed', error: 'Unexpected error' } })
      .catch(() => {});
    return {
      status: 'Failed',
      error: 'CariForge could not continue this build right now. Try again shortly.',
    };
  }
}
