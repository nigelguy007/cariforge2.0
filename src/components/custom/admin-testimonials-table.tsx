// @polsia:user-owned — admin moderation island for /testimonials. On mount,
// fetches /api/admin/testimonials via apiFetch + the AdminTestimonialList
// contract; renders one row per testimonial with a Switch that flips the
// published flag (optimistically, then reconciled against the canonical row
// the handler returns). 401 / 403 from the gate are surfaced as a typed error
// alert; the section is never left in a silent state.

'use client';

import { AlertCircle, Loader2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { apiFetch } from '@/lib/api-client';
import {
  type AdminTestimonialItem,
  AdminTestimonialList,
  type AdminTestimonialList as AdminTestimonialListType,
  sectorLabel,
  type TestimonialPublishUpdate,
} from '@/lib/contracts/testimonials';

interface AdminPatchResponse {
  ok: boolean;
  item: AdminTestimonialItem;
}

interface FetchFailure extends Error {
  apiStatus?: number;
}

// Extract the HTTP status code from apiFetch's thrown Error message
// ("apiFetch /… failed (401)"; biome lets us keep a small regex here).
function pickApiStatus(message: string): number | undefined {
  const match = /failed \((\d{3})\)/.exec(message);
  if (!match) return undefined;
  const code = Number(match[1]);
  if (code >= 100 && code < 600) return code;
  return undefined;
}

function SubmittedDate({ iso }: { iso: string }) {
  const d = new Date(iso);
  const date = d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  });
  const time = d.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  });
  return (
    <span className="font-mono text-xs text-muted-foreground">
      {date} <span className="text-foreground">{time}</span>
    </span>
  );
}

