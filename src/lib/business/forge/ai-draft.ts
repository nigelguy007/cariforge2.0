// @polsia:user-owned — real AI drafting for a mission's step output. Same
// pattern as business/configurator.ts and forge/qa-review.ts: reads
// AI_GATEWAY_API_KEY (falling back to ANTHROPIC_API_KEY) from process.env,
// routes through Vercel's AI Gateway, never throws, degrades to
// 'unavailable' on any failure (missing key, rate limit, refusal, parse
// failure) — a drafting failure must never be the reason a project is
// stuck; the named human approver can still supply a step output by hand
// (the admin-only manual form) if this is unavailable.
//
// User instruction (2026-09-05): "AI actually is doing the work" — this
// replaces the raw "type the JSON yourself" form as the DEFAULT path for
// the mission's own owner (server-enforced by submitHandoff's existing
// isAdmin-or-createdById check; nothing new added here). The human still
// approves via the existing DecisionDialog — this only changes who/what
// produces the DRAFT, not the approval gate itself (brief rule 7: preserve
// every governance check, simplify how it is presented).

import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z as z4 } from 'zod/v4';
import { GATE_DEFS, type StageName } from '@/lib/contracts/forge';

// One shared shape across all five stages (simpler to maintain than five
// bespoke schemas) — the system prompt tells the model which fields matter
// for the stage it was asked to draft; the rest are left empty. Field names
// match what the existing translated views already read from a handoff's
// payload (evidence-view.ts's payloadText() keys), so an AI-drafted step
// shows up correctly everywhere a human-typed one would have.
const StepDraftV4 = z4.object({
  summary: z4.string(),
  problemStatement: z4.string().optional(),
  needs: z4.array(z4.string()).optional(),
  risks: z4.array(z4.string()).optional(),
  questions: z4.array(z4.string()).optional(),
  stakeholders: z4.array(z4.string()).optional(),
  dataSourcesAvailable: z4.array(z4.string()).optional(),
  missingEvidence: z4.array(z4.string()).optional(),
  steps: z4.array(z4.string()).optional(),
  owners: z4.array(z4.string()).optional(),
  acceptanceCriteria: z4.array(z4.string()).optional(),
  decisionControl: z4.string().optional(),
  dataControl: z4.string().optional(),
  evidenceRetention: z4.string().optional(),
  controls: z4.array(z4.string()).optional(),
  scope: z4.array(z4.string()).optional(),
  checksPassed: z4.array(z4.string()).optional(),
  confidence: z4.number().min(0).max(1),
});

const STAGE_FOCUS: Readonly<Record<StageName, string>> = {
  Discovery:
    'Fill: problemStatement (one paragraph), needs (3-6 bullet needs), risks, questions ' +
    '(what a human Discovery approver would still want to ask before ruling on this).',
  Readiness:
    'Fill: summary, dataSourcesAvailable (what data/systems this need would draw on), ' +
    'stakeholders (who is involved), missingEvidence (concrete gaps a human should confirm ' +
    'before locking the workflow — leave empty only if genuinely none).',
  Workflow:
    'Fill: summary, steps (the ordered workflow steps), owners (who does each step — role, ' +
    'not a named individual), acceptanceCriteria (how success is checked).',
  Governance:
    'Fill: summary, decisionControl (who/what keeps a human in the loop on decisions), ' +
    'dataControl (what data this may touch and how access is limited), evidenceRetention ' +
    '(how long decision evidence is kept), controls (other named controls).',
  SoftwareBuild:
    'Fill: summary, scope (what the runnable prototype covers), checksPassed (acceptance ' +
    'checks this prototype spec satisfies).',
};

let cachedClient: Anthropic | null | undefined;

