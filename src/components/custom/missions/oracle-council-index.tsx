// @polsia:user-owned — /pilot/oracle-council client island. Lists the user's
// missions + the appointed Elder Oracle per mission; clicking one opens the
// mission detail page where the gate panels & handoff attesters live.

'use client';

import Link from 'next/link';
import * as React from 'react';
import { Button } from '@/components/ui/button';
import { apiFetch } from '@/lib/api-client';
import { type MissionListItemT, MissionList as MissionListSchema } from '@/lib/contracts/forge';

export function OracleCouncilIndex() {
  const [items, setItems] = React.useState<MissionListItemT[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    apiFetch('/api/forge/missions', { schema: MissionListSchema })
      .then((data) => {
        if (!cancelled) setItems(data.items);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <div className="glass-card rounded-2xl p-6 text-body">
        <p>Could not load missions: {error}</p>
      </div>
    );
  }
  if (items === null) {
    return (
      <div className="glass-card rounded-2xl p-6 text-body">
        <p className="text-muted-foreground">Loading missions…</p>
      </div>
    );
  }
  if (items.length === 0) {
    return (
      <div className="glass-card rounded-2xl p-8 text-body">
        <h2 className="text-h3">No missions yet</h2>
        <p className="mt-2 text-muted-foreground">
          Capture a plain-English need and the Forge will turn it into a governed, testable pilot
          mission that moves through The Oracles.
        </p>
        <Button asChild className="glass-cta mt-4">
          <Link href="/missions/new">Start a mission</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      {items.map((m) => (
        <Link
          key={m.id}
          href={`/missions/${m.slug}`}
          className="glass-card lift-soft block rounded-2xl p-5"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-eyebrow text-brand-700">Mission</p>
              <h3 className="text-h4 text-foreground">{m.name}</h3>
              <p className="mt-1 text-small text-muted-foreground">
                Stage {m.currentStageIndex} · Confidence {Math.round(m.confidence * 100)}%
              </p>
            </div>
            <div className="flex flex-col items-end gap-1 text-caption">
              <span className="text-muted-foreground">Elder Oracle</span>
              {m.elderOracleUserId ? (
                <code className="glass-chip rounded-full bg-brand-50 px-2 py-0.5 text-brand-700">
                  {m.elderOracleUserId}
                </code>
              ) : (
                <span className="glass-chip rounded-full bg-amber-100 px-2 py-0.5 text-amber-800">
                  not appointed
                </span>
              )}
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
