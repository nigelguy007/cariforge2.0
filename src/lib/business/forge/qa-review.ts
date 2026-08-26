// @polsia:user-owned — R7 (mission pipeline rebuild): QA-review layer ahead
// of the approval form. Reference: apps/web/components/QAReviewCard on the
// real platform — an independent agent critiques the artefact before the
// human sees Approve/Return/Refuse. Advisory only: this NEVER throws and
// NEVER blocks a gate decision; a failure here degrades to 'unavailable',
// same as the reference platform's own "QA reviewer couldn't run" state.
//
// Reads ANTHROPIC_API_KEY directly from process.env rather than through
// src/lib/env.ts — that file is @polsia:shared/composed, hand-edited only
// through its declared module-contribution slots by the Polsia installer,
// and this is an optional, gracefully-degrading feature rather than a
// required deploy-time config value.

import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
// The Anthropic SDK's zodOutputFormat calls zod/v4's toJSONSchema internally
// — it needs a schema actually built with zod/v4, not just one that's
// structurally similar. This app's contracts (src/lib/contracts/*) all use
// the standard top-level `zod` import (v3 API) to match apiFetch's ZodType
// and every other route handler, so that stays the single source of truth
// for what crosses the wire; this v4 shadow schema exists only to describe
// the same shape to the Anthropic API, and its output is re-validated
// against the real QAReviewResult (v3) below before this function returns.
import { z as z4 } from 'zod/v4';
import {
  QA_ISSUE_SEVERITY_VALUES,
  QA_VERDICT_VALUES,
  QAReviewResult,
  type QAReviewT,
} from '@/lib/contracts/qa-review';

const QAReviewResultV4 = z4.object({
  verdict: z4.enum(QA_VERDICT_VALUES),
  confidence: z4.number().min(0).max(1),
  summary: z4.string(),
  issues: z4.array(
    z4.object({
      severity: z4.enum(QA_ISSUE_SEVERITY_VALUES),
      description: z4.string(),
    }),
  ),
  questionsForApprover: z4.array(z4.string()),
});

export interface QAReviewInput {
  missionName: string;
  gateName: string;
  stage: string;
  intake: string;
  handoffPayload: unknown;
}

let cachedClient: Anthropic | null | undefined;

function getClient(): Anthropic | null {
  if (cachedClient !== undefined) return cachedClient;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  cachedClient = apiKey ? new Anthropic({ apiKey }) : null;
  return cachedClient;
}

function truncate(value: unknown, maxChars = 6000): string {
  const s = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
  return s.length > maxChars ? `${s.slice(0, maxChars)}\n…(truncated)` : s;
}

const SYSTEM_PROMPT = `You are an independent QA reviewer for a governed software-delivery
pipeline. You critique one stage artefact (a "handoff") before a human
approver decides whether to approve it. You are advisory only: your review
never approves, returns, or refuses anything — a human makes that call. Be
concrete and skeptical. Flag anything that would make you, as the named
approver, want to ask a question before signing off. If the artefact looks
genuinely solid, say so plainly rather than inventing issues.`;

// getQAReview — never throws. Callers can render its result directly.
export async function getQAReview(input: QAReviewInput): Promise<QAReviewT> {
  const client = getClient();
  if (!client) return { status: 'unavailable' };

  try {
    const response = await client.messages.parse({
      model: 'claude-opus-5',
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: [
            `Mission: ${input.missionName}`,
            `Gate: ${input.gateName} (stage: ${input.stage})`,
            `Original need (intake):\n${truncate(input.intake, 2000)}`,
            `Artefact being decided (handoff payload):\n${truncate(input.handoffPayload)}`,
          ].join('\n\n'),
        },
      ],
      output_config: { format: zodOutputFormat(QAReviewResultV4) },
    });
    if (!response.parsed_output) return { status: 'unavailable' };
    // Re-validate through the real (v3) contract rather than trusting the
    // v4 shadow schema's inferred type directly — this is what actually
    // crosses back into the rest of the app.
    const parsed = QAReviewResult.safeParse(response.parsed_output);
    if (!parsed.success) return { status: 'unavailable' };
    return { status: 'ok', review: parsed.data };
  } catch {
    // Network error, rate limit, invalid key, refusal, parse failure — all
    // degrade the same way. This sits in front of a real governance
    // decision; it must never be the reason a gate can't be decided.
    return { status: 'unavailable' };
  }
}
