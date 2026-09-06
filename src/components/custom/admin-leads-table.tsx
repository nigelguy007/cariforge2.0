// @polsia:user-owned — admin leads table client island. On mount (and
// whenever the filter changes), fetches /api/admin/leads via apiFetch +
// LeadList contract and renders the rows newest first. Three states
// (loading / error / empty) + the populated table with a Type + Segment
// filter pair, a Reset button when a knob is non-default, a dynamic native
// <a download> CSV link, and an inline notes editor on each row that
// debounces its PATCH and surfaces "Saving…" / "Saved" indicators. 401/403
// from the gate are surfaced as a typed alert; the table is never left in a
// silent state.

'use client';

import {
  AlertCircle,
  Download,
  FilterX,
  Loader2,
  MailQuestion,
  RotateCcw,
  StickyNote,
} from 'lucide-react';
import * as React from 'react';
import { CouncilStatusBadge } from '@/components/custom/council-status-badge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { apiFetch } from '@/lib/api-client';
import { apiHref } from '@/lib/api-href';
import {
  LEAD_SEGMENT_VALUES,
  LeadList,
  type LeadListItem,
  type LeadNotesUpdate,
  LeadNotesUpdateResponse,
  type LeadsFilter,
} from '@/lib/contracts/leads';
import { cn } from '@/lib/utils';

const DEFAULT_FILTER: LeadsFilter = { type: 'all', segment: 'all' };

// Human-readable label per type filter — keeps the dropdown copy consistent
// with what the rest of the dashboard reads ("Walkthrough" vs the wire
// "walkthrough"). Walking this map instead of formatting in place avoids
// drift between render and the URL query string.
const TYPE_LABELS: Record<LeadsFilter['type'], string> = {
  all: 'All submissions',
  home: 'Brief intake',
  walkthrough: 'Walkthrough',
  newsletter: 'Newsletter',
};

const TYPE_ORDER: ReadonlyArray<LeadsFilter['type']> = ['all', 'home', 'walkthrough', 'newsletter'];

// Segment dropdown shows the value as the visible label — the enum strings
// already read like "Financial services", which is what the lead-row copy
// wants. Skipping the wrapper keeps the only source of truth in one place
// (WalkthroughSegment in src/lib/contracts/walkthrough.ts).
const SEGMENT_ORDER: ReadonlyArray<LeadsFilter['segment']> = LEAD_SEGMENT_VALUES;

interface FetchFailure extends Error {
  apiStatus?: number;
}

function pickApiStatus(message: string): number | undefined {
  const match = /failed \((\d{3})\)/.exec(message);
  if (!match) return undefined;
  const code = Number(match[1]);
  if (code >= 100 && code < 600) return code;
  return undefined;
}

function explainGateError(status: number | undefined): string {
  if (status === 401) return 'Unauthenticated — sign in to load the leads table.';
  if (status === 403) return 'Forbidden — only the owner can load the leads table.';
  return 'Could not load leads.';
}

function filterParamSuffix(filter: LeadsFilter): string {
  const parts: string[] = [];
  if (filter.type !== 'all') parts.push(`type=${encodeURIComponent(filter.type)}`);
  if (filter.segment !== 'all') parts.push(`segment=${encodeURIComponent(filter.segment)}`);
  return parts.length > 0 ? `?${parts.join('&')}` : '';
}

function isFilterActive(filter: LeadsFilter): boolean {
  return filter.type !== 'all' || filter.segment !== 'all';
}

