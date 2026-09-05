// @polsia:user-owned — Targeted replay form.
'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { apiFetch } from '@/lib/api-client';
import { apiErrorMessage } from '@/lib/api-error-message';
import { MissionDetail, type MissionDetailT, ReplayRequest } from '@/lib/contracts/forge';

export function MissionReplayForm({
  detail,
  onWritten,
}: {
  detail: MissionDetailT;
  onWritten: () => Promise<void> | void;
}) {
  const [fromStageIndex, setFromStageIndex] = useState(0);
  const [reasonText, setReasonText] = useState('');

  const onReplay = async () => {
    if (!reasonText.trim()) {
      toast.error('Reason text is required');
      return;
    }
    try {
      await apiFetch(`/api/forge/missions/${detail.mission.id}/replay`, {
        method: 'POST',
        body: JSON.stringify(
          ReplayRequest.parse({
            fromStageIndex,
            reasonCode: 'ReplayRequired',
            reasonText,
          }),
        ),
        schema: MissionDetail,
      });
      toast.success('Replay executed');
      setReasonText('');
      onWritten();
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Could not replay'));
    }
  };

  return (
    <div className="glass-card flex flex-wrap items-center gap-2 rounded-xl p-3">
      <select
        value={String(fromStageIndex)}
        onChange={(e) => setFromStageIndex(Number.parseInt(e.target.value, 10))}
        className="rounded-md border border-border bg-background px-2 py-1 text-small"
      >
        <option value="0">From Discovery (gate 0)</option>
        <option value="1">From Readiness (gate 1)</option>
        <option value="2">From Workflow (gate 2)</option>
        <option value="3">From Governance (gate 3)</option>
        <option value="4">From Prototype Spec (gate 4)</option>
      </select>
      <input
        className="rounded-md border border-border bg-background px-2 py-1 text-small"
        value={reasonText}
        onChange={(e) => setReasonText(e.target.value)}
        placeholder="Why replay? Downstream work will be invalidated."
      />
      <Button type="button" size="sm" variant="outline" onClick={onReplay}>
        Replay from stage
      </Button>
    </div>
  );
}
