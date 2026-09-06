// @polsia:user-owned — Runbook client island: resolves slug → id, renders
// the derived runbook payload. No server DB access.
'use client';

import * as React from 'react';
import { apiFetch } from '@/lib/api-client';
import { apiErrorMessage } from '@/lib/api-error-message';
import { MissionList, type MissionListItemT, type RunbookReadT } from '@/lib/contracts/forge';
import { MissionRunbookView } from './mission-runbook-view';

export function MissionRunbookClient({ missionSlug }: { missionSlug: string }) {
  const [missionId, setMissionId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await apiFetch('/api/forge/missions', { schema: MissionList });
        const found: MissionListItemT | undefined = list.items.find(
          (it) => it.slug === missionSlug,
        );
        if (!found) {
          if (!cancelled) setError('Mission not found');
          return;
        }
        if (!cancelled) setMissionId(found.id);
      } catch (err) {
        if (!cancelled) setError(apiErrorMessage(err, 'This project could not be loaded.'));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [missionSlug]);

  if (error) {
    return (
      <div className="glass-card rounded-2xl p-6 text-body">
        <p className="text-foreground">Could not resolve mission: {error}</p>
      </div>
    );
  }
  if (!missionId) {
    return (
      <div className="glass-card rounded-2xl p-6 text-body">
        <p className="text-muted-foreground">Loading runbook…</p>
      </div>
    );
  }
  return <MissionRunbookView missionId={missionId} />;
}

export type { RunbookReadT };
