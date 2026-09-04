// @polsia:user-owned — Release status panel (read) + release readout (post).
'use client';

import * as React from 'react';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api-client';
import { ReleaseRead, type ReleaseReadT } from '@/lib/contracts/forge';
import { DECISION_UI, RELEASE_STATUS_UI, stageUiForIndex } from '@/lib/ui-terms';

export function MissionReleasePanel({ missionId }: { missionId: string }) {
  const [release, setRelease] = React.useState<ReleaseReadT | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [recording, setRecording] = React.useState(false);

  const refresh = React.useCallback(async () => {
    try {
      const r = await apiFetch(`/api/forge/missions/${missionId}/release`, { schema: ReleaseRead });
      setRelease(r);
    } catch (err) {
      setError((err as Error).message);
    }
  }, [missionId]);

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  const onRecord = React.useCallback(async () => {
    setRecording(true);
    try {
      const r = await apiFetch(`/api/forge/missions/${missionId}/release`, {
        method: 'POST',
        body: JSON.stringify({ summary: 'Build approved and recorded for release.' }),
        schema: ReleaseRead,
      });
      setRelease(r);
      toast.success('Release readout recorded');
    } catch (err) {
      toast.error((err as Error).message ?? 'Could not record release readout');
    } finally {
      setRecording(false);
    }
  }, [missionId]);

  if (error) {
    return (
      <div className="glass-card rounded-2xl p-6 text-body">
        <p className="text-foreground">Could not load release status: {error}</p>
      </div>
    );
  }
  if (!release) {
    return (
      <div className="glass-card rounded-2xl p-6 text-body">
        <p className="text-muted-foreground">Loading release status…</p>
      </div>
    );
  }

  const tone = pickTone(release.releaseStatus);
  return (
    <section className={`glass-card rounded-2xl p-6 ring-1 ${tone}`}>
      <header>
        <p className="text-caption uppercase tracking-wide text-brand-700">Release readout</p>
        <h3 className="text-h3">
          {RELEASE_STATUS_UI[release.releaseStatus] ?? release.releaseStatus}
        </h3>
        <p className="mt-2 text-body">{release.summary}</p>
      </header>
      <dl className="mt-4 grid gap-3 text-body md:grid-cols-2">
        <div>
          <dt className="text-caption text-muted-foreground">Completed at</dt>
          <dd>
            {release.completedAt
              ? new Date(release.completedAt).toLocaleString()
              : 'Not completed.'}
          </dd>
        </div>
        <div>
          <dt className="text-caption text-muted-foreground">Release readout at</dt>
          <dd>
            {release.releaseReadoutAt
              ? new Date(release.releaseReadoutAt).toLocaleString()
              : 'Not recorded.'}
          </dd>
        </div>
        <div>
          <dt className="text-caption text-muted-foreground">Last approval</dt>
          <dd>
            {release.lastApproval
              ? `${DECISION_UI[release.lastApproval.decision]} — ${stageUiForIndex(release.lastApproval.gateIndex).title}`
              : '—'}
          </dd>
        </div>
        <div>
          <dt className="text-caption text-muted-foreground">Last tool execution</dt>
          <dd>
            {release.lastToolActionExecutedAt
              ? new Date(release.lastToolActionExecutedAt).toLocaleString()
              : 'No tool actions executed yet.'}
          </dd>
        </div>
      </dl>
      {release.releaseStatus === 'BuildApprovedNotReleased' ? (
        <button
          type="button"
          className="glass-cta mt-4 rounded-full px-4 py-2 text-body"
          onClick={onRecord}
          disabled={recording}
        >
          {recording ? 'Recording…' : 'Record release readout'}
        </button>
      ) : null}
    </section>
  );
}

function pickTone(status: string): string {
  if (status === 'Released') return 'ring-emerald-500/40';
  if (status === 'BuildApprovedNotReleased') return 'ring-amber-500/40';
  if (status === 'Paused') return 'ring-slate-500/40';
  if (status === 'RolledBack') return 'ring-rose-500/40';
  if (status === 'Blocked') return 'ring-rose-500/40';
  if (status === 'WalkedAway') return 'ring-slate-500/40';
  return 'ring-brand-500/40';
}
