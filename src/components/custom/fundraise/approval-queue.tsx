// @polsia:user-owned — the human approval gate. Every PENDING_APPROVAL batch
// is listed with its prospects; the founder can skip individual prospects,
// approve the batch, or reject it (with an optional note). Decided batches
// are shown collapsed underneath. All decisions go through
// PATCH /api/admin/fundraise/batches/{id}; a 409 means the batch moved on
// (someone else decided it) and the summary is refetched.

'use client';

import { ExternalLink, Loader2 } from 'lucide-react';
import * as React from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { type BatchDecision, BatchView, type ProspectView } from '@/lib/contracts/fundraise-loop';
import { cn } from '@/lib/utils';
import {
  apiStatus,
  BatchStatusBadge,
  errorMessage,
  Panel,
  sendJson,
  shortDate,
} from './fundraise-shared';

type SegmentLabels = Record<string, string>;

function safeHttpUrl(url: string | null): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.toString() : null;
  } catch {
    return null;
  }
}

export function ProspectLine({
  prospect,
  segmentLabels,
}: {
  prospect: ProspectView;
  segmentLabels: SegmentLabels;
}) {
  const href = safeHttpUrl(prospect.linkedinUrl);
  const roleLine = [prospect.title, prospect.firm].filter(Boolean).join(' · ');
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
        <span className="font-medium text-[var(--app-text)]">{prospect.fullName}</span>
        {href ? (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="app-caption inline-flex items-center gap-1 text-[var(--app-accent-strong)] underline-offset-4 hover:underline"
          >
            LinkedIn
            <ExternalLink aria-hidden className="size-3" />
            <span className="sr-only">(opens in a new tab)</span>
          </a>
        ) : null}
      </span>
      {roleLine ? (
        <span className="app-small break-words text-[var(--app-text-muted)]">{roleLine}</span>
      ) : null}
      <span className="app-caption text-[var(--app-text-muted)]">
        {segmentLabels[prospect.segmentKey] ?? prospect.segmentKey}
      </span>
    </div>
  );
}

