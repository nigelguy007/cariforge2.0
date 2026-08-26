// @polsia:user-owned — R7 (mission pipeline rebuild): QA-review card, shown
// directly above MissionGatePanel. Reference: apps/web/components/QAReviewCard
// — "the agent-checks-agent critique... shown next to the approval form, so
// the approver reads an independent second opinion before deciding.
// Advisory only: it never gates anything; the human gate stays the only
// gate." This card never blocks rendering MissionGatePanel below it —
// loading/unavailable states just render smaller and get out of the way.

'use client';

import * as React from 'react';
import { apiFetch } from '@/lib/api-client';
import { QAReview as QAReviewSchema, type QAReviewT } from '@/lib/contracts/qa-review';

const SEVERITY_TONE: Record<string, string> = {
  low: 'glass-chip',
  medium: 'bg-amber-500/15 text-amber-800',
  high: 'bg-orange-500/15 text-orange-800',
  critical: 'bg-rose-500/15 text-rose-800',
};

export function QAReviewCard({ missionId, gateIndex }: { missionId: string; gateIndex: number }) {
  const [result, setResult] = React.useState<QAReviewT | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    setResult(null);
    apiFetch(`/api/forge/missions/${missionId}/gates/${gateIndex}/qa-review`, {
      schema: QAReviewSchema,
    })
      .then((data) => {
        if (!cancelled) setResult(data);
      })
      .catch(() => {
        // Advisory only — a fetch failure reads the same as 'unavailable',
        // never an error state that competes with the approval form below.
        if (!cancelled) setResult({ status: 'unavailable' });
      });
    return () => {
      cancelled = true;
    };
  }, [missionId, gateIndex]);

  if (!result) {
    return (
      <div className="glass-card rounded-2xl p-4 text-small text-muted-foreground">
        Running the QA review…
      </div>
    );
  }

  if (result.status === 'unavailable') {
    return (
      <div className="glass-card rounded-2xl p-4 text-small text-muted-foreground">
        Quality review — the QA reviewer couldn&apos;t run for this artefact (or there&apos;s
        nothing to review yet). Review it with extra care.
      </div>
    );
  }

  const { review } = result;
  return (
    <section className="glass-card space-y-3 rounded-2xl p-6" aria-label="Quality review">
      <header className="flex flex-wrap items-center gap-3">
        <h3 className="text-h4">Quality review</h3>
        <span
          className={`glass-chip rounded-full px-2.5 py-0.5 text-caption uppercase tracking-wide ${
            review.verdict === 'pass'
              ? 'bg-emerald-500/15 text-emerald-800'
              : 'bg-amber-500/15 text-amber-800'
          }`}
        >
          {review.verdict === 'pass' ? 'Pass' : 'Concerns'}
        </span>
        <span className="text-caption text-muted-foreground">
          confidence: {Math.round(review.confidence * 100)}%
        </span>
      </header>

      <p className="text-body text-muted-foreground">{review.summary}</p>

      {review.issues.length > 0 && (
        <ul className="space-y-2">
          {review.issues.map((issue, index) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: issues have no stable id from the model
            <li key={index} className="flex items-start gap-2 text-small">
              <span
                className={`rounded-full px-2 py-0.5 text-caption uppercase ${
                  SEVERITY_TONE[issue.severity] ?? 'glass-chip'
                }`}
              >
                {issue.severity}
              </span>
              <span className="text-foreground">{issue.description}</span>
            </li>
          ))}
        </ul>
      )}

      {review.questionsForApprover.length > 0 && (
        <div>
          <p className="text-caption uppercase tracking-wide text-muted-foreground">
            Before you approve, ask:
          </p>
          <ul className="mt-1 list-inside list-disc space-y-1 text-small text-foreground">
            {review.questionsForApprover.map((question, index) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: questions have no stable id from the model
              <li key={index}>{question}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