function getClient(): Anthropic | null {
  if (cachedClient !== undefined) return cachedClient;
  const apiKey = process.env.AI_GATEWAY_API_KEY ?? process.env.ANTHROPIC_API_KEY;
  // timeout/maxRetries: the SDK's own defaults are a 10-MINUTE timeout with
  // 2 retries — and per its own docs, a timed-out request is itself
  // retried, so a single call can genuinely take much longer than even
  // that. This function is one of up to five sequential Gateway calls
  // within one /draft request (draft, review, maybe reconcile, maybe
  // redraft, maybe a second review) inside a single Vercel function
  // invocation — confirmed live (2026-09-05) hitting the platform's own
  // 300s ceiling this way, killed as a hard timeout with zero application
  // log, right after the Preview-scope key was first enabled. This whole
  // file already treats any AI failure as fine — draftStepOutput degrades
  // to { status: 'unavailable' } and the human's own fallback form still
  // works — so there is no upside to the SDK spending minutes retrying
  // before honoring that; fail fast and let the existing degrade path do
  // its job instead. 45s (not the 30s first tried): StepDraftV4 is a much
  // larger schema than the proven configurator.ts/qa-review.ts ones (17
  // fields vs ~5) — confirmed live that a real call to THIS function
  // genuinely needs more than 30s to complete, timing out and correctly
  // degrading at that cap on the first attempt after this fix shipped.
  cachedClient = apiKey
    ? new Anthropic({
        apiKey,
        baseURL: 'https://ai-gateway.vercel.sh',
        timeout: 45_000,
        maxRetries: 0,
      })
    : null;
  return cachedClient;
}

export interface StepDraft {
  readonly payload: Record<string, unknown>;
  readonly missingEvidence: readonly string[];
  readonly confidence: number;
}

export type DraftStepResult = { status: 'ok'; draft: StepDraft } | { status: 'unavailable' };

export async function draftStepOutput(args: {
  stage: StageName;
  intake: string;
  normalizedNeed: string;
  /** Plain-language summary of earlier steps' outputs, oldest first. Empty for Discovery. */
  priorContext: readonly string[];
  /** Unresolved reviewer concerns from a prior attempt at THIS same step,
   *  if this is a redraft ("Supervisor sends failed work back to the
   *  responsible agent"). Empty on a first attempt. */
  feedback?: readonly string[];
}): Promise<DraftStepResult> {
  const client = getClient();
  if (!client) return { status: 'unavailable' };

  const gate = GATE_DEFS.find((g) => g.stage === args.stage);
  const need = args.normalizedNeed.trim() || args.intake.trim();
  const contextBlock =
    args.priorContext.length > 0
      ? `\n\nWhat earlier steps already established:\n${args.priorContext.map((c, i) => `${i + 1}. ${c}`).join('\n')}`
      : '';
  const feedbackBlock =
    args.feedback && args.feedback.length > 0
      ? `\n\nA prior attempt at this same step had these unresolved reviewer concerns — address them directly this time, don't just repeat the same draft:\n${args.feedback.map((c, i) => `${i + 1}. ${c}`).join('\n')}`
      : '';

  const system = `You are CariForge, drafting the "${args.stage}" step of a governed project for
a real business. This step's purpose: ${gate?.purpose ?? 'Advance the project to its next gate.'}

You are producing a DRAFT for a named human to review and approve, correct,
or reject — you never approve anything yourself, and you must say so
nowhere in your output (no "approved", no claiming a decision was made).
Be concrete and grounded in what was actually described; if something is
genuinely unknown, say so as an open question or a risk rather than
inventing a plausible-sounding but unfounded detail.

${STAGE_FOCUS[args.stage]}

Set confidence (0-1) honestly: lower if the described need is vague or
this step depends on information not yet available.`;

  const userMessage = `The need, as described: ${need}${contextBlock}${feedbackBlock}`;

  try {
    const response = await client.messages.parse({
      model: 'anthropic/claude-sonnet-5',
      max_tokens: 2048,
      output_config: { effort: 'medium', format: zodOutputFormat(StepDraftV4) },
      system,
      messages: [{ role: 'user', content: userMessage }],
    });
    if (!response.parsed_output) return { status: 'unavailable' };
    const parsed = StepDraftV4.safeParse(response.parsed_output);
    if (!parsed.success) return { status: 'unavailable' };
    const { missingEvidence, confidence, ...payload } = parsed.data;
    return {
      status: 'ok',
      draft: {
        payload,
        missingEvidence: missingEvidence ?? [],
        confidence,
      },
    };
  } catch (err) {
    // Never the reason a project can't advance — the admin fallback form
    // still works. Logged server-side so a real outage is diagnosable.
    console.error('[forge] draftStepOutput failed:', err);
    return { status: 'unavailable' };
  }
}
