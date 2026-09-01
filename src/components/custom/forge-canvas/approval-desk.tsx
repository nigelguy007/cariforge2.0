// @polsia:user-owned — Approval Desk (handover §17, Release 1 scope):
// open approval tasks first, each showing the upstream evidence before
// the decision controls; a typed reason is REQUIRED either way, matching
// the mission gates' governance rule. Deciding resumes (or terminates)
// the paused run and links straight to its trace.

'use client';

import Link from 'next/link';
import * as React from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { apiFetch } from '@/lib/api-client';
import {
  CanvasRunDetail,
  type CanvasTaskItemT,
  CanvasTaskList,
} from '@/lib/contracts/forge-canvas';
import { cn } from '@/lib/utils';

function TaskCard({ task, onDecided }: { task: CanvasTaskItemT; onDecided: () => void }) {
  const [reason, setReason] = React.useState('');
  const [busy, setBusy] = React.useState<'Approved' | 'Rejected' | null>(null);

  const decide = async (decision: 'Approved' | 'Rejected') => {
    if (reason.trim().length === 0) {
      toast.error('A typed reason is required — same rule as every gate.');
      return;
    }
    setBusy(decision);
    try {
      await apiFetch(`/api/forge-canvas/tasks/${task.id}/decide`, {
        method: 'POST',
        body: JSON.stringify({ decision, reasonText: reason.trim() }),
        schema: CanvasRunDetail,
      });
      toast.success(`${decision} — run ${decision === 'Approved' ? 'resumed' : 'stopped'}.`);
      onDecided();
    } catch {
      toast.error('Could not record the decision.');
    } finally {
      setBusy(null);
    }
  };

  const open = task.status === 'Open';
  return (
    <li className="glass-card space-y-3 rounded-xl p-5">
      <div className="flex flex-wrap items-center gap-2">
        <div>
          <p className="text-small font-medium text-foreground">{task.title}</p>
          <p className="text-xs text-muted-foreground">
            {task.blueprintName} · {new Date(task.createdAt).toLocaleString()}
          </p>
        </div>
        <Badge
          className={cn(
            'ml-auto',
            task.status === 'Open'
              ? 'bg-amber-500/15 text-amber-800'
              : task.status === 'Approved'
                ? 'bg-emerald-500/15 text-emerald-800'
                : 'bg-rose-500/15 text-rose-800',
          )}
        >
          {task.status}
        </Badge>
        <Button asChild variant="ghost" size="sm">
          <Link href={`/forge/runs/${task.runId}`}>View run</Link>
        </Button>
      </div>

      <div>
        <p className="text-caption text-muted-foreground">Evidence (latest upstream output)</p>
        <pre className="max-h-40 overflow-auto rounded-md bg-muted/40 p-2 font-mono text-xs">
          {task.evidence === null ? '—' : JSON.stringify(task.evidence, null, 2)}
        </pre>
      </div>

      {open ? (
        <div className="space-y-2">
          <Label htmlFor={`reason-${task.id}`} className="text-xs">
            Typed reason (required)
          </Label>
          <Textarea
            id={`reason-${task.id}`}
            rows={2}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <div className="flex gap-2">
            <Button
              type="button"
              className="glass-cta"
              disabled={busy !== null}
              onClick={() => decide('Approved')}
            >
              {busy === 'Approved' ? 'Approving…' : 'Approve & resume'}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={busy !== null}
              onClick={() => decide('Rejected')}
            >
              {busy === 'Rejected' ? 'Rejecting…' : 'Reject & stop'}
            </Button>
          </div>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">Reason: {task.reasonText ?? '—'}</p>
      )}
    </li>
  );
}

export function ApprovalDesk() {
  const [tasks, setTasks] = React.useState<CanvasTaskItemT[] | null>(null);
  const refresh = React.useCallback(() => {
    apiFetch('/api/forge-canvas/tasks', { schema: CanvasTaskList })
      .then((r) => setTasks(r.items))
      .catch(() => toast.error('Could not load the Approval Desk.'));
  }, []);
  React.useEffect(refresh, [refresh]);

  if (!tasks) return <p className="text-small text-muted-foreground">Loading tasks…</p>;
  if (tasks.length === 0) {
    return (
      <div className="glass-card rounded-2xl p-8 text-center">
        <p className="text-small text-muted-foreground">
          No approval tasks yet. Runs pause here when they reach a Human approval node on the{' '}
          <Link href="/forge" className="link-brand underline">
            Forge Canvas
          </Link>
          .
        </p>
      </div>
    );
  }
  return (
    <ul className="space-y-4">
      {tasks.map((t) => (
        <TaskCard key={t.id} task={t} onDecided={refresh} />
      ))}
    </ul>
  );
}