function isEmailLike(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function explainGateError(status: number | undefined): string {
  if (status === 401) return 'Unauthenticated — sign in to load the moderation queue.';
  if (status === 403) return 'Forbidden — only the owner can moderate testimonials.';
  return 'Could not load testimonials.';
}

export function AdminTestimonialsTable() {
  const [items, setItems] = useState<AdminTestimonialItem[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [patchError, setPatchError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiFetch<AdminTestimonialListType>('/api/admin/testimonials', {
      schema: AdminTestimonialList,
    })
      .then((payload) => {
        if (cancelled) return;
        setItems(payload.items);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const failure = err as FetchFailure;
        const status = failure?.apiStatus ?? pickApiStatus(failure?.message ?? '');
        setLoadError(explainGateError(status));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Toggle the published flag for one row. apiFetch returns the canonical
  // updated row when the PATCH succeeds; on failure we roll the optimistic
  // flip back AND surface a transient banner.
  const toggle = useCallback(async (id: string, currentPublished: boolean): Promise<void> => {
    const nextPublished = !currentPublished;
    setItems((prev) =>
      prev ? prev.map((row) => (row.id === id ? { ...row, published: nextPublished } : row)) : prev,
    );
    setPatchError(null);

    const body: TestimonialPublishUpdate = { id, published: nextPublished };
    try {
      const res = await apiFetch<AdminPatchResponse>('/api/admin/testimonials', {
        method: 'PATCH',
        body: JSON.stringify(body),
      });
      setItems((prev) => (prev ? prev.map((row) => (row.id === id ? res.item : row)) : prev));
    } catch (err: unknown) {
      // Roll the optimistic flip back, surface the failure banner.
      setItems((prev) =>
        prev
          ? prev.map((row) => (row.id === id ? { ...row, published: currentPublished } : row))
          : prev,
      );
      const failure = err as FetchFailure;
      const status = failure?.apiStatus ?? pickApiStatus(failure?.message ?? '');
      setPatchError(explainGateError(status));
    }
  }, []);

  if (loadError) {
    return (
      <div
        role="alert"
        className="flex flex-col items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-6 text-sm text-destructive"
      >
        <div className="flex items-center gap-2 font-semibold">
          <AlertCircle aria-hidden className="size-4" />
          Could not load testimonials
        </div>
        <p className="text-xs text-destructive/90">{loadError}</p>
        <Button type="button" variant="outline" size="sm" onClick={() => window.location.reload()}>
          Reload
        </Button>
      </div>
    );
  }

  if (items === null) {
    return (
      <output
        className="flex min-h-[240px] items-center justify-center gap-3 rounded-lg border border-dashed border-border bg-muted/30 text-sm text-muted-foreground"
        aria-live="polite"
      >
        <Loader2 aria-hidden className="size-4 animate-spin" />
        Loading testimonials&hellip;
      </output>
    );
  }

  const list = items;

  return (
    <section
      aria-label="Testimonials moderation"
      className="flex flex-col gap-4 rounded-lg border border-border bg-card text-card-foreground shadow-sm"
    >
      <div className="flex flex-col gap-3 border-b border-border p-5">
        <p className="text-eyebrow">Moderation queue</p>
        <h2 className="font-display text-lg tracking-tight">
          {list.length} {list.length === 1 ? 'testimonial' : 'testimonials'}
        </h2>
        <p className="text-xs text-muted-foreground">
          Newest moderation entry first. Every quote on the public /testimonials page is gated by
          the &ldquo;Published&rdquo; switch below — flip on to publish, off to unpublish.
        </p>
      </div>

      {patchError ? (
        <div
          role="alert"
          className="mx-5 mt-4 flex items-center gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive"
        >
          <AlertCircle aria-hidden className="size-4 shrink-0" />
          <span>{patchError}</span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setPatchError(null)}
            className="ml-auto"
          >
            Dismiss
          </Button>
        </div>
      ) : null}

      {list.length === 0 ? (
        <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
          <p className="font-display text-base text-foreground">No testimonials in the queue.</p>
          <p className="max-w-sm text-xs text-muted-foreground">
            New testimonials land here as soon as the operator adds a row to the
            <span className="mx-1 font-mono text-foreground">Testimonial</span>
            table; flip the Published switch once a quote has been reviewed.
          </p>
          <Separator className="my-2 max-w-[120px]" />
        </div>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[170px]">Submitted</TableHead>
                <TableHead className="w-[170px]">Sector</TableHead>
                <TableHead>Quote</TableHead>
                <TableHead className="w-[260px]">Attribution</TableHead>
                <TableHead className="w-[200px]">Contact</TableHead>
                <TableHead className="w-[140px]">Published</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="align-top">
                    <SubmittedDate iso={row.createdAt} />
                  </TableCell>
                  <TableCell className="align-top">
                    <Badge variant="outline" className="border-brand-700/40 text-brand-700">
                      {sectorLabel(row.sector)}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-[640px] align-top">
                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                      &ldquo;{row.quote}&rdquo;
                    </p>
                  </TableCell>
                  <TableCell className="align-top">
                    <p className="text-sm text-foreground">
                      <span className="font-semibold">{row.attributedRole}</span>
                      <span className="text-muted-foreground"> · {row.organisation}</span>
                    </p>
                  </TableCell>
                  <TableCell className="align-top">
                    {row.contact ? (
                      <a
                        href={isEmailLike(row.contact) ? `mailto:${row.contact}` : '#'}
                        className="text-sm text-brand-700 underline-offset-4 hover:underline"
                      >
                        {row.contact}
                      </a>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="align-top">
                    <div className="flex items-center gap-2">
                      <Switch
                        aria-label={`Published — ${row.attributedRole} · ${row.organisation}`}
                        checked={row.published}
                        onCheckedChange={() => toggle(row.id, row.published)}
                      />
                      <Badge
                        variant={row.published ? 'default' : 'outline'}
                        className="text-[10px] uppercase tracking-wide"
                      >
                        {row.published ? 'Published' : 'Hidden'}
                      </Badge>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </section>
  );
}
