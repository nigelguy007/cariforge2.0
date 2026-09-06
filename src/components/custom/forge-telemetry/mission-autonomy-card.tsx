// @polsia:user-owned — Mission autonomy card. Read-only; reads
// /api/forge/missions/[id]/telemetry and surfaces per-gate approve / edit /
// reject counts, AI vs Human share, and the bucketised draft age.

'use client';

import * as React from 'react';
import { apiFetch } from '@/lib/api-client';
import { apiErrorMessage } from '@/lib/api-error-message';
import { type MissionAutonomyT, MissionTelemetryRead } from '@/lib/contracts/telemetry';

function toneForActor(actor: MissionAutonomyT['releaseActor']): string {
  if (actor === 'AIOnly') return 'ring-brand-500/50';
  if (actor === 'Human') return 'ring-emerald-500/50';
  return 'ring-amber-500/50';
}

function actorLabel(actor: MissionAutonomyT['releaseActor']): string {
  if (actor === 'AIOnly') return 'AI only — every gate ran without human review';
  if (actor === 'Human') return 'Human released — explicit operator override';
  return 'Hybrid — both AI and Human participated';
}

export function MissionAutonomyCard({ missionSlug }: { missionSlug: string }) {
  const [autonomy, setAutonomy] = React.useState<MissionAutonomyT | null>(null);
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
        if (!cancelled) setAutonomy(t.autonomy);
      } catch (err) {
        if (!cancelled) setError(apiErrorMessage(err, 'Autonomy telemetry could not be loaded.'));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [missionSlug]);

  if (error) {
    return (
      <section className="glass-card rounded-2xl p-6 text-body">
        <p className="text-foreground">Could not load autonomy view: {error}</p>
      </section>
    );
  }
  if (!autonomy) {
    return (
      <section className="glass-card rounded-2xl p-6">
        <p className="text-eyebrow text-brand-700">Autonomy</p>
        <p className="mt-2 text-body text-muted-foreground">Loading autonomy view…</p>
      </section>
    );
  }

  return (
    <section className={`glass-card rounded-2xl p-6 ring-1 ${toneForActor(autonomy.releaseActor)}`}>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-eyebrow text-brand-700">Autonomy</p>
          <h3 className="text-h3">{autonomy.releaseActor}</h3>
          <p className="mt-1 text-small text-muted-foreground">
            {actorLabel(autonomy.releaseActor)}
          </p>
        </div>
        <div className="text-right">
          <p className="text-caption uppercase tracking-wide text-muted-foreground">Draft age</p>
          <p className="text-h4">
            {autonomy.draftAge.isAwaiting ? autonomy.draftAge.bucket : 'released'}
          </p>
          {autonomy.draftAge.isAwaiting ? (
            <p className="text-caption text-muted-foreground">
              {autonomy.draftAge.daysOld}d awaiting release
            </p>
          ) : null}
        </div>
      </header>

      <div className="mt-4 grid gap-3 md:grid-cols-5">
        {autonomy.gates.map((g) => (
          <div key={g.gateIndex} className="glass-chip rounded-xl p-4">
            <p className="text-caption uppercase tracking-wide text-muted-foreground">
              Gate {g.gateIndex}
            </p>
            <p className="mt-1 text-small">{g.stage}</p>
            <dl className="mt-2 grid grid-cols-3 gap-1 text-small">
              <div>
                <dt className="text-caption text-muted-foreground">Appr</dt>
                <dd>{g.approved}</dd>
              </div>
              <div>
                <dt className="text-caption text-muted-foreground">Edit</dt>
                <dd>{g.edited}</dd>
              </div>
              <div>
                <dt className="text-caption text-muted-foreground">Reject</dt>
                <dd>{g.rejected}</dd>
              </div>
            </dl>
            <p className="mt-3 text-caption text-muted-foreground">
              {g.aiOnlyApprovals} AI · {g.humanApprovals} human
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
