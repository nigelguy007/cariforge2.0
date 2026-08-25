// @polsia:user-owned — Mission cost card. Read-only; pulls blended model +
// chat cost cents, surfaces hasUnknownCost HONESTLY (a yellow badge, never
// a silent estimate).

'use client';

import * as React from 'react';
import { apiFetch } from '@/lib/api-client';
import { type MissionCostT, MissionTelemetryRead } from '@/lib/contracts/telemetry';

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function MissionCostCard({ missionSlug }: { missionSlug: string }) {
  const [cost, setCost] = React.useState<MissionCostT | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await apiFetch('/api/forge/missions', {
          schema: (await import('@/lib/contracts/forge')).MissionList,
        });
        const found = list.items.find((it) => it.slug === missionSlug);
        if (!found) {
          setError('Mission not found');
          return;
        }
        const t = await apiFetch(`/api/forge/missions/${found.id}/telemetry`, {
          schema: MissionTelemetryRead,
        });
        if (!cancelled) setCost(t.cost);
      } catch (err) {
        if (!cancelled) setError((err as Error).message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [missionSlug]);

  if (error) {
    return (
      <section className="glass-card rounded-2xl p-6 text-body">
        <p className="text-foreground">Could not load cost rollup: {error}</p>
      </section>
    );
  }
  if (!cost) {
    return (
      <section className="glass-card rounded-2xl p-6">
        <p className="text-eyebrow text-brand-700">Cost attribution</p>
        <p className="mt-2 text-body text-muted-foreground">Loading cost rollup…</p>
      </section>
    );
  }

  return (
    <section className="glass-card rounded-2xl p-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-eyebrow text-brand-700">Cost attribution</p>
          <h3 className="text-h3">Blended cost — {formatCents(cost.blendedCents)}</h3>
          <p className="mt-1 text-small text-muted-foreground">
            Model {formatCents(cost.modelCents)} · Chat {formatCents(cost.chatCents)}
          </p>
        </div>
        {cost.hasUnknownCost ? (
          <span className="rounded-full bg-amber-500/15 px-3 py-1 text-caption text-amber-700 dark:text-amber-300">
            Unknown cost · surface, do not guess
          </span>
        ) : null}
      </header>

      {cost.byDay.length === 0 ? (
        <p className="mt-4 text-body text-muted-foreground">No cost rows yet.</p>
      ) : (
        <ul className="mt-4 divide-y divide-border/50">
          {cost.byDay.map((row) => (
            <li key={row.day} className="flex items-center justify-between py-2 text-body">
              <span>
                <code>{row.day}</code> — {row.messages} chat messages
              </span>
              <span>{formatCents(row.cents)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
