// @polsia:user-owned — the Approvals queue (brief, Step 5). One list of
// everything waiting on the signed-in person: projects sitting at an
// approval step, and workflow runs paused at a human-approval node. A
// project row opens the project workspace, where the one next-action card
// takes the decision. A run row opens inline: the evidence, a required
// decision note, and the same two outcomes the run API already accepts.
// Reads the same two endpoints as the nav badge; nothing about the data
// changed.

'use client';

import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { apiFetch } from '@/lib/api-client';
import { apiErrorMessage } from '@/lib/api-error-message';
import { MissionList, type MissionListItemT } from '@/lib/contracts/forge';
import {
  CanvasRunDetail,
  type CanvasTaskItemT,
  CanvasTaskList,
} from '@/lib/contracts/forge-canvas';
import { approvalNameForIndex } from '@/lib/ui-terms';
import { APPROVALS_CHANGED_EVENT } from './use-approvals-count';

type QueueState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; projects: readonly MissionListItemT[]; runs: readonly CanvasTaskItemT[] };

const WORDS = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten'];

export function approvalsHeading(count: number): string {
  if (count === 0) return 'You have no approvals waiting';
  const n = count <= 10 ? WORDS[count] : String(count);
  return count === 1 ? `${n} approval needs you` : `${n} approvals need you`;
}

function whenLine(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

function RunRow({ task, onDecided }: { task: CanvasTaskItemT; onDecided: () => void }) {
  const [note, setNote] = React.useState('');
  const [busy, setBusy] = React.useState<'Approved' | 'Rejected' | null>(null);
  const [open, setOpen] = React.useState(false);
  const noteId = `run-note-${task.id}`;
  const panelId = `run-panel-${task.id}`;

  const decide = async (decision: 'Approved' | 'Rejected') => {
    const reasonText = note.trim();
    if (reasonText.length === 0) {
      toast.error('Add a decision note first — every decision is recorded with one.');
      return;
    }
    setBusy(decision);
    try {
      await apiFetch(`/api/forge-canvas/tasks/${task.id}/decide`, {
        method: 'POST',
        body: JSON.stringify({ decision, reasonText }),
        schema: CanvasRunDetail,
      });
      toast.success(decision === 'Approved' ? 'Approved — the run continues.' : 'Run stopped.');
      onDecided();
    } catch (err) {
      toast.error(
        apiErrorMessage(
          err,
          'The decision could not be saved. Check your connection and try again.',
        ),
      );
    } finally {
      setBusy(null);
    }
  };

  return (
    <li>
      <div className="flex min-h-14 items-center gap-4 px-4 py-3">
        <div className="min-w-0 flex-1">
          <p className="app-body truncate font-medium text-[var(--app-text)]">
            {task.blueprintName}
          </p>
          <p className="app-small mt-0.5 text-[var(--app-text-muted)]">
            {task.title} · Paused workflow run · Waiting since {whenLine(task.createdAt)}
            {task.isOwn ? '' : ' · Not started by you'}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          className="min-h-11 shrink-0"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? 'Close' : 'Review'}
        </Button>
      </div>
      {open ? (
        <div
          id={panelId}
          className="space-y-3 border-t border-[var(--app-border)] bg-[var(--app-surface-muted)] px-4 py-4"
        >
          <div>
            <p className="app-caption text-[var(--app-text-muted)]">What the run produced so far</p>
            <pre className="app-caption mt-1 max-h-40 overflow-auto rounded-[var(--app-radius-sm)] border border-[var(--app-border)] bg-[var(--app-surface)] p-2 font-mono">
              {task.evidence === null
                ? 'No output recorded yet.'
                : JSON.stringify(task.evidence, null, 2)}
            </pre>
            <Link
              href={`/forge/runs/${task.runId}`}
              className="app-link app-small mt-1 inline-block"
            >
              Open the full run
            </Link>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={noteId} className="app-small">
              Decision note (required)
            </Label>
            <Textarea
              id={noteId}
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Why you are approving or stopping this run"
            />
          </div>
          <div className="flex flex-wrap gap-3">
            <Button
              type="button"
              className="min-h-11"
              disabled={busy !== null}
              onClick={() => decide('Approved')}
            >
              {busy === 'Approved' ? 'Approving…' : 'Approve and continue'}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              disabled={busy !== null}
              onClick={() => decide('Rejected')}
            >
              {busy === 'Rejected' ? 'Stopping…' : 'Stop this run'}
            </Button>
          </div>
        </div>
      ) : null}
    </li>
  );
}