function SubmissionDate({ iso }: { iso: string }) {
  // Client-side render of the server ISO timestamp. Stable across SSR + CSR.
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

interface WalkthroughFields {
  fullName?: string;
  organisation?: string;
  role?: string;
  segment?: string;
}

function parseWalkthroughFields(payload: string | null): WalkthroughFields {
  if (!payload) return {};
  try {
    const parsed = JSON.parse(payload) as unknown;
    if (parsed && typeof parsed === 'object') {
      const out: WalkthroughFields = {};
      const p = parsed as Record<string, unknown>;
      if (typeof p.fullName === 'string') out.fullName = p.fullName;
      if (typeof p.organisation === 'string') out.organisation = p.organisation;
      if (typeof p.role === 'string') out.role = p.role;
      if (typeof p.segment === 'string') out.segment = p.segment;
      return out;
    }
  } catch {
    // ignore — fall through to empty fields
  }
  return {};
}

function TypeBadge({ source }: { source: LeadListItem['source'] }) {
  if (source === 'walkthrough') {
    return (
      <Badge
        variant="default"
        className="bg-brand-700 text-[10px] uppercase tracking-wide text-primary-foreground hover:bg-brand-700"
      >
        Walkthrough
      </Badge>
    );
  }
  if (source === 'newsletter') {
    return (
      <Badge
        variant="outline"
        className="border-brand-500/60 text-[10px] uppercase tracking-wide text-brand-700"
      >
        Newsletter
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="text-[10px] uppercase tracking-wide">
      Brief intake
    </Badge>
  );
}

function EmptyDash() {
  return <span className="text-xs text-muted-foreground">—</span>;
}

function SubmissionBlock({ item }: { item: LeadListItem }) {
  const wf = item.source === 'walkthrough' ? parseWalkthroughFields(item.payload) : {};
  const showName = item.source === 'walkthrough';
  return (
    <div className="flex flex-col gap-2">
      {showName ? (
        <p className="text-sm font-semibold text-foreground">{wf.fullName ?? <EmptyDash />}</p>
      ) : (
        <p className="text-sm font-semibold text-foreground">
          <EmptyDash />
        </p>
      )}
      {(item.source === 'walkthrough' && (wf.organisation || wf.role || wf.segment)) ||
      item.source === 'newsletter' ||
      item.source === 'home' ? (
        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[11px] uppercase tracking-wide text-muted-foreground">
          {wf.organisation ? (
            <span className="font-medium text-foreground">{wf.organisation}</span>
          ) : null}
          {wf.role ? <span>· {wf.role}</span> : null}
          {wf.segment ? <span>· {wf.segment}</span> : null}
          {!wf.organisation && !wf.role && !wf.segment && item.source !== 'home' ? (
            <span>Walkthrough fields missing</span>
          ) : null}
        </div>
      ) : null}
      <p
        className={cn(
          'max-w-[520px] whitespace-pre-wrap text-sm leading-relaxed text-foreground/90',
        )}
      >
        {item.brief}
      </p>
      {item.hasAttachment ? (
        <a
          href={apiHref(`/api/admin/leads/${item.id}/attachment`)}
          className="inline-flex w-fit items-center gap-1 text-xs font-medium text-brand-700 underline-offset-4 hover:underline"
        >
          <Download className="size-3" aria-hidden="true" />
          Download attachment
        </a>
      ) : null}
    </div>
  );
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface NotesCellProps {
  item: LeadListItem;
  onSaved: (next: LeadListItem) => void;
  onError: (message: string) => void;
}

// NotesCell is an inline textarea that:
//   - swaps in when the row's button is clicked (or textarea receives focus),
//   - debounces PATCH /api/admin/leads/notes by ~600 ms after the last keystroke,
//   - shows a transient "Saving…" / "Saved" pulse so the operator trusts the write.
//
// We deliberately keep the editor as a single textarea (no Dialog) — the table
// has spare row height in this dashboard and pulling a modal per row would
// bury the context (the brief above the textarea is the operator's reference).
function NotesCell({ item, onSaved, onError }: NotesCellProps) {
  const [draft, setDraft] = React.useState<string>(item.notes ?? '');
  const [status, setStatus] = React.useState<SaveStatus>('idle');
  const lastSentRef = React.useRef<string>(item.notes ?? '');
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // When the row updates externally (filter refetch, theme-toggle, etc.),
  // resync the draft — but ONLY when the server's current value no longer
  // matches the value we most recently sent, so an in-flight debounce is not
  // stomped on.
  React.useEffect(() => {
    if ((item.notes ?? '') !== lastSentRef.current) {
      setDraft(item.notes ?? '');
      lastSentRef.current = item.notes ?? '';
    }
  }, [item.notes]);

  React.useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const send = React.useCallback(
    (value: string) => {
      const next: string | null = value.trim().length === 0 ? null : value;
      setStatus('saving');
      const body: LeadNotesUpdate = { id: item.id, notes: next ?? '' };
      apiFetch<unknown>('/api/admin/leads/notes', {
        method: 'PATCH',
        body: JSON.stringify(body),
        schema: LeadNotesUpdateResponse,
      })
        .then((res) => {
          // The contract is { ok: true, item: LeadListItem } — narrow it back.
          const parsed = LeadNotesUpdateResponse.parse(res);
          lastSentRef.current = parsed.item.notes ?? '';
          setStatus('saved');
          onSaved(parsed.item);
          // Briefly leave "Saved" visible then fade back to idle so a fast
          // operator can still see the indicator on rows they recently
          // touched.
          setTimeout(() => {
            setStatus((current) => (current === 'saved' ? 'idle' : current));
          }, 1500);
        })
        .catch((err: unknown) => {
          const failure = err as FetchFailure;
          const httpStatus = failure?.apiStatus ?? pickApiStatus(failure?.message ?? '');
          if (httpStatus === 404) {
            onError('Lead not found — refresh the table.');
          } else if (httpStatus === 401 || httpStatus === 403) {
            onError(explainGateError(httpStatus));
          } else {
            onError('Could not save the note. Please try again.');
          }
          setStatus('error');
        });
    },
    [item.id, onSaved, onError],
  );

  const onChange = (next: string) => {
    setDraft(next);
    setStatus((current) => (current === 'saved' ? 'idle' : current));
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      // Skip the network round-trip when the value matches what we last sent.
      if (next === lastSentRef.current) {
        setStatus('idle');
        return;
      }
      send(next);
    }, 600);
  };

  // On blur, flush any pending debounce immediately — the operator may have
  // tabbed out with an outstanding keystroke.
  const onBlur = () => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    if (draft !== lastSentRef.current) {
      send(draft);
    }
  };

  const hasNote = (item.notes ?? '').length > 0;
  const placeholder = hasNote ? 'Edit note…' : 'Add a note…';

  return (
    <div className="flex flex-col gap-1.5">
      <Textarea
        value={draft}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        placeholder={placeholder}
        rows={hasNote ? 3 : 2}
        aria-label={`Note for lead ${item.id}`}
        className="min-h-[56px] resize-y text-xs leading-relaxed text-foreground"
      />
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide">
        {status === 'saving' ? (
          <>
            <Loader2 aria-hidden className="size-3 animate-spin text-muted-foreground" />
            <span className="text-muted-foreground">Saving…</span>
          </>
        ) : status === 'saved' ? (
          <span className="text-brand-700">Saved</span>
        ) : status === 'error' ? (
          <span className="text-destructive">Save failed</span>
        ) : (
          <span className="text-muted-foreground">
            {!hasNote && draft.length === 0 ? (
              <>
                <StickyNote aria-hidden className="mr-1 inline size-3 align-[-1px]" />
                Inline editor
              </>
            ) : (
              'Autosaves'
            )}
          </span>
        )}
      </div>
    </div>
  );
}

