// @polsia:user-owned — small shared helpers for the /admin/fundraise island:
// the JSON mutation wrapper (apiFetch + shared zod contract), number
// formatting, and the badge styles used across the panels. Client-only.

'use client';

import type * as React from 'react';
import { type ZodType, z } from 'zod';
import { Badge } from '@/components/ui/badge';
import { apiFetch } from '@/lib/api-client';
import { apiErrorMessage } from '@/lib/api-error-message';
import type { BatchStatus, SegmentStats } from '@/lib/contracts/fundraise-loop';
import { cn } from '@/lib/utils';

export type Recommendation = SegmentStats['recommendation'];

/** `{ ok: true }` — the body of the segment/config/intro mutations. */
export const OkResponse = z.object({ ok: z.literal(true) });

/** Send a JSON mutation and parse the response against the shared contract. */
export function sendJson<T>(
  path: string,
  method: 'POST' | 'PUT' | 'PATCH',
  body: unknown,
  schema: ZodType<T>,
): Promise<T> {
  return apiFetch(path, { method, body: JSON.stringify(body), schema });
}

/** HTTP status from an apiFetch failure ("apiFetch … failed (409)"). */
export function apiStatus(err: unknown): number | undefined {
  const message = err instanceof Error ? err.message : '';
  const match = /failed \((\d{3})\)/.exec(message);
  return match ? Number(match[1]) : undefined;
}

/** Field errors from a 400 `{ errors: { field: message } }` body, if any. */
export function fieldErrors(err: unknown): Record<string, string> {
  const cause = (err as { cause?: { errors?: unknown } } | null)?.cause;
  const errors = cause?.errors;
  if (!errors || typeof errors !== 'object') return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(errors as Record<string, unknown>)) {
    if (typeof v === 'string') out[k] = v;
  }
  return out;
}

export function errorMessage(err: unknown, fallback: string): string {
  const status = apiStatus(err);
  if (status === 401) return 'Your session expired — sign in again.';
  if (status === 403) return 'Only an admin can do that.';
  return apiErrorMessage(err, fallback);
}

export function pct(value: number): string {
  if (!Number.isFinite(value)) return '—';
  const p = value * 100;
  if (p > 0 && p < 1) return `${p.toFixed(1)}%`;
  return `${Math.round(p)}%`;
}

export function num(value: number): string {
  return value.toLocaleString();
}

export function shortDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  });
}

const RECOMMENDATION: Record<Recommendation, { label: string; className: string }> = {
  'insufficient-data': {
    label: 'Not enough data yet',
    className: 'border-[var(--app-border)] bg-transparent text-[var(--app-text-muted)]',
  },
  'lean-in': {
    label: 'Lean in',
    className:
      'border-[var(--app-accent-border)] bg-[var(--app-accent-soft)] text-[var(--app-accent-strong)]',
  },
  keep: { label: 'Keep', className: 'border-transparent bg-secondary text-secondary-foreground' },
  'consider-pausing': {
    label: 'Consider pausing',
    className:
      'border-amber-300 bg-amber-50 text-amber-900 dark:bg-amber-500/15 dark:text-amber-200',
  },
  exhausted: {
    label: 'Market exhausted',
    className: 'border-rose-300 bg-rose-50 text-rose-900 dark:bg-rose-500/15 dark:text-rose-200',
  },
};

export function RecommendationBadge({ value }: { value: Recommendation }) {
  const { label, className } = RECOMMENDATION[value];
  return (
    <Badge variant="outline" className={cn('whitespace-nowrap font-medium', className)}>
      {label}
    </Badge>
  );
}

const BATCH_STATUS: Record<BatchStatus, { label: string; className: string }> = {
  PENDING_APPROVAL: {
    label: 'Pending approval',
    className:
      'border-amber-300 bg-amber-50 text-amber-900 dark:bg-amber-500/15 dark:text-amber-200',
  },
  APPROVED: {
    label: 'Approved',
    className:
      'border-[var(--app-accent-border)] bg-[var(--app-accent-soft)] text-[var(--app-accent-strong)]',
  },
  SENDING: {
    label: 'Sending in progress',
    className: 'border-sky-300 bg-sky-50 text-sky-900 dark:bg-sky-500/15 dark:text-sky-200',
  },
  REJECTED: {
    label: 'Rejected',
    className: 'border-[var(--app-border)] bg-transparent text-[var(--app-text-muted)]',
  },
  SENT: { label: 'Sent', className: 'border-transparent bg-secondary text-secondary-foreground' },
};

export function BatchStatusBadge({ status }: { status: BatchStatus }) {
  const { label, className } = BATCH_STATUS[status];
  return (
    <Badge variant="outline" className={cn('whitespace-nowrap font-medium', className)}>
      {label}
    </Badge>
  );
}

/** Panel wrapper matching the app-shell glass panels. */
export function Panel({
  title,
  eyebrow,
  description,
  action,
  children,
  labelledBy,
}: {
  title: string;
  eyebrow?: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  labelledBy: string;
}) {
  return (
    <section aria-labelledby={labelledBy} className="app-panel flex flex-col">
      <div className="flex flex-col gap-3 border-b border-[var(--app-border)] p-4 sm:flex-row sm:items-start sm:justify-between sm:p-5">
        <div className="flex min-w-0 flex-col gap-1">
          {eyebrow ? (
            <p className="app-caption font-semibold uppercase tracking-wide text-[var(--app-text-muted)]">
              {eyebrow}
            </p>
          ) : null}
          <h2 id={labelledBy} className="app-h2 text-[var(--app-text)]">
            {title}
          </h2>
          {description ? (
            <div className="app-small max-w-2xl text-[var(--app-text-muted)]">{description}</div>
          ) : null}
        </div>
        {action ? <div className="flex shrink-0 flex-wrap gap-2">{action}</div> : null}
      </div>
      {children}
    </section>
  );
}
