// @polsia:user-owned — real AI conversation for the chat-based project
// intake flow (replaces the static MissionIntakeForm as the default path for
// starting a project). Same pattern as ai-draft.ts and its siblings
// (configurator.ts, qa-review.ts, oracle-review.ts): reads
// AI_GATEWAY_API_KEY (falling back to ANTHROPIC_API_KEY) from process.env,
// routes through Vercel's AI Gateway, never throws, degrades to
// 'unavailable' on any failure (missing key, rate limit, refusal, parse
// failure) — a chat outage must never be the reason a project can't be
// started; MissionIntakeForm itself is left in place, untouched, as the
// admin/manual fallback path if this is ever unavailable.

import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z as z4 } from 'zod/v4';
import type { IntakeChatResponseT } from '@/lib/contracts/intake-chat';

// Shadow of contracts/intake-chat.ts's IntakeChatResponse in zod/v4. Every
// field is REQUIRED — see that file's own comment and ai-draft.ts's header
// comment for the incident that established this rule: a mostly-optional
// structured-output schema hung indefinitely against this model/gateway,
// while small all-required schemas complete reliably in ~13s.
const IntakeChatResponseV4 = z4.object({
  reply: z4.string(),
  readyToSubmit: z4.boolean(),
  projectName: z4.string(),
  intake: z4.string(),
  need: z4.string(),
  intendedOutcome: z4.string(),
  constraints: z4.string(),
  authorityBoundary: z4.string(),
  dataClassification: z4.string(),
  retentionPolicy: z4.string(),
  acceptanceCriteria: z4.string(),
  nonGoals: z4.string(),
  missionOwner: z4.string(),
  missingInformation: z4.array(z4.string()),
});

let cachedClient: Anthropic | null | undefined;

function getClient(): Anthropic | null {
  if (cachedClient !== undefined) return cachedClient;
  const apiKey = process.env.AI_GATEWAY_API_KEY ?? process.env.ANTHROPIC_API_KEY;
  // Same fail-fast reasoning as ai-draft.ts's getClient(): the SDK's own
  // defaults (10-minute timeout, 2 retries, and a timed-out request is
  // itself retried) have no upside here — this function already treats any
  // AI failure as fine (degrades to { status: 'unavailable' }), so there is
  // nothing to gain from the SDK spending minutes before honoring that.
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

const SYSTEM_PROMPT = `You are CariForge, talking with a Caribbean business owner or team member who
wants to start a new project. CariForge's mission: help Caribbean businesses
adopt AI by turning a plain-language business need into a governed,
human-approved prototype — explicitly NOT a production deployment — in as
little as 21 days. AI agents do the drafting and review; a named human only
steers and approves at each gate.

Your job in THIS conversation is to gather, through warm, plain-language
back-and-forth, the information a real project intake needs:

  1. need — the gap in plain business terms: what's missing today, for whom.
  2. intendedOutcome — what "solved" looks like, in terms a human could
     actually verify happened.
  3. constraints — hard limits the build must respect (budget, deadline,
     regulatory regime, headcount available to review it).
  4. authorityBoundary — who can approve each step, and who must be
     consulted first.
  5. dataClassification — what kind of data this touches (personal,
     financial, health, none, etc.) and any regulatory regime it falls under.
  6. retentionPolicy — how long evidence and the decision record should be
     kept, and where.
  7. acceptanceCriteria — observable, checkable signals that would prove the
     outcome happened.
  8. nonGoals — what this project is deliberately NOT doing, to keep the
     prototype bounded.

Also gather, opportunistically and without pressing hard for them:
  - projectName — a short name for the project (optional; leave "" if the
    person never gives one).
  - missionOwner — the name or role of the person who owns this project
    (optional; leave "" if never given).

Rules for how you talk:
  - Ask exactly ONE question at a time. Never ask about two fields in the
    same message, and never say things like "field 3 of 8" — this is a
    conversation, not a form read aloud.
  - Be warm, concrete, and plain-language. No jargon. If an answer is vague,
    gently ask a follow-up that narrows it down, rather than accepting a
    placeholder.
  - Infer what you can from things the person already said rather than
    re-asking for it. If one sentence answers two fields, fill both and move
    to whatever is still missing.
  - Once every one of the 8 required fields has genuine, specific content
    (not a placeholder, not "n/a" used to dodge the question), summarize in
    plain English what you've gathered — one short paragraph per field group
    is fine — and explicitly ask the person to confirm it's right or add
    anything they want to change.
  - Only set readyToSubmit to true once the person has clearly confirmed the
    summary (or clearly told you to proceed / go ahead / that's correct) AND
    all 8 required fields are genuinely filled. Never set it speculatively,
    and never set it just because the fields look full if the person hasn't
    actually confirmed yet.
  - Once ready, "intake" must be a single plain-English paragraph — as if
    explaining the need to a colleague — synthesized from the whole
    conversation. This is equivalent to the old intake form's lead
    paragraph, and it should read naturally, not like a bullet list.

Every field in the output schema is required. For any field not yet known,
return an empty string ("") or empty array ([]) — never omit it, and never
invent content just to fill it. "reply" is always the next thing you say to
the person (your next question, your summary, or your acknowledgement) —
never leave it empty.`;

export type IntakeChatTurnResult =
  | { status: 'ok'; result: IntakeChatResponseT }
  | { status: 'unavailable' };

export async function intakeChatTurn(args: {
  messages: readonly { role: 'user' | 'assistant'; content: string }[];
}): Promise<IntakeChatTurnResult> {
  const client = getClient();
  if (!client) return { status: 'unavailable' };
  if (args.messages.length === 0) return { status: 'unavailable' };

  try {
    const response = await client.messages.parse({
      model: 'anthropic/claude-sonnet-5',
      max_tokens: 2048,
      output_config: { effort: 'medium', format: zodOutputFormat(IntakeChatResponseV4) },
      system: SYSTEM_PROMPT,
      messages: args.messages.map((m) => ({ role: m.role, content: m.content })),
    });
    if (!response.parsed_output) return { status: 'unavailable' };
    const parsed = IntakeChatResponseV4.safeParse(response.parsed_output);
    if (!parsed.success) return { status: 'unavailable' };
    return { status: 'ok', result: parsed.data };
  } catch (err) {
    // Never the reason a project can't be started — MissionIntakeForm is
    // still there as a manual fallback. Logged server-side so a real
    // outage is diagnosable.
    console.error('[forge] intakeChatTurn failed:', err);
    return { status: 'unavailable' };
  }
}
