// @polsia:user-owned — node-by-node run trace (Mission Control seed view
// for the Release 1 slice). Shows each executed node's status, input and
// output as inspectable evidence, plus a jump to the Approval Desk when
// the run is paused on a human gate.

'use client';

import Link from 'next/link';
import * as React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { apiFetch } from '@/lib/api-client';
import { CanvasRunDetail, type CanvasRunDetailT } from '@/lib/contracts/forge-canvas';
import { cn } from '@/lib/utils';

function statusTone(status: string): string {
  switch (status) {
    case 'Succeeded':
    case 'Approved':
      return 'bg-emerald-500/15 text-emerald-800';
    case 'Failed':
    case 'Rejected':
      return 'bg-rose-500/15 text-rose-800';
    case 'AwaitingApproval':
      return 'bg-amber-500/15 text-amber-800';
    default:
      return 'bg-muted text-muted-foreground';
  }
}

function Pretty({ value }: { value: unknown }) {
  if (value === null || value === undefined) return <span className="text-muted-foreground">—</span>;
  return (
    <pre className="max-h-48 overflow-auto rounded-md bg-muted/40 p-2 font-mono text-xs">
      {typeof value === 'string' ? value : JSON.stringify(value, null, 2)}
    </pre>
  );
}

export function RunTrace({ runId }: { runId: string }) {
  const [run, setRun] = React.useState<CanvasRunDetailT | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const refresh = React.useCallback(() => {
    apiFetch(`/api/forge-canvas/runs/${runId}`, { schema: CanvasRunDetail })
      .then(setRun)
      .catch(() => setError('Could not load this run.'));
  }, [runId]);
  React.useEffect(refresh, [refresh]);

  if (error) return <p className="text-small text-destructive">{error}</p>;
  if (!run) return <p className="text-small text-muted-foreground">Loading run…</p>;

  return (
    <div className="space-y-4">
      <header className="glass-card flex flex-wrap items-center gap-3 rounded-2xl p-5">
        <div>
          <p className="text-caption uppercase tracking-wide text-brand-700">Test run</p>
          <h1 className="text-h3 text-foreground">
            {run.blueprintName}{' '}
            <span className="font-mono text-small text-muted-foreground">
              {run.blueprintSlug} v{run.blueprintVersion}
            </span>
          </h1>
        </div>
        <Badge className={cn('ml-auto', statusTone(run.status))}>{run.status}</Badge>
        {run.status === 'AwaitingApproval' && (
          <Button asChild size="sm" className="glass-cta">
            <Link href="/forge/approvals">Open Approval Desk</Link>
          </Button>
        )}
        <Button type="button" size="sm" variant="secondary" onClick={refresh}>
          Refresh
        </Button>
      </header>

      <ol className="space-y-3">
        {run.nodeRuns.map((n) => (
          <li key={`${n.ordinal}-${n.nodeId}`} className="glass-card rounded-xl p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs text-muted-foreground">#{n.ordinal}</span>
              <span className="text-small font-medium text-foreground">{n.nodeId}</span>
              <span className="text-xs uppercase tracking-wide text-muted-foreground">
                {n.nodeType}
              </span>
              <Badge className={cn('ml-auto', statusTone(n.status))}>{n.status}</Badge>
            </div>
            {n.error ? <p className="mt-2 text-small text-destructive">{n.error}</p> : null}
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <div>
                <p className="text-caption text-muted-foreground">Input</p>
                <Pretty value={n.input} />
              </div>
              <div>
                <p className="text-caption text-muted-foreground">Output</p>
                <Pretty value={n.output} />
              </div>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