interface ExportCopyProps {
  filter: LeadsFilter;
}

function ExportButton({ filter }: ExportCopyProps) {
  const href = `/api/admin/leads/export${filterParamSuffix(filter)}`;
  return (
    <Button asChild variant="outline" size="sm">
      {/* Native <a download> preserves the auth cookie + browser download UX.
          The same-origin GET runs through the admin gate again server-side. */}
      <a href={href} download>
        <Download aria-hidden className="size-4" />
        Export CSV
      </a>
    </Button>
  );
}

export function AdminLeadsTable() {
  const [items, setItems] = React.useState<LeadListItem[] | null>(null);
  const [filter, setFilter] = React.useState<LeadsFilter>(DEFAULT_FILTER);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [notesError, setNotesError] = React.useState<string | null>(null);

  // Refetch whenever the filter changes — keyed on the serialised query so
  // we don't double-fetch when the user nudges a knob back to its prior
  // value.
  const query = filterParamSuffix(filter);
  React.useEffect(() => {
    let cancelled = false;
    setItems(null);
    setLoadError(null);
    apiFetch<{ items: LeadListItem[] }>(`/api/admin/leads${query}`, { schema: LeadList })
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
  }, [query]);

  const onItemSaved = React.useCallback((next: LeadListItem) => {
    setItems((prev) => (prev ? prev.map((row) => (row.id === next.id ? next : row)) : prev));
  }, []);

  const resetFilter = React.useCallback(() => {
    setFilter(DEFAULT_FILTER);
  }, []);

  if (loadError) {
    return (
      <div
        role="alert"
        className="flex flex-col items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-6 text-sm text-destructive"
      >
        <div className="flex items-center gap-2 font-semibold">
          <AlertCircle aria-hidden className="size-4" />
          Could not load leads
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
        Loading leads…
      </output>
    );
  }

  const filterActive = isFilterActive(filter);

  return (
    <section
      aria-label="Leads"
      className="flex flex-col gap-4 rounded-lg border border-border bg-card text-card-foreground shadow-sm"
    >
      <div className="flex flex-col gap-4 border-b border-border p-5">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex flex-col gap-1">
            <p className="text-eyebrow">Inbox</p>
            <h2 className="font-display text-lg tracking-tight">
              {items.length} {items.length === 1 ? 'submission' : 'submissions'}
            </h2>
            <p className="text-xs text-muted-foreground">
              Newest first. The CSV download reflects your current filter — change the dropdowns
              then click <span className="font-semibold text-foreground">Export CSV</span> to export
              the same slice.
            </p>
          </div>
          <ExportButton filter={filter} />
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:gap-4">
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="leads-filter-type"
              className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
            >
              Type
            </label>
            <Select
              value={filter.type}
              onValueChange={(v) => setFilter((f) => ({ ...f, type: v as LeadsFilter['type'] }))}
            >
              <SelectTrigger id="leads-filter-type" className="h-9 w-[180px] sm:w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TYPE_ORDER.map((value) => (
                  <SelectItem key={value} value={value}>
                    {TYPE_LABELS[value]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="leads-filter-segment"
              className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
            >
              Segment
            </label>
            <Select
              value={filter.segment}
              onValueChange={(v) =>
                setFilter((f) => ({ ...f, segment: v as LeadsFilter['segment'] }))
              }
            >
              <SelectTrigger id="leads-filter-segment" className="h-9 w-[200px] sm:w-[220px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SEGMENT_ORDER.map((value) => (
                  <SelectItem key={value} value={value}>
                    {value === 'all' ? 'All segments' : value}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {filterActive ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={resetFilter}
              className="self-end"
            >
              <RotateCcw aria-hidden className="size-3.5" />
              Reset
            </Button>
          ) : null}
        </div>
      </div>

      {notesError ? (
        <div
          role="alert"
          className="mx-5 mt-4 flex items-center gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive"
        >
          <AlertCircle aria-hidden className="size-4 shrink-0" />
          <span>{notesError}</span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setNotesError(null)}
            className="ml-auto"
          >
            Dismiss
          </Button>
        </div>
      ) : null}

      {items.length === 0 ? (
        <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
          <div className="flex size-12 items-center justify-center rounded-full border border-border bg-muted text-muted-foreground">
            {filterActive ? (
              <FilterX aria-hidden className="size-5" />
            ) : (
              <MailQuestion aria-hidden className="size-5" />
            )}
          </div>
          {filterActive ? (
            <>
              <p className="font-display text-base text-foreground">No leads match this filter.</p>
              <p className="max-w-sm text-xs text-muted-foreground">
                Try widening the slice — reset to see every submission, or pick a different Type or
                Segment.
              </p>
            </>
          ) : (
            <>
              <p className="font-display text-base text-foreground">No leads yet.</p>
              <p className="max-w-sm text-xs text-muted-foreground">
                New front-door briefs, blog newsletter signups, and procurement-grade walkthrough
                requests land here as soon as a regulated buyer leaves anything on cariforge.com.
              </p>
            </>
          )}
          <Separator className="my-2 max-w-[120px]" />
          <Button asChild variant="ghost" size="sm">
            <a href={apiHref('/api/admin/leads/export')} download>
              Download empty export
            </a>
          </Button>
          {filterActive ? (
            <Button type="button" variant="outline" size="sm" onClick={resetFilter}>
              <RotateCcw aria-hidden className="size-3.5" />
              Reset filter
            </Button>
          ) : null}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[170px]">Submission date</TableHead>
                <TableHead className="w-[110px]">Type</TableHead>
                <TableHead>Submission</TableHead>
                <TableHead className="w-[220px]">Contact email</TableHead>
                <TableHead className="w-[200px]">Council run</TableHead>
                <TableHead className="w-[260px]">Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="align-top">
                    <SubmissionDate iso={item.createdAt} />
                    <div className="mt-1.5">
                      <Badge
                        variant={item.notified ? 'secondary' : 'outline'}
                        className="text-[10px] uppercase tracking-wide"
                      >
                        {item.notified ? 'Notified' : 'Not notified'}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell className="align-top">
                    <TypeBadge source={item.source} />
                  </TableCell>
                  <TableCell className="align-top">
                    <SubmissionBlock item={item} />
                  </TableCell>
                  <TableCell className="align-top">
                    {item.email ? (
                      <a
                        href={`mailto:${item.email}`}
                        className="text-sm text-brand-700 underline-offset-4 hover:underline"
                      >
                        {item.email}
                      </a>
                    ) : (
                      <EmptyDash />
                    )}
                  </TableCell>
                  <TableCell className="align-top">
                    <CouncilStatusBadge
                      status={item.councilRunStatus}
                      verdict={item.councilRunVerdict}
                      notified={item.notified}
                    />
                  </TableCell>
                  <TableCell className="align-top">
                    <NotesCell
                      item={item}
                      onSaved={onItemSaved}
                      onError={(message) => setNotesError(message)}
                    />
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
