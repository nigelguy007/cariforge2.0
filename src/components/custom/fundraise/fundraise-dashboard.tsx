// @polsia:user-owned — /admin/fundraise client island. Fetches
// GET /api/admin/fundraise (parsed against the shared LoopSummary contract)
// on mount and after every mutation, and composes the loop's panels: kill
// switch, KPIs, segments, approval queue, warm intros, outcome import and
// tuning. Initial load shows a spinner / error card like the leads island;
// later refetches keep the current data on screen and toast on failure.

'use client';

import { AlertCircle, Loader2 } from 'lucide-react';
import * as React from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { apiFetch } from '@/lib/api-client';
import { LoopSummary } from '@/lib/contracts/fundraise-loop';
import { ApprovalQueue } from './approval-queue';
import { apiStatus, errorMessage } from './fundraise-shared';
import { KpiTiles } from './kpi-tiles';
import { OutcomeImport } from './outcome-import';
import { SegmentTable } from './segment-table';
import { SendingControl } from './sending-control';
import { TuningPanel } from './tuning-panel';
import { WarmIntros } from './warm-intros';

function explainLoadError(err: unknown): string {
  const status = apiStatus(err);
  if (status === 401) return 'Unauthenticated — sign in to load the fundraise loop.';
  if (status === 403) return 'Forbidden — only an admin can load the fundraise loop.';
  return errorMessage(err, 'Could not load the fundraise loop.');
}

export function FundraiseDashboard() {
  const [summary, setSummary] = React.useState<LoopSummary | null>(null);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const loadedOnce = React.useRef(false);

  const refresh = React.useCallback(async () => {
    try {
      const next = await apiFetch('/api/admin/fundraise', { schema: LoopSummary });
      loadedOnce.current = true;
      setSummary(next);
      setLoadError(null);
    } catch (err) {
      if (loadedOnce.current) toast.error(`Could not refresh: ${explainLoadError(err)}`);
      else setLoadError(explainLoadError(err));
    }
  }, []);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  const segmentLabels = React.useMemo(() => {
    const map: Record<string, string> = {};
    for (const s of summary?.plan.segments ?? []) map[s.key] = s.label;
    return map;
  }, [summary]);

  if (loadError) {
    return (
      <div
        role="alert"
        className="flex flex-col items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-6 text-sm text-destructive"
      >
        <div className="flex items-center gap-2 font-semibold">
          <AlertCircle aria-hidden className="size-4" />
          Could not load the fundraise loop
        </div>
        <p className="text-xs text-destructive/90">{loadError}</p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            setLoadError(null);
            void refresh();
          }}
        >
          Try again
        </Button>
      </div>
    );
  }

  if (summary === null) {
    return (
      <output
        className="flex min-h-[240px] items-center justify-center gap-3 rounded-lg border border-dashed border-border bg-muted/30 text-sm text-muted-foreground"
        aria-live="polite"
      >
        <Loader2 aria-hidden className="size-4 animate-spin" />
        Loading the fundraise loop…
      </output>
    );
  }

  const { plan } = summary;

  return (
    <div className="flex flex-col gap-6">
      <SendingControl sendingEnabled={plan.sendingEnabled} onChanged={refresh} />
      <KpiTiles totals={summary.totals} />
      <ApprovalQueue
        batches={summary.batches}
        segmentLabels={segmentLabels}
        sendingEnabled={plan.sendingEnabled}
        onChanged={refresh}
      />
      <SegmentTable plan={plan} onChanged={refresh} />
      <WarmIntros
        prospects={summary.warmIntros}
        segmentLabels={segmentLabels}
        onChanged={refresh}
      />
      <OutcomeImport onChanged={refresh} />
      <TuningPanel batchSize={plan.batchSize} onChanged={refresh} />
      <p className="app-caption text-[var(--app-text-muted)]">
        Plan generated {new Date(plan.generatedAt).toLocaleString()}.
      </p>
    </div>
  );
}
