// @polsia:user-owned — Blueprint view client island.
'use client';

import * as React from 'react';
import { apiFetch } from '@/lib/api-client';
import { BlueprintRead, type BlueprintReadT } from '@/lib/contracts/forge';

export function MissionBlueprintView({ missionId }: { missionId: string }) {
  const [blueprint, setBlueprint] = React.useState<BlueprintReadT | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    apiFetch(`/api/forge/missions/${missionId}/blueprint`, { schema: BlueprintRead })
      .then((d) => {
        if (!cancelled) setBlueprint(d);
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
        <p className="text-foreground">Could not load blueprint: {error}</p>
      </div>
    );
  }
  if (!blueprint) {
    return (
      <div className="glass-card rounded-2xl p-6 text-body">
        <p className="text-muted-foreground">Loading blueprint…</p>
      </div>
    );
  }

  return (
    <article className="space-y-6">
      <header className="glass-panel rounded-2xl p-6">
        <p className="text-eyebrow text-brand-700">Blueprint</p>
        <h1 className="text-h1 text-foreground">{blueprint.title}</h1>
        <p className="mt-2 text-body text-muted-foreground">{blueprint.summary}</p>
        <p className="mt-2 text-small text-muted-foreground">
          Schema: <code>{blueprint.schemaVersion}</code>
        </p>
      </header>
      <section className="space-y-3">
        {blueprint.blocks.map((b, idx) => (
          <div key={`b-${idx}-${b.heading}`} className="glass-card rounded-2xl p-6">
            <p className="text-caption uppercase tracking-wide text-brand-700">
              Source stage: {b.sourceStage}
            </p>
            <h2 className="text-h3">{b.heading}</h2>
            <p className="mt-2 whitespace-pre-wrap text-body text-foreground">{b.body}</p>
          </div>
        ))}
      </section>
      {blueprint.reuseSignals.length > 0 ? (
        <section className="glass-card rounded-2xl p-6">
          <h3 className="text-h4">Reuse signals</h3>
          <ul className="mt-2 space-y-1 text-body">
            {blueprint.reuseSignals.map((s) => (
              <li key={s}>• {s}</li>
            ))}
          </ul>
        </section>
      ) : null}
    </article>
  );
}
