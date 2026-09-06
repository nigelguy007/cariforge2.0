// @polsia:user-owned — the one status badge for the simplified app (brief,
// Step 7). Plain-language label from STATUS_UI, tone from STATUS_TONE, and an
// icon per tone so state never rests on colour alone. Quiet by design: 1px
// border, small radius, no pill, no uppercase.

import { AlertCircle, Ban, CheckCircle2, Circle, CircleDot, PauseCircle } from 'lucide-react';
import type { MissionStatus } from '@/lib/contracts/forge';
import { STATUS_TONE, type StatusTone, statusLabel } from '@/lib/ui-terms';
import { cn } from '@/lib/utils';

// Exported so Home's compact four-state badge (a distinct display concept,
// see ui-terms.ts's displayStateFor) can reuse the exact same tone → colour
// and tone → icon system instead of inventing a parallel one.
export const TONE_CLASS: Record<StatusTone, string> = {
  neutral: 'border-[var(--app-border)] bg-[var(--app-surface)] text-[var(--app-text-muted)]',
  progress: 'border-[var(--app-accent-border)] bg-[var(--app-accent-soft)] text-[var(--app-text)]',
  attention: 'border-amber-300 bg-amber-50 text-amber-900',
  paused: 'border-slate-300 bg-slate-50 text-slate-800',
  stopped: 'border-rose-300 bg-rose-50 text-rose-900',
  done: 'border-emerald-300 bg-emerald-50 text-emerald-900',
};

export const TONE_ICON: Record<StatusTone, typeof Circle> = {
  neutral: Circle,
  progress: CircleDot,
  attention: AlertCircle,
  paused: PauseCircle,
  stopped: Ban,
  done: CheckCircle2,
};

export function StatusBadge({ status, className }: { status: MissionStatus; className?: string }) {
  const tone = STATUS_TONE[status] ?? 'neutral';
  const Icon = TONE_ICON[tone];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 whitespace-nowrap rounded-[var(--app-radius-sm)] border px-2 py-0.5 text-[length:var(--app-caption)] font-medium leading-5',
        TONE_CLASS[tone],
        className,
      )}
    >
      <Icon aria-hidden="true" className="size-3.5 shrink-0" />
      {statusLabel(status)}
    </span>
  );
}
