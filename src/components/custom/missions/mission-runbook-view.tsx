// @polsia:user-owned — Runbook view client island.
'use client';

import * as React from 'react';
import { apiFetch } from '@/lib/api-client';
import { RunbookRead, type RunbookReadT } from '@/lib/contracts/forge';

export function MissionRunbookView({ missionId }: { missionId: string }) {
  const [runbook, setRunbook] = React.useState<RunbookReadT | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    apiFetch(`/api/forge/missions/${missionId}/runbook`, { schema: RunbookRead })
      .then((d) => {
        if (!cancelled) setRunbook(d);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [missionId]);

  if (error) {
    return (
      <div className="glass-card rounded-2xl p-6 text-body">
        <p className="text-foreground">Could not load runbook: {error}</p>
      </div>
    );
  }
  if (!runbook) {
    return (
      <div className="glass-card rounded-2xl p-6 text-body">
        <p className="text-muted-foreground">Loading runbook…</p>
      </div>
    );
  }

  return (
    <article className="space-y-6">
      <header className="glass-panel rounded-2xl p-6">
        <p className="text-eyebrow text-brand-700">Runbook</p>
        <h1 className="text-h1 text-foreground">{runbook.title}</h1>
        <p className="mt-2 text-small text-muted-foreground">
          Schema: <code>{runbook.schemaVersion}</code>
        </p>
      </header>
      <section className="space-y-3">
        {runbook.steps.map((s) => (
          <div key={`step-${s.orderIndex}`} className="glass-card rounded-2xl p-6">
            <p className="text-caption uppercase tracking-wide text-brand-700">
              Step {s.orderIndex + 1}
            </p>
            <h2 className="text-h3">{s.heading}</h2>
            <p className="mt-2 text-body">{s.body}</p>
          </div>
        ))}
      </section>
      {runbook.escalationContacts.length > 0 ? (
        <section className="glass-card rounded-2xl p-6">
          <h3 className="text-h4">Escalation contacts</h3>
          <ul className="mt-2 space-y-1 text-body">
            {runbook.escalationContacts.map((e) => (
              <li key={`esc-${e.role}-${e.contact}`}>
                <strong>{e.role}:</strong> {e.contact}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </article>
  );
}
