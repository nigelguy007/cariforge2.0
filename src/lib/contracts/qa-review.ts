// @polsia:user-owned — R7 (mission pipeline rebuild): shared zod contract for
// the QA-review layer. Reference: apps/web/components/QAReviewCard/QAReviewCard.tsx
// on the real platform — an independent agent critiques every artefact before
// the human sees the approval form. Advisory only: "it never gates anything;
// the human gate stays the only gate." Client-importable: zod only.

import { z } from 'zod';

export const QA_ISSUE_SEVERITY_VALUES = ['low', 'medium', 'high', 'critical'] as const;
export type QAIssueSeverity = (typeof QA_ISSUE_SEVERITY_VALUES)[number];

export const QAReviewIssue = z.object({
  severity: z.enum(QA_ISSUE_SEVERITY_VALUES),
  description: z.string(),
});

export const QA_VERDICT_VALUES = ['pass', 'concerns'] as const;
export type QAVerdict = (typeof QA_VERDICT_VALUES)[number];

// The structured shape Claude is asked to fill in via output_config.format.
export const QAReviewResult = z.object({
  verdict: z.enum(QA_VERDICT_VALUES),
  // 0..1, model's own stated confidence in this verdict.
  confidence: z.number().min(0).max(1),
  summary: z.string(),
  issues: z.array(QAReviewIssue),
  questionsForApprover: z.array(z.string()),
});
export type QAReviewResultT = z.infer<typeof QAReviewResult>;

// Wire shape served from GET .../qa-review. 'unavailable' covers: nothing to
// review yet (no handoff on this gate), no ANTHROPIC_API_KEY configured, or
// the call itself failed — same "couldn't run, review with extra care"
// fallback the reference platform's own QAReviewCard renders, never a thrown
// error that would break the approval flow this sits in front of.
export const QAReview = z.discriminatedUnion('status', [
  z.object({ status: z.literal('unavailable') }),
  z.object({ status: z.literal('ok'), review: QAReviewResult }),
]);
export type QAReviewT = z.infer<typeof QAReview>;
