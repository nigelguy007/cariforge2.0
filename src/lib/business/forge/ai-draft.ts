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

// Real user report (2026-09-05): "it says the project is completed but i
// dont see any build or solution .. just a plan, nothing at all" — traced
// to a real gap against this app's own /why-this-is-a-scaffold promise
// ("a runnable Next.js / TypeScript project worked end-to-end from the
// approved brief"): the SoftwareBuild stage only ever produced the same
// summary/scope/checksPassed TEXT fields as every other stage, never an
// actual file. User's explicit direction after seeing this: "build real
// code generation".
//
// Deliberately its OWN schema and its OWN call, not a `files` field bolted
// onto the shared StepDraftV4 above — two reasons: (1) the file-header
// comment on StepDraftV4 already documents a real, confirmed incident
// where a wide, mostly-optional schema hung indefinitely against this
// exact Gateway/account; adding a large, variable-length files array to
// that already-17-field shape is exactly the kind of change that incident
// warns against. (2) the other four stages never need file generation at
// all, so giving them a slower, larger-token-budget schema every time
// would be pure waste. Every field below is still required, per that same
// lesson — no `.optional()`.
const GeneratedFileV4 = z4.object({
  // Relative path, e.g. "app/page.tsx" or "package.json" — never absolute,
  // never escaping the project root (checked below, not just asked for).
  path: z4.string(),
  content: z4.string(),
});
const SoftwareBuildDraftV4 = z4.object({
  summary: z4.string(),
  scope: z4.array(z4.string()),
  checksPassed: z4.array(z4.string()),
  missingEvidence: z4.array(z4.string()),
  // Real user direction (2026-09-05): "i need the full working delivery
  // not small files.. and a technical specification needs to be
  // delivered with an architecture for the solution" — two real,
  // separate deliverables, both added here rather than as a second call:
  // one more Gateway round-trip in the same request is exactly the
  // latency risk getClient's own comment documents a REAL past incident
  // for (a live call hitting Vercel's 300s function ceiling with zero
  // error logged). A technical spec is cheap in tokens next to code, so
  // it rides along on this one call instead.
  architectureOverview: z4.string(),
  techStack: z4.array(z4.string()),
  dataModel: z4.string(),
  apiSurface: z4.array(z4.string()),
  deploymentNotes: z4.string(),
  // Raised from 3-10 to 5-20 for the same direction — still capped, not
  // open-ended: an unbounded array reopens the exact latency risk above,
  // and a human still has to actually read this at an approval gate. This
  // is meaningfully more real coverage than the first pass, honestly
  // short of "a complete production application" — no single generation
  // call from any provider can honestly promise that, and the prompt
  // below says so rather than pretending otherwise.
  files: z4.array(GeneratedFileV4).min(5).max(20),
  confidence: z4.number().min(0).max(1),
});

export interface GeneratedFile {
  readonly path: string;
  readonly content: string;
}

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

  if (args.stage === 'SoftwareBuild') return draftSoftwareBuildFiles(client, args);

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

/** A path a generated file is rejected for — checked, not just asked for
 *  in the prompt: absolute, escapes the project root via `..`, or is
 *  otherwise not a plain relative path a zip/file-tree view can render
 *  safely. */
function isSafeRelativePath(path: string): boolean {
  if (!path || path.startsWith('/') || path.includes('\\') || path.includes('\0')) return false;
  const segments = path.split('/');
  return segments.every((s) => s.length > 0 && s !== '.' && s !== '..');
}

