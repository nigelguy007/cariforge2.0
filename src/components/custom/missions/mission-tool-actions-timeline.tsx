// @polsia:user-owned — Tool action timeline.
'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { apiFetch } from '@/lib/api-client';
import { useIsAdmin } from '@/lib/auth-client';
import {
  GATE_REASON_CODES,
  MissionDetail,
  type MissionDetailT,
  ToolActionDecide,
  type ToolActionItemT,
  ToolActionRollback,
} from '@/lib/contracts/forge';
import { humanise } from '@/lib/ui-terms';

export function MissionToolActionsTimeline({
  detail,
  onWritten,
}: {
  detail: MissionDetailT;
  onWritten: () => Promise<void> | void;
}) {
  if (detail.toolActions.length === 0) {
    return (
      <div className="glass-card rounded-2xl p-6 text-body text-muted-foreground">
        No tool actions have been proposed yet.
      </div>
    );
  }
  return (
    <ol className="space-y-3">
      {detail.toolActions.map((t) => (
        <li key={t.id}>
          <ToolActionCard toolAction={t} missionId={detail.mission.id} onWritten={onWritten} />
        </li>
      ))}
    </ol>
  );
}

function ToolActionCard({
  toolAction,
  missionId,
  onWritten,
}: {
  toolAction: ToolActionItemT;
  missionId: string;
  onWritten: () => Promise<void> | void;
}) {
  const [rollbackTarget, setRollbackTarget] = useState('');
  const [rollbackReason, setRollbackReason] = useState('StaleInformation');
  const isAdmin = useIsAdmin();

  const decide = async (decision: 'Approved' | 'Denied') => {
    try {
      await apiFetch(`/api/forge/missions/${missionId}/tool-actions/${toolAction.id}/decide`, {
        method: 'POST',
        body: JSON.stringify(
          ToolActionDecide.parse({
            decision,
            reasonCode: decision === 'Approved' ? 'Approved' : 'GovernanceViolation',
          }),
        ),
        schema: MissionDetail,
      });
      toast.success(`Tool action ${decision === 'Approved' ? 'approved' : 'denied'}`);
      onWritten();
    } catch (err) {
      toast.error((err as Error).message ?? 'Could not record decision');
    }
  };

  const execute = async () => {
    try {
      await apiFetch(`/api/forge/missions/${missionId}/tool-actions/${toolAction.id}/execute`, {
        method: 'POST',
        body: JSON.stringify({ resultRef: `forge-result:${toolAction.id}` }),
        schema: MissionDetail,
      });
      toast.success('Tool action run');
      onWritten();
    } catch (err) {
      toast.error((err as Error).message ?? 'Could not execute');
    }
  };

  const rollback = async () => {
    try {
      await apiFetch(`/api/forge/missions/${missionId}/tool-actions/${toolAction.id}/rollback`, {
        method: 'POST',
        body: JSON.stringify(
          ToolActionRollback.parse({
            rollbackOfToolActionId:
              rollbackTarget || toolAction.rollbackOfToolActionId || toolAction.id,
            reasonCode: rollbackReason,
            reasonText: 'Manual rollback from timeline.',
          }),
        ),
        schema: MissionDetail,
      });
      toast.success('Rollback recorded');
      onWritten();
    } catch (err) {
      toast.error((err as Error).message ?? 'Could not record rollback');
    }
  };

  return (
    <article className="glass-card lift-soft space-y-2 rounded-2xl p-5">
      <header className="flex items-start justify-between gap-4">
        <div>
          <p className="text-caption uppercase tracking-wide text-brand-700">
            {humanise(toolAction.scope)}
          </p>
          <p className="text-h4">{humanise(toolAction.tool)}</p>
        </div>
        <span className="glass-chip rounded-full px-2.5 py-0.5 text-caption">
          {toolAction.executedAt
            ? 'Run'
            : toolAction.decision
              ? toolAction.decision === 'Approved'
                ? 'Approved'
                : 'Denied'
              : 'Awaiting your decision'}
        </span>
      </header>
      {isAdmin ? (
        <pre className="overflow-x-auto rounded-lg bg-muted/60 p-2 text-caption">
          {JSON.stringify(toolAction.payload, null, 2).slice(0, 500)}
        </pre>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        {!toolAction.decision ? (
          <Button
            type="button"
            size="sm"
            className="glass-outline-cta"
            onClick={() => decide('Approved')}
          >
            Approve
          </Button>
        ) : null}
        {!toolAction.decision ? (
          <Button type="button" size="sm" variant="outline" onClick={() => decide('Denied')}>
            Deny
          </Button>
        ) : null}
        {isAdmin && toolAction.decision === 'Approved' && !toolAction.executedAt ? (
          <Button type="button" size="sm" className="glass-cta" onClick={execute}>
            Run it
          </Button>
        ) : null}
        {isAdmin && toolAction.executedAt ? (
          <Button type="button" size="sm" variant="outline" onClick={rollback}>
            Record rollback
          </Button>
        ) : null}
      </div>
      {isAdmin && toolAction.executedAt ? (
        <div className="grid gap-2 md:grid-cols-2">
          <label className="text-small">
            Rollback target (prior tool action ID)
            <input
              className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1 text-small"
              value={rollbackTarget}
              onChange={(e) => setRollbackTarget(e.target.value)}
              placeholder={toolAction.id}
            />
          </label>
          <label className="text-small">
            Reason code
            <select
              className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1 text-small"
              value={rollbackReason}
              onChange={(e) => setRollbackReason(e.target.value)}
            >
              {GATE_REASON_CODES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
        </div>
      ) : null}
    </article>
  );
}
