// @polsia:user-owned — the warm-path lane. Prospects with a known connection
// are never cold-sent; they land here so the founder can ask the connector for
// an intro, then mark it via POST /api/admin/fundraise/prospects/{id}/intro.

'use client';

import { Check, Loader2 } from 'lucide-react';
import * as React from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import type { ProspectView } from '@/lib/contracts/fundraise-loop';
import { ProspectLine } from './approval-queue';
import { errorMessage, OkResponse, Panel, sendJson } from './fundraise-shared';

export function WarmIntros({
  prospects,
  segmentLabels,
  onChanged,
}: {
  prospects: ProspectView[];
  segmentLabels: Record<string, string>;
  onChanged: () => Promise<void>;
}) {
  const [busyId, setBusyId] = React.useState<string | null>(null);

  const markRequested = async (p: ProspectView) => {
    setBusyId(p.id);
    try {
      await sendJson(
        `/api/admin/fundraise/prospects/${encodeURIComponent(p.id)}/intro`,
        'POST',
        {},
        OkResponse,
      );
      toast.success(`Marked intro requested for ${p.fullName}`);
      await onChanged();
    } catch (err) {
      toast.error(errorMessage(err, 'Could not mark the intro as requested.'));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Panel
      labelledBy="fundraise-warm"
      eyebrow="Warm intros"
      title={`${prospects.length} ${prospects.length === 1 ? 'person' : 'people'} with a warm path`}
      description="Never cold-sent — ask the connector for an intro."
    >
      {prospects.length === 0 ? (
        <p className="app-small p-5 text-[var(--app-text-muted)]">
          No warm paths right now. When a prospect has a known connection they show up here instead
          of in a cold batch.
        </p>
      ) : (
        <ul className="divide-y divide-[var(--app-border)]">
          {prospects.map((p) => {
            const requested = p.status === 'INTRO_REQUESTED';
            return (
              <li
                key={p.id}
                className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between sm:p-5"
              >
                <div className="flex min-w-0 flex-col gap-2">
                  <ProspectLine prospect={p} segmentLabels={segmentLabels} />
                  {p.warmPath ? (
                    <p className="app-small rounded-[var(--app-radius-sm)] bg-[var(--app-surface-muted)] px-3 py-2 text-[var(--app-text)]">
                      <span className="font-medium">Warm path: </span>
                      {p.warmPath}
                    </p>
                  ) : null}
                </div>
                {requested ? (
                  <span className="app-small inline-flex shrink-0 items-center gap-1.5 text-[var(--app-text-muted)]">
                    <Check aria-hidden className="size-4" />
                    Intro requested
                  </span>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="shrink-0"
                    disabled={busyId !== null}
                    onClick={() => void markRequested(p)}
                    aria-label={`Mark intro requested for ${p.fullName}`}
                  >
                    {busyId === p.id ? <Loader2 aria-hidden className="animate-spin" /> : null}
                    Mark intro requested
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}
