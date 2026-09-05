// @polsia:user-owned — the workflow configurator's AI call. Same pattern as
// forge/qa-review.ts: reads ANTHROPIC_API_KEY directly from process.env
// (optional, gracefully-degrading feature, not a required deploy-time
// value), never throws, degrades to 'unavailable' on any failure. Uses
// Claude Opus 5 per this project's claude-api skill guidance (always use
// claude-opus-5 unless told otherwise).
//
// Cost/abuse note: this endpoint is public and unauthenticated (a prospect
// hasn't signed up for anything yet — that's the point of a pre-sales
// configurator), and this codebase has no rate-limiting infrastructure
// anywhere (checked: /api/leads, the only other public POST endpoint, has
// none either) — this follows that same existing risk posture rather than
// bolting on a bespoke limiter for one route. The real cost bound is the
// input length cap (ConfiguratorRequest, 2000 chars) and a modest
// max_tokens ceiling below, not request throttling.

import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
// Same reasoning as qa-review.ts: the Anthropic SDK's zodOutputFormat needs
// a schema actually built with zod/v4 (toJSONSchema), not just a
// structurally-similar one. contracts/configurator.ts stays plain zod (v3)
// to match apiFetch and every other route's contract; this v4 shadow
// schema exists only to describe the same shape to the API, and the
// response is re-validated against the real (v3) ConfiguratorResult below
// before this function returns.
import { z as z4 } from 'zod/v4';
import {
  CONFIGURATOR_AGENT_VALUES,
  CONFIGURATOR_FIT_VALUES,
  type ConfiguratorResponseT,
  ConfiguratorResult,
} from '@/lib/contracts/configurator';

const ConfiguratorResultV4 = z4.object({
  fit: z4.enum(CONFIGURATOR_FIT_VALUES),
  summary: z4.string(),
  agentFocus: z4
    .array(
      z4.object({
        agent: z4.enum(CONFIGURATOR_AGENT_VALUES),
        why: z4.string(),
      }),
    )
    .min(1)
    .max(7),
  riskFlags: z4.array(z4.string()),
  clarifyingQuestions: z4.array(z4.string()),
});

let cachedClient: Anthropic | null | undefined;

// Confirmed root cause (2026-08-29): this deploy's key is issued by Vercel's
// AI Gateway (its wrapped-JSON value shape gave it away — a real Anthropic
// secret starts `sk-ant-...`), not a raw Anthropic secret, but this code was
// pointing the SDK straight at api.anthropic.com — every call failed
// silently (swallowed by the catch below into 'unavailable') until this fix.
// Gateway docs: https://vercel.com/docs/ai-gateway/sdks-and-apis/anthropic-messages-api
// — same Anthropic SDK, but routed via baseURL with model ids prefixed
// `anthropic/`. AI_GATEWAY_API_KEY is the semantically-correct env var name
// going forward; ANTHROPIC_API_KEY is what's actually set today, so it's
// the fallback, not the primary.
function getClient(): Anthropic | null {
  if (cachedClient !== undefined) return cachedClient;
  const apiKey = process.env.AI_GATEWAY_API_KEY ?? process.env.ANTHROPIC_API_KEY;
  // timeout/maxRetries: the SDK's own defaults are a 10-MINUTE timeout with
  // 2 retries — and per its own docs, a timed-out request is itself
  // retried, so a single call can genuinely take much longer than even
  // that. Confirmed live (2026-09-05): the sibling AI-drafting pipeline in
  // forge/ai-draft.ts and forge/oracle-review.ts (same client-construction
  // pattern, no explicit timeout either) hit Vercel's own 300s function
  // ceiling this way. This function already treats any AI failure as fine
  // — runConfigurator degrades to { status: 'unavailable' } and the real
  // brief-intake form below is always still there — so there is no upside
  // to the SDK spending minutes retrying before honoring that.
  cachedClient = apiKey
    ? new Anthropic({
        apiKey,
        baseURL: 'https://ai-gateway.vercel.sh',
        timeout: 30_000,
        maxRetries: 0,
      })
    : null;
  return cachedClient;
}

const SYSTEM_PROMPT = `You are the indicative front door of CARI Forge, a governed multi-agent
system that turns a defined business need into a working software proof
inside a 21-day "Forge", gated by named human approvers at every stage.

A prospect has described what they want to build. Give them an honest,
INDICATIVE read — not a promise, not a sales pitch, not a real Discovery
gate ruling (a named human does that later, on the real submission). Your
job:

1. Judge fit against these criteria — good fit: a real workflow/service
   need with a named owner, accessible sample data, a decision that can
   stay human-controlled where it needs to, a measurable outcome, bounded
   enough to evaluate in 21 days. Poor fit: a generic chatbot with no
   defined workflow, a speculative model comparison with no business
   outcome, a request for fully autonomous uncontrolled decisions, no
   lawful/approved data access, or a full enterprise transformation
   disguised as a 21-day prototype.
2. Map which of the seven real CARI Forge agents would carry the most
   weight for this case (Discovery, Readiness, Workflow, Governance,
   AI Build, Partner, Impact) and say briefly why for each one you name.
3. Name concrete risk flags — things that would need addressing before
   this could clear a real Discovery gate.
4. Write the actual clarifying questions a human Discovery approver would
   ask before ruling on this.

Be concrete and skeptical, not encouraging by default — a false "strong
fit" wastes everyone's time once a human actually reviews the real
submission. If the description is too vague to judge, say so in the
summary and ask for the missing specifics in clarifyingQuestions rather
than inventing detail that wasn't given.`;

export async function getConfiguratorResult(description: string): Promise<ConfiguratorResponseT> {
  const client = getClient();
  if (!client) return { status: 'unavailable' };

  try {
    const response = await client.messages.parse({
      // 2026-09-03: confirmed live against production that claude-opus-5,
      // claude-sonnet-5, AND claude-haiku-4-5 all hit the identical AI
      // Gateway RestrictedModelsError ("Free tier users do not have
      // access to this model") even with a card on file — this is a
      // tier-wide restriction on the whole account, not a per-model gap,
      // so switching models further won't help. Needs actual topped-up
      // credits (https://vercel.com/d?to=%2F%5Bteam%5D%2F%7E%2Fai%3Fmodal%3Dtop-up),
      // not just card verification. Left on Sonnet 5 as the sensible
      // default once that's resolved — model choice doesn't matter until
      // then.
      model: 'anthropic/claude-sonnet-5',
      max_tokens: 2048,
      // Medium effort, not the SDK's default high: this is a bounded
      // classification-and-mapping task against fixed, spelled-out
      // criteria, not open-ended reasoning — and it's a public,
      // unauthenticated endpoint with no rate limiting (see file header),
      // so per-request cost matters more here than on the internal,
      // auth-gated QA-review feature this pattern is copied from.
      output_config: { effort: 'medium', format: zodOutputFormat(ConfiguratorResultV4) },
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: description }],
    });
    if (!response.parsed_output) return { status: 'unavailable' };
    const parsed = ConfiguratorResult.safeParse(response.parsed_output);
    if (!parsed.success) return { status: 'unavailable' };
    return { status: 'ok', result: parsed.data };
  } catch (err) {
    // Network error, rate limit, invalid key, refusal, parse failure — all
    // degrade the same way. Never the reason a prospect can't reach the
    // real form. Logged server-side (never surfaced to the client) so a
    // real failure is diagnosable instead of indistinguishable from "no
    // key configured" — this swallowed a real bug silently for days.
    console.error('[configurator] getConfiguratorResult failed:', err);
    return { status: 'unavailable' };
  }
}