// Same shape draftStepOutput takes, minus `stage` (always 'SoftwareBuild'
// here — this is only ever reached from that one branch above).
async function draftSoftwareBuildFiles(
  client: Anthropic,
  args: {
    intake: string;
    normalizedNeed: string;
    priorContext: readonly string[];
    feedback?: readonly string[];
    evidence?: readonly { label: string; kind: string }[];
  },
): Promise<DraftStepResult> {
  const need = args.normalizedNeed.trim() || args.intake.trim();
  const contextBlock =
    args.priorContext.length > 0
      ? `\n\nWhat earlier steps already established (the need, the workflow, the governance controls — build to match all of it, not just the raw need):\n${args.priorContext.map((c, i) => `${i + 1}. ${c}`).join('\n')}`
      : '';
  const feedbackBlock =
    args.feedback && args.feedback.length > 0
      ? `\n\nA prior attempt at this build had these unresolved reviewer concerns — address them directly in the files this time:\n${args.feedback.map((c, i) => `${i + 1}. ${c}`).join('\n')}`
      : '';
  const evidenceBlock =
    args.evidence && args.evidence.length > 0
      ? `\n\nEvidence already attached to this project (reference it where relevant):\n${args.evidence.map((e, i) => `${i + 1}. ${e.label} (${e.kind})`).join('\n')}`
      : '';

  const system = `You are CariForge, building the "SoftwareBuild" step of a governed project —
the point where an approved plan becomes a real, RUNNABLE Next.js +
TypeScript implementation and a proper technical specification, not
another one-paragraph document. A named human reviews and approves,
corrects, or rejects what you produce here — you never approve anything
yourself, and must say so nowhere in your output.

Generate 5-20 real, working files for a Next.js (App Router) + TypeScript
project that substantively implements the workflow described below —
not a generic template, not a placeholder "hello world", and not a
single demo page standing in for the whole thing: cover the real pages/
routes, the real data model, and the real core logic implied by the need,
workflow steps and governance controls already established. Always
include a package.json with real, correct dependency versions and a
README.md explaining how to run it. Keep individual files legible (each
still a real, complete file, not truncated mid-way) and use plain React/
Next.js/TypeScript only, no other frameworks, and never hardcode a real
secret, API key, or credential anywhere. Be honest with yourself about
scope: this is a strong, working starting implementation for a named
human to review, test and extend — not a claim that every edge case,
integration, and production concern has been handled. Never say or imply
in your own output that this is production-ready or fully complete.

Also produce a real technical specification, not filler text:
- architectureOverview: 2-4 paragraphs — the actual shape of the
  solution (frontend/backend split, key components, how data flows
  through it), grounded in what was actually built, not generic
  boilerplate architecture-speak.
- techStack: the real technologies/libraries this build actually uses
  (not a wish list of things it doesn't use).
- dataModel: the key entities and their relationships/fields, matching
  whatever data model the generated files actually implement.
- apiSurface: the real routes/endpoints this build actually exposes
  (method + path + one-line purpose each), empty only if genuinely none.
- deploymentNotes: what a team would need to do to actually run/deploy
  this for real (environment variables, external services, build steps) —
  concrete, not "deploy as usual".

Also fill: summary (what you built, one paragraph), scope (bullet list of
what this build covers), checksPassed (acceptance checks this build
satisfies), missingEvidence (concrete gaps — e.g. real API access, a data
source — a human should confirm before this goes further; empty only if
genuinely none).

Set confidence (0-1) honestly: lower if the described workflow was vague
or this build depends on access/information not yet available.`;

  const userMessage = `The need, as described: ${need}${contextBlock}${evidenceBlock}${feedbackBlock}`;

  try {
    const response = await client.messages.parse(
      {
        model: 'anthropic/claude-sonnet-5',
        // Raised 8192 -> 12000 (2026-09-05, "i need the full working
        // delivery not small files") for the bigger file cap + the new
        // architecture/tech-spec fields above. Sized against the SAME
        // 300s Vercel function ceiling getClient's comment documents a
        // real past incident for: this is the only Gateway call this
        // request makes for SoftwareBuild (see auto-advance.ts — its
        // self-redraft loop deliberately skips SoftwareBuild, exactly so
        // a request can never chain two of these heavy calls back to
        // back), so 150s here plus one Oracle review call (~13-45s per
        // this file's own documented pattern) still leaves real margin.
        max_tokens: 12_000,
        output_config: { effort: 'medium', format: zodOutputFormat(SoftwareBuildDraftV4) },
        system,
        messages: [{ role: 'user', content: userMessage }],
      },
      { timeout: 150_000 },
    );
    if (!response.parsed_output) return { status: 'unavailable' };
    const parsed = SoftwareBuildDraftV4.safeParse(response.parsed_output);
    if (!parsed.success) return { status: 'unavailable' };
    const { missingEvidence, confidence, files, ...rest } = parsed.data;
    const safeFiles = files.filter((f) => isSafeRelativePath(f.path));
    if (safeFiles.length === 0) return { status: 'unavailable' };
    return {
      status: 'ok',
      draft: {
        payload: { ...rest, files: safeFiles },
        missingEvidence: missingEvidence ?? [],
        confidence,
      },
    };
  } catch (err) {
    console.error('[forge] draftSoftwareBuildFiles failed:', err);
    return { status: 'unavailable' };
  }
}
