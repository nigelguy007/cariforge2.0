// @polsia:user-owned — Rollback form (target handoff).
'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { apiFetch } from '@/lib/api-client';
import { MissionDetail, type MissionDetailT, RollbackRequest } from '@/lib/contracts/forge';

export function MissionRollbackForm({
  detail,
  onWritten,
}: {
  detail: MissionDetailT;
  onWritten: () => Promise<void> | void;
}) {
  const [target, setTarget] = useState<string>('');
  const [reasonText, setReasonText] = useState('');

  const onRollback = async () => {
    if (!target || !reasonText.trim()) {
      toast.error('Pick a handoff to roll back to and write a reason.');
      return;
    }
    try {
      await apiFetch(`/api/forge/missions/${detail.mission.id}/rollback`, {
        method: 'POST',
        body: JSON.stringify(
          RollbackRequest.parse({
            toStageHandoffId: target,
            reasonCode: 'StaleInformation',
            reasonText,
          }),
        ),
        schema: MissionDetail,
      });
      toast.success('Rolled back');
      setReasonText('');
      onWritten();
    } catch (err) {
      toast.error((err as Error).message ?? 'Could not rollback');
    }
  };

  if (detail.handoffs.length === 0) return null;

  return (
    <div className="glass-card flex flex-wrap items-center gap-2 rounded-xl p-3">
      <select
        value={target}
        onChange={(e) => setTarget(e.target.value)}
        className="rounded-md border border-border bg-background px-2 py-1 text-small"
      >
        <option value="">Roll back to…</option>
        {detail.handoffs.map((h) => (
          <option key={h.id} value={h.id}>
            {h.stage} v{h.version}
          </option>
        ))}
      </select>
      <input
        className="rounded-md border border-border bg-background px-2 py-1 text-small"
        value={reasonText}
        onChange={(e) => setReasonText(e.target.value)}
        placeholder="Reason for rollback"
      />
      <Button type="button" size="sm" variant="outline" onClick={onRollback}>
        Roll back
      </Button>
    </div>
  );
}
