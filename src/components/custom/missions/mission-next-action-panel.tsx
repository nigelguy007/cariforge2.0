// @polsia:user-owned — Mission Control "next human action" panel.
'use client';

import * as React from 'react';
import { apiFetch } from '@/lib/api-client';
import { NextActionResponse, type NextActionResponseT } from '@/lib/contracts/forge';

export function MissionNextActionPanel({ missionId }: { missionId: string }) {
  const [data, setData] = React.useState<NextActionResponseT | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    apiFetch(`/api/forge/missions/${missionId}/next-action`, { schema: NextActionResponse })
      .then((d) => {
        if (!cancelled) setData(d);
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
        <p className="text-foreground">Could not load next action: {error}</p>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="glass-card rounded-2xl p-6 text-body">
        <p className="text-muted-foreground">Loading next action…</p>
      </div>
    );
  }

  const tone = pickTone(data.view.kind, data.isTerminal);
  return (
    <section
      className={`glass-card lift-soft rounded-2xl p-6 ring-1 ${tone.ring} ${tone.bg}`}
      aria-live="polite"
    >
      <header>
        <p className="text-caption uppercase tracking-wide text-brand-700">
          Mission Control · Next human action
        </p>
        <h2 className="text-h3 text-foreground">{data.view.title}</h2>
        {'rationale' in data.view && data.view.rationale ? (
          <p className="mt-2 text-body text-muted-foreground">{data.view.rationale}</p>
        ) : null}
      </header>
      {data.blockers.length > 0 ? (
        <div className="mt-4 rounded-xl border border-border/60 p-3">
          <p className="text-caption uppercase tracking-wide text-muted-foreground">Blockers</p>
          <ul className="mt-2 space-y-1 text-body">
            {data.blockers.map((b) => (
              <li key={b}>• {b}</li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="mt-3 text-small text-muted-foreground">No outstanding blockers.</p>
      )}
    </section>
  );
}

function pickTone(kind: string, terminal: boolean): { ring: string; bg: string } {
  if (terminal) return { ring: 'ring-emerald-500/40', bg: 'bg-emerald-500/10' };
  if (kind === 'Pause' || kind === 'Resume')
    return { ring: 'ring-slate-500/40', bg: 'bg-slate-500/10' };
  if (kind === 'Replay') return { ring: 'ring-rose-500/40', bg: 'bg-rose-500/10' };
  if (kind === 'ResolveObjection' || kind === 'DecideToolAction')
    return { ring: 'ring-amber-500/40', bg: 'bg-amber-500/10' };
  return { ring: 'ring-brand-500/40', bg: 'bg-brand-500/10' };
}
