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
// for the stage it was asked to draft; the rest come back as an empty
// string/array (see the "leave every other field..." system-prompt line
// below), never omitted. Field names match what the existing translated
// views already read from a handoff's payload (evidence-view.ts's
// payloadText() keys), so an AI-drafted step shows up correctly everywhere
// a human-typed one would have — an empty string/array reads identically
// to an absent key everywhere downstream (every reader checks
// `typeof x === 'string' && x.trim()` or `.length > 0`), so nothing here
// changes what the UI shows.
//
// Every field below is REQUIRED, not `.optional()` — deliberately, after a
// live incident (2026-09-05): with ~10 of these 17 fields marked
// `.optional()`, real calls against this schema hung indefinitely against
// the Vercel AI Gateway (30s, 45s, and 60s client-side timeouts all
// elapsed identically without the call ever completing), while the
// smaller, all-required schemas in configurator.ts/qa-review.ts and this
// same file's own oracle-review.ts sibling complete reliably in ~13s.
// That specific difference — many optional fields in one strict
// structured-output schema — is a known friction point for JSON-schema
// strict mode (some fields need `anyOf: [type, null]` rather than true
// optionality to stay satisfiable), so the model may be getting stuck
// trying to satisfy an internally-inconsistent generated schema. This is
// the fix for that theory; if it doesn't hold, the next thing to try is
// splitting this into two smaller calls instead of one 17-field one.
const StepDraftV4 = z4.object({
  summary: z4.string(),
  problemStatement: z4.string(),
  needs: z4.array(z4.string()),
  risks: z4.array(z4.string()),
  questions: z4.array(z4.string()),
  stakeholders: z4.array(z4.string()),
  dataSourcesAvailable: z4.array(z4.string()),
  missingEvidence: z4.array(z4.string()),
  steps: z4.array(z4.string()),
  owners: z4.array(z4.string()),
  acceptanceCriteria: z4.array(z4.string()),
  decisionControl: z4.string(),
  dataControl: z4.string(),
  evidenceRetention: z4.string(),
  controls: z4.array(z4.string()),
  scope: z4.array(z4.string()),
  checksPassed: z4.array(z4.string()),
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
  // its job instead. Tried 30s, 45s, and 60s live in succession (2026-09-05)
  // — ALL three timed out identically on the same real call, never once
  // completing. That rules out "just needs a bit more time": this specific
  // 17-field, mostly-optional-array StepDraftV4 shape appears to hang
  // indefinitely against this account/Gateway, while the much smaller,
  // proven configurator.ts/qa-review.ts schemas complete reliably in
  // ~13s. Settled back on 45s (matching oracle-review.ts) as a sane,
  // fail-fast bound rather than continuing to raise a number that's
  // demonstrably not the actual problem — see the session notes for the
  // open investigation (likely the schema shape itself, not infra).
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
  /** Real gap found live (2026-09-05, "look at the functionality" pass
   *  benchmarked against Kore.ai's Search/Knowledge AI pillar): a person
   *  can attach Evidence to a project, but this function never saw it —
   *  the draft was generated blind to anything the user attached. This
   *  schema stores a label + kind + reference pointer, not the document's
   *  full body text, so what's passed here is that label/kind context
   *  (real: what the human said this evidence is), not the file contents
   *  themselves. Empty when nothing is attached yet. */
  evidence?: readonly { label: string; kind: string }[];
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
  const evidenceBlock =
    args.evidence && args.evidence.length > 0
      ? `\n\nEvidence already attached to this project (reference it where relevant instead of treating this as unverified):\n${args.evidence.map((e, i) => `${i + 1}. ${e.label} (${e.kind})`).join('\n')}`
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

Every field in the output schema is required. For any field not named
above (it doesn't apply to this stage), return an empty string ("") or
empty array ([]) — never omit it, and never invent content just to fill
it.

Set confidence (0-1) honestly: lower if the described need is vague or
this step depends on information not yet available.`;

  const userMessage = `The need, as described: ${need}${contextBlock}${evidenceBlock}${feedbackBlock}`;

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
