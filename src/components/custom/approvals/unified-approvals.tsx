// @polsia:user-owned — UX review C3 (wireframe v2, screen 2e): ONE inbox
// for every human decision. Gate approvals (missions sitting at
// AwaitingApproval) and paused canvas runs are the same primitive — a
// decision with a required typed reason — so they share a queue, filtered
// by type. Deciding here IS deciding there: the gate section embeds the
// exact MissionGatePanel the mission page uses, and the run section is the
// Approval Desk itself — an aggregate view, never a third system.

'use client';

import Link from 'next/link';
import * as React from 'react';
import { Button } from '@/components/ui/button';
import { apiFetch } from '@/lib/api-client';
import {
  MissionDetail as MissionDetailSchema,
  type MissionDetailT,
  MissionList as MissionListSchema,
} from '@/lib/contracts/forge';
import { ApprovalDesk } from '@/components/custom/forge-canvas/approval-desk';
import { MissionGatePanel } from '@/components/custom/missions/mission-gate-panel';

type Filter = 'all' | 'gates' | 'runs';

export function UnifiedApprovals() {
  const [filter, setFilter] = React.useState<Filter>('all');
  const [pending, setPending] = React.useState<MissionDetailT[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const loadGates = React.useCallback(async () => {
    try {
      const list = await apiFetch('/api/forge/missions', { schema: MissionListSchema });
      const awaiting = list.items.filter((m) => m.status === 'AwaitingApproval');
      const details = await Promise.all(
        awaiting.map((m) =>
          apiFetch(`/api/forge/missions/${m.id}`, { schema: MissionDetailSchema }).catch(
            () => null,
          ),
        ),
      );
      setPending(details.filter((d): d is MissionDetailT => d !== null));
    } catch (err) {
      setError((err as Error).message);
    }
  }, []);

  React.useEffect(() => {
    void loadGates();
  }, [loadGates]);

  const filters: { key: Filter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'gates', label: 'Gates' },
    { key: 'runs', label: 'Runs' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Filter approvals by type">
        {filters.map((f) => (
          <Button
            key={f.key}
            type="button"
            size="sm"
            variant={filter === f.key ? 'default' : 'secondary'}
            className={filter === f.key ? 'glass-cta rounded-full' : 'glass-chip rounded-full'}
            aria-pressed={filter === f.key}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
          </Button>
        ))}
      </div>

      {filter !== 'runs' ? (
        <section aria-label="Gate decisions">
          <h2 className="text-h3 text-foreground">Gate decisions</h2>
          {error ? (
            <div className="glass-card mt-3 rounded-2xl p-6 text-body">
              <p className="text-foreground">Could not load pending gates: {error}</p>
            </div>
          ) : pending === null ? (
            <div className="glass-card mt-3 rounded-2xl p-6 text-body">
              <p className="text-muted-foreground">Loading pending gates…</p>
            </div>
          ) : pending.length === 0 ? (
            <div className="glass-card mt-3 rounded-2xl p-6 text-body">
              <p className="text-muted-foreground">
                No gates awaiting a decision. Missions land here when a handoff is submitted for
                approval.
              </p>
            </div>
          ) : (
            <div className="mt-3 space-y-4">
              {pending.map((detail) => {
                const gate =
                  detail.gates.find(
                    (g) =>
                      g.state === 'Awaiting' &&
                      g.gateIndex === detail.mission.currentStageIndex,
                  ) ?? null;
                if (!gate) return null;
                return (
                  <div key={detail.mission.id} className="space-y-2">
                    <p className="text-body">
                      <Link
                        href={`/missions/${detail.mission.slug}`}
                        className="font-medium text-brand-700 underline-offset-4 hover:underline"
                      >
                        {detail.mission.name}
                      </Link>{' '}
                      <span className="text-small text-muted-foreground">
                        · Gate {gate.gateIndex}
                      </span>
                    </p>
                    <MissionGatePanel
                      missionId={detail.mission.id}
                      gateState={gate}
                      onWritten={loadGates}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </section>
      ) : null}

      {filter !== 'gates' ? (
        <section aria-label="Run decisions">
          <h2 className="text-h3 text-foreground">Run decisions</h2>
          <div className="mt-3">
            <ApprovalDesk />
          </div>
        </section>
      ) : null}
    </div>
  );
}
