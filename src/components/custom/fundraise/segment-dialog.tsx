// @polsia:user-owned — add / edit a fundraise segment. Validates client-side
// against the shared SegmentUpsert contract, then PUTs
// /api/admin/fundraise/segments. Field errors (client zod or a server 400
// `{ errors }`) render inline; anything else goes to a toast. Pausing or
// re-activating a segment is done here — the loop never pauses on its own.

'use client';

import { Loader2 } from 'lucide-react';
import * as React from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { type SegmentStats, SegmentUpsert } from '@/lib/contracts/fundraise-loop';
import { errorMessage, fieldErrors, OkResponse, sendJson } from './fundraise-shared';

type Mode = SegmentUpsert['mode'];
type Status = SegmentUpsert['status'];

const MODE_LABELS: Record<Mode, string> = {
  vc: 'VC / angels',
  lp: 'LPs / allocators',
  real_estate: 'Real estate',
  ria: 'RIAs (US wealth managers)',
};

interface FormState {
  key: string;
  label: string;
  query: string;
  mode: Mode;
  estUniverse: string;
  lagDays: string;
  status: Status;
}

const EMPTY: FormState = {
  key: '',
  label: '',
  query: '',
  mode: 'vc',
  estUniverse: '',
  lagDays: '21',
  status: 'ACTIVE',
};

function fromSegment(s: SegmentStats): FormState {
  const mode = (Object.keys(MODE_LABELS) as Mode[]).includes(s.mode as Mode)
    ? (s.mode as Mode)
    : 'vc';
  return {
    key: s.key,
    label: s.label,
    query: s.query,
    mode,
    estUniverse: String(s.estUniverse),
    lagDays: String(s.lagDays),
    status: s.status,
  };
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="app-caption text-destructive">
      {message}
    </p>
  );
}

export function SegmentDialog({
  open,
  onOpenChange,
  segment,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** null = add a new segment. */
  segment: SegmentStats | null;
  onSaved: () => Promise<void>;
}) {
  const isEdit = segment !== null;
  const [form, setForm] = React.useState<FormState>(EMPTY);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setForm(segment ? fromSegment(segment) : EMPTY);
      setErrors({});
    }
  }, [open, segment]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = SegmentUpsert.safeParse(form);
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
      await sendJson('/api/admin/fundraise/segments', 'PUT', parsed.data, OkResponse);
      toast.success(isEdit ? `Saved “${parsed.data.label}”` : `Added “${parsed.data.label}”`);
      onOpenChange(false);
      await onSaved();
    } catch (err) {
      const fe = fieldErrors(err);
      if (Object.keys(fe).length > 0) setErrors(fe);
      else toast.error(errorMessage(err, 'Could not save the segment.'));
    } finally {
      setSaving(false);
    }
  };

  const describedBy = (k: string) => (errors[k] ? `seg-${k}-error` : undefined);

  return (
    <Dialog open={open} onOpenChange={(o) => !saving && onOpenChange(o)}>
      <DialogContent className="max-h-[90vh] max-w-[calc(100vw-2rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? `Edit ${segment.label}` : 'Add segment'}</DialogTitle>
          <DialogDescription>
            A segment is one 8Raise search the loop draws prospects from. Allocation across segments
            adjusts itself; pausing a segment is your call.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="seg-key">Key</Label>
              <Input
                id="seg-key"
                value={form.key}
                disabled={isEdit}
                placeholder="caribbean-seed-vc"
                aria-invalid={!!errors.key}
                aria-describedby={describedBy('key')}
                onChange={(e) => set('key', e.target.value)}
              />
              <FieldError id="seg-key-error" message={errors.key} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="seg-label">Label</Label>
              <Input
                id="seg-label"
                value={form.label}
                aria-invalid={!!errors.label}
                aria-describedby={describedBy('label')}
                onChange={(e) => set('label', e.target.value)}
              />
              <FieldError id="seg-label-error" message={errors.label} />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="seg-query">8Raise search query</Label>
            <Textarea
              id="seg-query"
              rows={3}
              value={form.query}
              aria-invalid={!!errors.query}
              aria-describedby={describedBy('query')}
              onChange={(e) => set('query', e.target.value)}
            />
            <FieldError id="seg-query-error" message={errors.query} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="seg-mode">Search mode</Label>
              <Select value={form.mode} onValueChange={(v) => set('mode', v as Mode)}>
                <SelectTrigger id="seg-mode">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(MODE_LABELS) as Mode[]).map((m) => (
                    <SelectItem key={m} value={m}>
                      {MODE_LABELS[m]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldError id="seg-mode-error" message={errors.mode} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="seg-status">Status</Label>
              <Select value={form.status} onValueChange={(v) => set('status', v as Status)}>
                <SelectTrigger id="seg-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACTIVE">Active — receives allocation</SelectItem>
                  <SelectItem value="PAUSED">Paused — gets nothing</SelectItem>
                </SelectContent>
              </Select>
              <FieldError id="seg-status-error" message={errors.status} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="seg-universe">Estimated universe (people)</Label>
              <Input
                id="seg-universe"
                type="number"
                inputMode="numeric"
                min={1}
                value={form.estUniverse}
                aria-invalid={!!errors.estUniverse}
                aria-describedby={describedBy('estUniverse')}
                onChange={(e) => set('estUniverse', e.target.value)}
              />
              <FieldError id="seg-estUniverse-error" message={errors.estUniverse} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="seg-lag">Reply lag (days)</Label>
              <Input
                id="seg-lag"
                type="number"
                inputMode="numeric"
                min={1}
                max={180}
                value={form.lagDays}
                aria-invalid={!!errors.lagDays}
                aria-describedby={describedBy('lagDays')}
                onChange={(e) => set('lagDays', e.target.value)}
              />
              <FieldError id="seg-lagDays-error" message={errors.lagDays} />
            </div>
          </div>
          <p className="app-caption text-[var(--app-text-muted)]">
            Reply lag is how long a contact has to answer before silence counts against the segment
            — slow allocators (pensions, DFIs) need a longer window.
          </p>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              disabled={saving}
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 aria-hidden className="animate-spin" /> : null}
              {isEdit ? 'Save segment' : 'Add segment'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
