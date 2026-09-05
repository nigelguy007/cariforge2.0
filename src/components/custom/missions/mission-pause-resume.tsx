// @polsia:user-owned — Pause / Resume controls.
'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { apiFetch } from '@/lib/api-client';
import { apiErrorMessage } from '@/lib/api-error-message';
import {
  MissionDetail,
  type MissionDetailT,
  PauseRequest,
  ResumeRequest,
} from '@/lib/contracts/forge';

const PAUSE_OK_STATUSES = new Set([
  'Draft',
  'InDiscovery',
  'InReadiness',
  'InWorkflow',
  'InGovernance',
  'InBuild',
  'AwaitingApproval',
]);

export function MissionPauseResume({
  detail,
  onWritten,
}: {
  detail: MissionDetailT;
  onWritten: () => Promise<void> | void;
}) {
  const [reasonText, setReasonText] = useState('');

  const isPaused = detail.mission.status === 'Paused';
  const canPause = PAUSE_OK_STATUSES.has(detail.mission.status);

  const onPause = async () => {
    if (!reasonText.trim()) {
      toast.error('Reason text is required');
      return;
    }
    try {
      await apiFetch(`/api/forge/missions/${detail.mission.id}/pause`, {
        method: 'POST',
        body: JSON.stringify(PauseRequest.parse({ reasonCode: 'Other', reasonText })),
        schema: MissionDetail,
      });
      toast.success('Project paused');
      setReasonText('');
      onWritten();
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Could not pause'));
    }
  };
  const onResume = async () => {
    if (!reasonText.trim()) {
      toast.error('Reason text is required');
      return;
    }
    try {
      await apiFetch(`/api/forge/missions/${detail.mission.id}/resume`, {
        method: 'POST',
        body: JSON.stringify(ResumeRequest.parse({ reasonCode: 'Other', reasonText })),
        schema: MissionDetail,
      });
      toast.success('Project resumed');
      setReasonText('');
      onWritten();
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Could not resume'));
    }
  };

  return (
    <div className="glass-card flex flex-wrap items-center gap-2 rounded-xl p-3">
      <input
        className="rounded-md border border-border bg-background px-2 py-1 text-small"
        value={reasonText}
        onChange={(e) => setReasonText(e.target.value)}
        placeholder="Reason for pause/resume"
      />
      {isPaused ? (
        <Button type="button" size="sm" className="glass-cta" onClick={onResume}>
          Resume
        </Button>
      ) : canPause ? (
        <Button type="button" size="sm" variant="outline" onClick={onPause}>
          Pause
        </Button>
      ) : null}
    </div>
  );
}
