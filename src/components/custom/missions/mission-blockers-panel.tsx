// @polsia:user-owned — Blockers panel: outstanding objections + outstanding
// tool decisions + paused state. Client island reads the same mission detail.

'use client';

import * as React from 'react';
import { apiFetch } from '@/lib/api-client';
import { MissionDetail, type MissionDetailT, MissionList } from '@/lib/contracts/forge';
import { humanise } from '@/lib/ui-terms';

export function MissionBlockersPanel({ missionSlug }: { missionSlug: string }) {
  const [detail, setDetail] = React.useState<MissionDetailT | null>(null);
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await apiFetch('/api/forge/missions', {
          schema: MissionList,
        });
        const found = list.items.find((it) => it.slug === missionSlug);
        if (!found) return;
        const d = await apiFetch(`/api/forge/missions/${found.id}`, {
          schema: MissionDetail,
        });
        if (!cancelled) setDetail(d);
      } catch {
        // ignored — parent detail view will surface errors
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [missionSlug]);
  if (!detail) return null;
  const outstandingObjections = detail.objections.filter((o) => o.resolution === null);
  const outstandingToolActions = detail.toolActions.filter((t) => t.decision === null);
  const isPaused = detail.mission.status === 'Paused';
  const isBlocked = detail.mission.status === 'Blocked' || detail.mission.status === 'RolledBack';
  const blockers: Array<{ id: string; label: string }> = [];
  if (isPaused) blockers.push({ id: 'paused', label: 'This project is paused.' });
  if (isBlocked) blockers.push({ id: 'blocked', label: 'This project is blocked.' });
  for (const o of outstandingObjections) {
    blockers.push({
      id: `obj-${o.id}`,
      label: `Unresolved objection from ${o.raisedByRole}.`,
    });
  }
  for (const t of outstandingToolActions) {
    blockers.push({
      id: `ta-${t.id}`,
      label: `Pending decision: ${humanise(t.tool)} (${humanise(t.scope)}).`,
    });
  }
  if (blockers.length === 0) {
    return (
      <div className="glass-card rounded-2xl p-6 text-body">
        <h3 className="text-h4">No outstanding blockers</h3>
        <p className="mt-1 text-small text-muted-foreground">
          This project can proceed to the next decision without further input.
        </p>
      </div>
    );
  }
  return (
    <section className="glass-card rounded-2xl p-6">
      <header>
        <p className="text-caption uppercase tracking-wide text-rose-700">Blockers</p>
        <h3 className="text-h4">{blockers.length} outstanding</h3>
      </header>
      <ul className="mt-3 space-y-2 text-body">
        {blockers.map((b) => (
          <li key={b.id} className="rounded-xl border border-border/60 p-3">
            {b.label}
          </li>
        ))}
      </ul>
    </section>
  );
}