export function ApprovalsQueue() {
  const [state, setState] = React.useState<QueueState>({ status: 'loading' });

  const load = React.useCallback(async () => {
    try {
      const [missions, tasks] = await Promise.all([
        apiFetch('/api/forge/missions', { schema: MissionList }),
        apiFetch('/api/forge-canvas/tasks', { schema: CanvasTaskList }),
      ]);
      // Real bug fix (2026-09-05): status === 'AwaitingApproval' alone
      // missed every project still sitting at 'Draft' (status only moves
      // on an actual gate decision) with a real, AI-raised concern waiting
      // for an answer — the single most common case now that Oracle
      // review exists. hasOpenConcern is the second real signal.
      const projects = missions.items
        .filter((m) => m.status === 'AwaitingApproval' || m.hasOpenConcern)
        .sort((a, b) => a.updatedAt.localeCompare(b.updatedAt));
      const runs = tasks.items
        .filter((t) => t.status === 'Open')
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      setState({ status: 'ready', projects, runs });
    } catch (err) {
      setState({
        status: 'error',
        message: apiErrorMessage(err, 'Approvals could not be loaded.'),
      });
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  const onDecided = React.useCallback(() => {
    window.dispatchEvent(new Event(APPROVALS_CHANGED_EVENT));
    void load();
  }, [load]);

  if (state.status === 'loading') {
    return (
      <div className="space-y-4" aria-busy="true">
        <p className="sr-only">Loading approvals</p>
        <Skeleton className="h-9 w-72" />
        <div className="app-panel divide-y divide-[var(--app-border)]">
          {[0, 1].map((i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-3">
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-3 w-2/3" />
              </div>
              <Skeleton className="h-11 w-20" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <section role="alert" className="app-panel p-5">
        <h1 className="app-h1 text-[var(--app-text)]">Approvals could not be loaded</h1>
        <p className="app-small mt-1 text-[var(--app-text-muted)]">{state.message}</p>
        <Button
          type="button"
          className="mt-3 min-h-11"
          onClick={() => {
            setState({ status: 'loading' });
            void load();
          }}
        >
          Try again
        </Button>
      </section>
    );
  }

  const total = state.projects.length + state.runs.length;

  return (
    <div className="space-y-4">
      <header>
        <h1 className="app-h1 text-[var(--app-text)]">{approvalsHeading(total)}</h1>
        <p className="app-body mt-1 max-w-prose text-[var(--app-text-muted)]">
          {total === 0
            ? 'Projects and workflow runs appear here when they need your decision.'
            : 'Every decision is recorded with your name and a note.'}
        </p>
      </header>
      {total > 0 ? (
        <ul className="app-panel divide-y divide-[var(--app-border)]">
          {state.projects.map((m) => (
            <li key={m.id}>
              <Link
                href={`/missions/${m.slug}`}
                className="app-transition flex min-h-14 items-center gap-4 px-4 py-3 hover:bg-[var(--app-accent-soft)] focus-visible:bg-[var(--app-accent-soft)]"
              >
                <div className="min-w-0 flex-1">
                  <p className="app-body truncate font-medium text-[var(--app-text)]">{m.name}</p>
                  <p className="app-small mt-0.5 text-[var(--app-text-muted)]">
                    {approvalNameForIndex(m.currentStageIndex)} · Prepared by CariForge · Waiting
                    since {whenLine(m.updatedAt)}
                  </p>
                </div>
                <span className="app-small shrink-0 text-[var(--app-text)]">Review</span>
                <ChevronRight
                  aria-hidden="true"
                  className="size-4 shrink-0 text-[var(--app-text-muted)]"
                />
                <span className="sr-only">Open {m.name}</span>
              </Link>
            </li>
          ))}
          {state.runs.map((t) => (
            <RunRow key={t.id} task={t} onDecided={onDecided} />
          ))}
        </ul>
      ) : null}
    </div>
  );
}
