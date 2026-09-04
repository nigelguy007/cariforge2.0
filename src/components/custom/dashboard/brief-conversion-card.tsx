// @polsia:user-owned — the bridge from the public front door into the
// Projects list. When the signed-in user's email matches a brief that no
// project has converted yet, this card surfaces it above the list. "Start a
// project" opens /missions/new with the brief text pre-filled and the lead
// id attached so the reference stays on the project.

'use client';

import Link from 'next/link';
import * as React from 'react';
import { Button } from '@/components/ui/button';
import { apiFetch } from '@/lib/api-client';
import { type OpenBriefItem, OpenBriefList } from '@/lib/contracts/leads';

export interface BriefConversionCardProps {
  // The card owns the fetch, so it reports whether an open brief exists
  // rather than the page re-fetching the same data.
  onLoaded?: (hasOpenBriefs: boolean) => void;
}

const PREVIEW_CHARS = 180;
// A long brief, once URL-encoded, can exceed what some proxies accept in a
// query string (414). The same cap is applied by the route handlers.
const DRAFT_CHARS = 4800;

export function BriefConversionCard({ onLoaded }: BriefConversionCardProps = {}) {
  const [briefs, setBriefs] = React.useState<OpenBriefItem[] | null>(null);
  const [expanded, setExpanded] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    apiFetch('/api/forge/briefs/open', { schema: OpenBriefList })
      .then((data) => {
        if (cancelled) return;
        setBriefs(data.items);
        onLoaded?.(data.items.length > 0);
      })
      .catch(() => {
        // Silent: this card is a bonus bridge, never a blocker — the page
        // renders identically for users with no open brief.
        if (cancelled) return;
        setBriefs([]);
        onLoaded?.(false);
      });
    return () => {
      cancelled = true;
    };
  }, [onLoaded]);

  if (!briefs || briefs.length === 0) return null;

  return (
    <div className="flex flex-col gap-4">
      {briefs.map((b) => {
        const isOpen = expanded === b.id;
        const bodyId = `brief-${b.id}-text`;
        const draft = encodeURIComponent(b.brief.slice(0, DRAFT_CHARS));
        return (
          <section key={b.id} className="app-panel p-5" aria-label={`Your brief ${b.reference}`}>
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <h2 className="app-h3 text-[var(--app-text)]">
                Your brief <span className="font-mono font-normal">{b.reference}</span>
              </h2>
              <p className="app-caption text-[var(--app-text-muted)]">
                Received {new Date(b.createdAt).toLocaleDateString()}
                {b.hasAttachment ? ' · 1 attachment' : ''}
              </p>
            </div>
            <p id={bodyId} className="app-body mt-2 max-w-prose text-[var(--app-text-muted)]">
              {isOpen
                ? b.brief
                : `${b.brief.slice(0, PREVIEW_CHARS)}${b.brief.length > PREVIEW_CHARS ? '…' : ''}`}
            </p>
            {b.brief.length > PREVIEW_CHARS ? (
              <button
                type="button"
                className="app-link app-small mt-1 min-h-11 sm:min-h-0"
                aria-expanded={isOpen}
                aria-controls={bodyId}
                onClick={() => setExpanded((cur) => (cur === b.id ? null : b.id))}
              >
                {isOpen ? 'Show less' : 'Read the full brief'}
              </button>
            ) : null}
            <p className="app-small mt-3 max-w-prose text-[var(--app-text-muted)]">
              Start a project to take this through five approved steps to a runnable prototype
              package. Nothing is deployed to production from here.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
              <Button asChild className="min-h-11">
                <Link href={`/missions/new?intake=${draft}&lead=${encodeURIComponent(b.id)}`}>
                  Start a project
                </Link>
              </Button>
              <Link href={`/forge?draft=${draft}`} className="app-link app-small">
                Or sketch it on the canvas first
              </Link>
            </div>
          </section>
        );
      })}
    </div>
  );
}
