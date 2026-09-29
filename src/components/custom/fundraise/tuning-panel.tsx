// @polsia:user-owned — collapsed "Tuning" panel for the allocation engine's
// knobs. PATCHes /api/admin/fundraise/config with only the fields the founder
// filled in. LoopSummary exposes the current batchSize but not the other
// knobs, so those start blank with the plan's defaults as placeholders; a
// blank field is left unchanged on the server.

'use client';

import { Loader2 } from 'lucide-react';
import * as React from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ConfigUpdate } from '@/lib/contracts/fundraise-loop';
import { errorMessage, fieldErrors, OkResponse, sendJson } from './fundraise-shared';

type Knob =
  | 'batchSize'
  | 'minSegmentShare'
  | 'explorationFloor'
  | 'minTrialsBeforeCut'
  | 'minWeeksRunway';

const KNOBS: { key: Knob; label: string; hint: string; placeholder: string; step: string }[] = [
  {
    key: 'batchSize',
    label: 'Batch size',
    hint: 'Prospects per weekly batch (1–500).',
    placeholder: '40',
    step: '1',
  },
  {
    key: 'minSegmentShare',
    label: 'Minimum segment share',
    hint: 'Share every segment keeps until it has enough matured contacts (0–0.5).',
    placeholder: '0.1',
    step: '0.01',
  },
  {
    key: 'explorationFloor',
    label: 'Exploration floor',
    hint: 'Share a proven-weak segment still gets, so it can recover (0–0.5).',
    placeholder: '0.05',
    step: '0.01',
  },
  {
    key: 'minTrialsBeforeCut',
    label: 'Matured contacts before a cut',
    hint: 'How much evidence a segment needs before it can drop to the floor (≥ 10).',
    placeholder: '100',
    step: '1',
  },
  {
    key: 'minWeeksRunway',
    label: 'Minimum weeks of market',
    hint: 'Caps weekly volume so no segment runs out sooner than this (1–104).',
    placeholder: '8',
    step: '1',
  },
];

export function TuningPanel({
  batchSize,
  onChanged,
}: {
  batchSize: number;
  onChanged: () => Promise<void>;
}) {
  const [values, setValues] = React.useState<Record<Knob, string>>({
    batchSize: String(batchSize),
    minSegmentShare: '',
    explorationFloor: '',
    minTrialsBeforeCut: '',
    minWeeksRunway: '',
  });
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    setValues((v) => ({ ...v, batchSize: String(batchSize) }));
  }, [batchSize]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const raw: Record<string, string> = {};
    for (const { key } of KNOBS) {
      const v = values[key].trim();
      if (v !== '') raw[key] = v;
    }
    if (Object.keys(raw).length === 0) {
      toast('Nothing to save — fill in at least one setting.');
      return;
    }
    const parsed = ConfigUpdate.safeParse(raw);
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const k = String(issue.path[0] ?? 'form');
        if (!next[k]) next[k] = issue.message;
      }
      setErrors(next);
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      await sendJson('/api/admin/fundraise/config', 'PATCH', parsed.data, OkResponse);
      toast.success('Tuning saved');
      setValues((v) => ({
        ...v,
        minSegmentShare: '',
        explorationFloor: '',
        minTrialsBeforeCut: '',
        minWeeksRunway: '',
      }));
      await onChanged();
    } catch (err) {
      const fe = fieldErrors(err);
      if (Object.keys(fe).length > 0) setErrors(fe);
      else toast.error(errorMessage(err, 'Could not save the tuning.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <details className="app-disclosure group">
      <summary className="flex cursor-pointer list-none flex-col gap-0.5 p-4 sm:p-5">
        <span className="app-caption font-semibold uppercase tracking-wide text-[var(--app-text-muted)]">
          Tuning
        </span>
        <span className="app-body font-semibold text-[var(--app-text)]">
          Allocation settings{' '}
          <span className="app-small font-normal text-[var(--app-text-muted)] group-open:hidden">
            (show)
          </span>
        </span>
      </summary>
      <form
        onSubmit={onSubmit}
        className="flex flex-col gap-4 border-t border-[var(--app-border)] p-4 sm:p-5"
        noValidate
      >
        <p className="app-small text-[var(--app-text-muted)]">
          Leave a field blank to keep its current value. Only the batch size is shown as currently
          set; the others show the default as a hint.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          {KNOBS.map((k) => {
            const id = `fundraise-tune-${k.key}`;
            const err = errors[k.key];
            return (
              <div key={k.key} className="flex flex-col gap-1.5">
                <Label htmlFor={id}>{k.label}</Label>
                <Input
                  id={id}
                  type="number"
                  inputMode="decimal"
                  step={k.step}
                  placeholder={k.placeholder}
                  value={values[k.key]}
                  aria-invalid={!!err}
                  aria-describedby={err ? `${id}-error` : `${id}-hint`}
                  onChange={(e) => setValues((v) => ({ ...v, [k.key]: e.target.value }))}
                />
                {err ? (
                  <p id={`${id}-error`} className="app-caption text-destructive">
                    {err}
                  </p>
                ) : (
                  <p id={`${id}-hint`} className="app-caption text-[var(--app-text-muted)]">
                    {k.hint}
                  </p>
                )}
              </div>
            );
          })}
        </div>
        <div>
          <Button type="submit" size="sm" disabled={saving}>
            {saving ? <Loader2 aria-hidden className="animate-spin" /> : null}
            Save tuning
          </Button>
        </div>
      </form>
    </details>
  );
}
