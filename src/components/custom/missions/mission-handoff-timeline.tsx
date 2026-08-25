// @polsia:user-owned — Handoff timeline client island.

'use client';

import type { MissionDetailT } from '@/lib/contracts/forge';

export function MissionHandoffTimeline({ detail }: { detail: MissionDetailT }) {
  if (detail.handoffs.length === 0) {
    return (
      <div className="glass-card rounded-2xl p-6 text-body text-muted-foreground">
        No handoffs yet. Submit the first handoff on the form above.
      </div>
    );
  }
  return (
    <ol className="space-y-3">
      {detail.handoffs.map((h) => (
        <li key={h.id} className="glass-card lift-soft rounded-2xl p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-caption uppercase tracking-wide text-brand-700">
                Stage {h.stage} · v{h.version}
              </p>
              <p className="text-h4">{h.stage} handoff</p>
              <p className="mt-1 text-small text-muted-foreground">
                Confidence {Math.round(h.confidence * 100)}% ·{' '}
                {new Date(h.createdAt).toLocaleString()}
              </p>
            </div>
            <div className="flex flex-col items-end gap-1 text-caption text-muted-foreground">
              {h.parentVersionId ? (
                <span className="glass-chip rounded-full px-2 py-0.5">
                  parent: {h.parentVersionId.slice(-6)}
                </span>
              ) : null}
              {h.correctionOfId ? (
                <span className="glass-chip rounded-full px-2 py-0.5">correction</span>
              ) : null}
              {h.supersededById ? (
                <span className="glass-chip rounded-full px-2 py-0.5">
                  superseded by {h.supersededById.slice(-6)}
                </span>
              ) : null}
              {h.invalidationReasonCode ? (
                <span className="glass-chip rounded-full px-2 py-0.5 text-amber-700">
                  invalidated: {h.invalidationReasonCode}
                </span>
              ) : null}
            </div>
          </div>
          <div className="mt-3 grid gap-2 text-small md:grid-cols-2">
            <div>
              <p className="text-caption text-muted-foreground">Missing evidence</p>
              <ul className="mt-1 list-disc pl-5">
                {h.missingEvidence.length === 0 ? (
                  <li className="text-muted-foreground">none recorded</li>
                ) : (
                  h.missingEvidence.slice(0, 5).map((m, idx) => (
                    <li key={`${h.id}-m-${idx}`}>
                      <code>{JSON.stringify(m)}</code>
                    </li>
                  ))
                )}
              </ul>
            </div>
            <div>
              <p className="text-caption text-muted-foreground">Payload</p>
              <pre className="mt-1 overflow-x-auto rounded-lg bg-muted/60 p-2 text-caption">
                {JSON.stringify(h.payload, null, 2).slice(0, 600)}
              </pre>
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}
