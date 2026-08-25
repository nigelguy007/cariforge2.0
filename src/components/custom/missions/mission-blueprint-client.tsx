// @polsia:user-owned — Blueprint client island: resolves slug → id, renders
// the derived blueprint payload. No server DB access.
'use client';

import * as React from 'react';
import { apiFetch } from '@/lib/api-client';
import { type BlueprintReadT, MissionList, type MissionListItemT } from '@/lib/contracts/forge';
import { MissionBlueprintView } from './mission-blueprint-view';

export function MissionBlueprintClient({ missionSlug }: { missionSlug: string }) {
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
        if (!cancelled) setError((err as Error).message);
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
        <p className="text-muted-foreground">Loading blueprint…</p>
      </div>
    );
  }
  return <MissionBlueprintView missionId={missionId} />;
}

// Patch the BlueprintView type so TS understands it accepts the same prop.
export type { BlueprintReadT };
