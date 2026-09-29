// @polsia:user-owned — "Record outcomes": paste replies / meetings / passes as
// CSV lines, parsed client-side by parseOutcomeCsv (row errors shown inline),
// then POSTed to /api/admin/fundraise/events. The result toast reports
// recorded / already-recorded / unmatched, and unmatched identifiers are
// listed so they can be fixed and re-pasted.

'use client';

import { AlertCircle, Loader2 } from 'lucide-react';
import * as React from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { parseOutcomeCsv } from '@/lib/business/fundraise-loop/csv';
import { EVENT_TYPES, EventIngestResult } from '@/lib/contracts/fundraise-loop';
import { errorMessage, Panel, sendJson } from './fundraise-shared';

const PLACEHOLDER = [
  'https://www.linkedin.com/in/jane-doe,REPLY,2026-09-20',
  'jane@fund.vc,MEETING,2026-09-24,Intro call booked',
  'Ann Lee | Coral Ventures,PASS,2026-09-25,Too early',
].join('\n');

export function OutcomeImport({ onChanged }: { onChanged: () => Promise<void> }) {
  const [text, setText] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);
  const [unmatched, setUnmatched] = React.useState<string[]>([]);
  const [showErrors, setShowErrors] = React.useState(false);

  const parsed = React.useMemo(() => parseOutcomeCsv(text), [text]);
  const hasErrors = parsed.errors.length > 0;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setShowErrors(true);
    if (hasErrors || parsed.events.length === 0) return;
    setSubmitting(true);
    try {
      const result = await sendJson(
        '/api/admin/fundraise/events',
        'POST',
        { events: parsed.events },
        EventIngestResult,
      );
      const parts = [`${result.recorded} recorded`];
      if (result.alreadyRecorded > 0) parts.push(`${result.alreadyRecorded} already recorded`);
      if (result.unmatched.length > 0) parts.push(`${result.unmatched.length} unmatched`);
      if (result.unmatched.length > 0) toast.warning(parts.join(' · '));
      else toast.success(parts.join(' · '));
      setUnmatched(result.unmatched);
      setText('');
      setShowErrors(false);
      await onChanged();
    } catch (err) {
      toast.error(errorMessage(err, 'Could not record the outcomes.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Panel
      labelledBy="fundraise-outcomes"
      eyebrow="Record outcomes"
      title="Log replies and meetings"
      description={
        <p>
          One per line: <code className="font-mono">identifier,type,date[,note]</code>. Identifier
          is a LinkedIn URL, an email, or <code className="font-mono">Name | Firm</code>. Type is
          one of {EVENT_TYPES.join(', ')}. Date is YYYY-MM-DD.
        </p>
      }
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-3 p-4 sm:p-5" noValidate>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="fundraise-outcomes-csv">Outcome lines</Label>
          <Textarea
            id="fundraise-outcomes-csv"
            rows={6}
            spellCheck={false}
            className="font-mono text-xs"
            placeholder={PLACEHOLDER}
            value={text}
            aria-invalid={showErrors && hasErrors}
            aria-describedby={showErrors && hasErrors ? 'fundraise-outcomes-errors' : undefined}
            onChange={(e) => {
              setText(e.target.value);
              setShowErrors(e.target.value.trim() !== '');
            }}
          />
        </div>

        {showErrors && hasErrors ? (
          <div
            id="fundraise-outcomes-errors"
            role="alert"
            className="flex flex-col gap-1 rounded-[var(--app-radius-sm)] border border-destructive/40 bg-destructive/5 p-3 text-destructive"
          >
            <p className="app-small flex items-center gap-2 font-semibold">
              <AlertCircle aria-hidden className="size-4" />
              {parsed.errors.length} {parsed.errors.length === 1 ? 'line needs' : 'lines need'}{' '}
              fixing
            </p>
            <ul className="app-caption flex flex-col gap-0.5">
              {parsed.errors.map((err) => (
                <li key={`${err.line}-${err.message}`}>
                  {err.line > 0 ? <span className="font-mono">Line {err.line}: </span> : null}
                  {err.message}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="app-caption text-[var(--app-text-muted)]" aria-live="polite">
            {parsed.events.length} valid {parsed.events.length === 1 ? 'line' : 'lines'}
          </p>
          <Button
            type="submit"
            size="sm"
            disabled={submitting || parsed.events.length === 0 || hasErrors}
          >
            {submitting ? <Loader2 aria-hidden className="animate-spin" /> : null}
            Record {parsed.events.length > 0 ? parsed.events.length : ''} outcomes
          </Button>
        </div>

        {unmatched.length > 0 ? (
          <div className="flex flex-col gap-1 rounded-[var(--app-radius-sm)] border border-amber-300 bg-amber-50 p-3 text-amber-950 dark:bg-amber-500/10 dark:text-amber-100">
            <div className="flex items-center justify-between gap-2">
              <p className="app-small font-semibold">
                {unmatched.length} {unmatched.length === 1 ? 'identifier' : 'identifiers'} matched
                nobody we contacted
              </p>
              <Button type="button" size="sm" variant="ghost" onClick={() => setUnmatched([])}>
                Dismiss
              </Button>
            </div>
            <ul className="app-caption flex flex-col gap-0.5 font-mono break-all">
              {unmatched.map((id) => (
                <li key={id}>{id}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </form>
    </Panel>
  );
}
