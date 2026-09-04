// @polsia:user-owned — real AI review of a freshly-drafted step output,
// one verdict per specialist role. Same AI Gateway pattern as ai-draft.ts/
// configurator.ts/qa-review.ts: never throws, degrades to 'unavailable' on
// any failure (a review outage must never block a human from deciding the
// gate themselves via the existing DecisionDialog — it just means nothing
// auto-advances that step).
//
// This is the real substance behind the architecture's "Oracle Review
// Agents" (Risk/Demand/Growth/Competition/Cost — SPECIALIST_ROLE_VALUES
// already is exactly this set, just spelled 'Money' not 'Cost'): five
// independent, genuinely-reasoned perspectives on the same draft, not a
// single model call rubber-stamped five times. Each clear verdict becomes
// a real StageHandoffSpecialistAttester row; each concern becomes a real
// Objection — the exact same governance primitives a human reviewer's
// attestation or objection already uses (see auto-advance.ts).

import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z as z4 } from 'zod/v4';
import { SPECIALIST_ROLE_VALUES, type SpecialistRole, type StageName } from '@/lib/contracts/forge';

const ROLE_LENS: Readonly<Record<SpecialistRole, string>> = {
  Risk: 'Risk: what could go wrong, and is it addressed or acknowledged?',
  Demand: 'Demand: is the need real, specific, and worth solving as described?',
  Growth: 'Growth: does this hold together as something worth investing further steps in?',
  Competition: 'Competition: does this account for how it compares to existing alternatives?',
  Money: 'Cost: is the scope bounded, and are resource/cost implications reasonable?',
};

const OracleReviewV4 = z4.object({
  reviews: z4
    .array(
      z4.object({
        role: z4.enum(SPECIALIST_ROLE_VALUES),
        verdict: z4.enum(['clear', 'concern']),
        note: z4.string(),
      }),
    )
    .length(SPECIALIST_ROLE_VALUES.length),
});

let cachedClient: Anthropic | null | undefined;

function getClient(): Anthropic | null {
  if (cachedClient !== undefined) return cachedClient;
  const apiKey = process.env.AI_GATEWAY_API_KEY ?? process.env.ANTHROPIC_API_KEY;
  cachedClient = apiKey ? new Anthropic({ apiKey, baseURL: 'https://ai-gateway.vercel.sh' }) : null;
  return cachedClient;
}

export interface OracleVerdict {
  readonly role: SpecialistRole;
  readonly verdict: 'clear' | 'concern';
  readonly note: string;
}

export type OracleReviewResult =
  | { status: 'ok'; verdicts: readonly OracleVerdict[] }
  | { status: 'unavailable' };

export async function reviewStepDraft(args: {
  stage: StageName;
  draftSummary: string;
}): Promise<OracleReviewResult> {
  const client = getClient();
  if (!client) return { status: 'unavailable' };

  const system = `You are five independent specialist reviewers examining a draft "${args.stage}"
step of a governed business project, before a named human decides whether
to approve it. Give each of the five lenses below its own honest,
independent verdict on THIS draft specifically:

${SPECIALIST_ROLE_VALUES.map((r) => `- ${ROLE_LENS[r]}`).join('\n')}

verdict "concern" means: a real, specific problem with this draft that the
human approver should see before deciding — not a vague worry, and not
something already addressed in the draft itself. Most drafts that are
reasonably scoped and honest about their own gaps should get "clear" from
most lenses. Do not manufacture concerns to seem thorough; a false
"concern" wastes the human's attention exactly as much as missing a real
one does. Each note is one sentence: what you checked and why you landed
on that verdict.`;

  const userMessage = `Draft step output:\n${args.draftSummary}`;

  try {
    const response = await client.messages.parse({
      model: 'anthropic/claude-sonnet-5',
      max_tokens: 1536,
      output_config: { effort: 'medium', format: zodOutputFormat(OracleReviewV4) },
      system,
      messages: [{ role: 'user', content: userMessage }],
    });
    if (!response.parsed_output) return { status: 'unavailable' };
    const parsed = OracleReviewV4.safeParse(response.parsed_output);
    if (!parsed.success) return { status: 'unavailable' };
    return { status: 'ok', verdicts: parsed.data.reviews };
  } catch (err) {
    console.error('[forge] reviewStepDraft failed:', err);
    return { status: 'unavailable' };
  }
}