function PendingBatch({
  batch,
  segmentLabels,
  sendingEnabled,
  onChanged,
}: {
  batch: BatchView;
  segmentLabels: SegmentLabels;
  sendingEnabled: boolean;
  onChanged: () => Promise<void>;
}) {
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [busy, setBusy] = React.useState<'approve' | 'reject' | 'skip' | null>(null);
  const [rejectOpen, setRejectOpen] = React.useState(false);
  const [rejectNote, setRejectNote] = React.useState('');

  const queued = batch.prospects.filter((p) => p.status === 'QUEUED');
  const skipped = batch.prospects.filter((p) => p.status === 'SKIPPED');
  const allSelected = queued.length > 0 && queued.every((p) => selected.has(p.id));
  const headingId = `batch-${batch.id}`;

  const toggle = (id: string, on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  const decide = async (decision: BatchDecision, success: string) => {
    setBusy(decision.action);
    try {
      await sendJson(
        `/api/admin/fundraise/batches/${encodeURIComponent(batch.id)}`,
        'PATCH',
        decision,
        BatchView,
      );
      toast.success(success);
      setSelected(new Set());
      setRejectOpen(false);
      setRejectNote('');
      await onChanged();
    } catch (err) {
      if (apiStatus(err) === 409) {
        toast.error(errorMessage(err, 'This batch has already been decided.'));
        await onChanged();
      } else {
        toast.error(errorMessage(err, 'Could not update the batch.'));
      }
    } finally {
      setBusy(null);
    }
  };

  const disabled = busy !== null;

  return (
    <article aria-labelledby={headingId} className="flex flex-col gap-3 p-4 sm:p-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-1">
          <h3 id={headingId} className="app-body font-semibold text-[var(--app-text)]">
            Batch from {shortDate(batch.createdAt)}
          </h3>
          <p className="app-small text-[var(--app-text-muted)]">
            {queued.length} to send
            {skipped.length > 0 ? ` · ${skipped.length} skipped` : ''}
            {sendingEnabled ? '' : ' · approving will not send while sending is off'}
          </p>
          {batch.note ? (
            <p className="app-small whitespace-pre-wrap text-[var(--app-text)]">{batch.note}</p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={disabled || selected.size === 0}
            onClick={() =>
              void decide(
                { action: 'skip', prospectIds: [...selected] },
                `Skipped ${selected.size} ${selected.size === 1 ? 'prospect' : 'prospects'}`,
              )
            }
          >
            {busy === 'skip' ? <Loader2 aria-hidden className="animate-spin" /> : null}
            Skip selected{selected.size > 0 ? ` (${selected.size})` : ''}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={disabled}
            onClick={() => setRejectOpen(true)}
          >
            Reject
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={disabled || queued.length === 0}
            onClick={() => void decide({ action: 'approve' }, 'Batch approved')}
          >
            {busy === 'approve' ? <Loader2 aria-hidden className="animate-spin" /> : null}
            Approve {queued.length}
          </Button>
        </div>
      </div>

      {queued.length > 0 ? (
        <div className="flex items-center gap-2">
          <Checkbox
            id={`${headingId}-all`}
            checked={allSelected}
            disabled={disabled}
            onCheckedChange={(v) =>
              setSelected(v === true ? new Set(queued.map((p) => p.id)) : new Set())
            }
          />
          <Label htmlFor={`${headingId}-all`} className="app-small font-normal">
            Select all
          </Label>
        </div>
      ) : null}

      <ul className="divide-y divide-[var(--app-border)] rounded-[var(--app-radius-sm)] border border-[var(--app-border)]">
        {batch.prospects.map((p) => {
          const isSkipped = p.status === 'SKIPPED';
          const boxId = `prospect-${p.id}`;
          return (
            <li key={p.id} className={cn('flex items-start gap-3 p-3', isSkipped && 'opacity-60')}>
              {isSkipped ? (
                <span className="app-caption mt-0.5 w-12 shrink-0 font-medium uppercase text-[var(--app-text-muted)]">
                  Skipped
                </span>
              ) : (
                <Checkbox
                  id={boxId}
                  className="mt-0.5"
                  checked={selected.has(p.id)}
                  disabled={disabled}
                  onCheckedChange={(v) => toggle(p.id, v === true)}
                  aria-label={`Select ${p.fullName}`}
                />
              )}
              <ProspectLine prospect={p} segmentLabels={segmentLabels} />
            </li>
          );
        })}
      </ul>

      <Dialog open={rejectOpen} onOpenChange={(o) => !disabled && setRejectOpen(o)}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reject this batch?</DialogTitle>
            <DialogDescription>
              None of its {queued.length} prospects will be sent. A short note helps the next run
              aim better.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${headingId}-reject-note`}>Note (optional)</Label>
            <Textarea
              id={`${headingId}-reject-note`}
              rows={3}
              maxLength={2000}
              value={rejectNote}
              onChange={(e) => setRejectNote(e.target.value)}
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              disabled={disabled}
              onClick={() => setRejectOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={disabled}
              onClick={() =>
                void decide(
                  rejectNote.trim()
                    ? { action: 'reject', note: rejectNote.trim() }
                    : { action: 'reject' },
                  'Batch rejected',
                )
              }
            >
              {busy === 'reject' ? <Loader2 aria-hidden className="animate-spin" /> : null}
              Reject batch
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </article>
  );
}

function DecidedBatch({
  batch,
  segmentLabels,
}: {
  batch: BatchView;
  segmentLabels: SegmentLabels;
}) {
  const sent = batch.prospects.filter((p) => p.status === 'SENT').length;
  return (
    <details className="group">
      <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 hover:bg-[var(--app-accent-soft)] sm:px-5">
        <BatchStatusBadge status={batch.status} />
        <span className="app-small text-[var(--app-text)]">{shortDate(batch.createdAt)}</span>
        <span className="app-caption text-[var(--app-text-muted)]">
          {batch.prospects.length} prospects
          {batch.status === 'SENT' ? ` · ${sent} sent ${shortDate(batch.sentAt)}` : ''}
          {batch.decidedAt ? ` · decided ${shortDate(batch.decidedAt)}` : ''}
          {batch.decidedBy ? ` by ${batch.decidedBy}` : ''}
        </span>
      </summary>
      <div className="flex flex-col gap-2 px-4 pb-4 sm:px-5">
        {batch.note ? (
          <p className="app-small whitespace-pre-wrap text-[var(--app-text)]">{batch.note}</p>
        ) : null}
        <ul className="divide-y divide-[var(--app-border)] rounded-[var(--app-radius-sm)] border border-[var(--app-border)]">
          {batch.prospects.map((p) => (
            <li key={p.id} className="flex items-start justify-between gap-3 p-3">
              <ProspectLine prospect={p} segmentLabels={segmentLabels} />
              <span className="app-caption shrink-0 uppercase text-[var(--app-text-muted)]">
                {p.status.replace('_', ' ').toLowerCase()}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </details>
  );
}

export function ApprovalQueue({
  batches,
  segmentLabels,
  sendingEnabled,
  onChanged,
}: {
  batches: BatchView[];
  segmentLabels: SegmentLabels;
  sendingEnabled: boolean;
  onChanged: () => Promise<void>;
}) {
  const pending = batches.filter((b) => b.status === 'PENDING_APPROVAL');
  const decided = batches.filter((b) => b.status !== 'PENDING_APPROVAL');

  return (
    <Panel
      labelledBy="fundraise-approvals"
      eyebrow="Approval queue"
      title={
        pending.length === 0
          ? 'Nothing waiting for approval'
          : `${pending.length} ${pending.length === 1 ? 'batch' : 'batches'} waiting`
      }
      description="Nobody is contacted unless you approve their batch. Untick anyone who shouldn't get a cold message and skip them first."
    >
      {pending.length === 0 ? (
        <p className="app-small p-5 text-[var(--app-text-muted)]">
          The weekly run drafts the next batch here for you to review.
        </p>
      ) : (
        <div className="divide-y divide-[var(--app-border)]">
          {pending.map((b) => (
            <PendingBatch
              key={b.id}
              batch={b}
              segmentLabels={segmentLabels}
              sendingEnabled={sendingEnabled}
              onChanged={onChanged}
            />
          ))}
        </div>
      )}
      {decided.length > 0 ? (
        <div className="border-t border-[var(--app-border)]">
          <h3 className="app-caption px-4 pt-3 font-semibold uppercase tracking-wide text-[var(--app-text-muted)] sm:px-5">
            Recent decisions
          </h3>
          <div className="divide-y divide-[var(--app-border)]">
            {decided.map((b) => (
              <DecidedBatch key={b.id} batch={b} segmentLabels={segmentLabels} />
            ))}
          </div>
        </div>
      ) : null}
    </Panel>
  );
}
