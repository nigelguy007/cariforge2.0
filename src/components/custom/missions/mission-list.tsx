// @polsia:user-owned — Mission list client island. Reads through the
// /api/forge/missions route and renders each mission as a card.

'use client';

import Link from 'next/link';
import * as React from 'react';
import { Button } from '@/components/ui/button';
import { apiFetch } from '@/lib/api-client';
import { type MissionListItemT, MissionList as MissionListSchema } from '@/lib/contracts/forge';
import { MissionStatusBadge } from './mission-status-badge';

interface MissionListProps {
  // The dashboard embeds this list directly under its own "What would you
  // like to achieve?" hero, which already has a "Start a mission" button —
  // showing a second, identical CTA in the empty state below it read as two
  // unexplained buttons doing the same thing (real user report: "I don't
  // understand what's the difference between... start a mission and your
  // missions start a mission"). The standalone /missions and
  // /admin/missions pages have no such hero, so they keep the CTA.
  showEmptyCta?: boolean;
}

export function MissionList({ showEmptyCta = true }: MissionListProps = {}) {
  const [items, setItems] = React.useState<MissionListItemT[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    apiFetch('/api/forge/missions', { schema: MissionListSchema })
      .then((data) => {
        if (!cancelled) setItems(data.items);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <div className="glass-card rounded-2xl p-6 text-body">
        <p className="text-foreground">Could not load missions: {error}</p>
      </div>
    );
  }
  if (items === null) {
    return (
      <div className="glass-card rounded-2xl p-6 text-body">
        <p className="text-muted-foreground">Loading missions…</p>
      </div>
    );
  }
  if (items.length === 0) {
    return (
      <div className="glass-card rounded-2xl p-8 text-body">
        {/* Real bug found in QA: this heading had no explicit text color,
            relying on plain inheritance instead of the --foreground token —
            same pattern already fixed for Textarea/Input this session. */}
        <h3 className="text-h4 text-foreground">No missions yet</h3>
        <p className="mt-2 text-muted-foreground">
          {showEmptyCta
            ? 'Capture a plain-English need and the forge will turn it into a governed, testable software-delivery mission.'
            : 'Missions you start above will show up here, each moving through five governed human gates.'}
        </p>
        {showEmptyCta ? (
          <Button asChild className="glass-cta mt-4">
            <Link href="/missions/new">Start a mission</Link>
          </Button>
        ) : null}
      </div>
    );
  }
  return (
    <div className="grid gap-4">
      {items.map((m) => (
        <Link
          key={m.id}
          href={`/missions/${m.slug}`}
          className="glass-card lift-soft block rounded-2xl p-6 transition-shadow"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-h4 text-foreground">{m.name}</h3>
              <p className="mt-1 text-small text-muted-foreground">
                Updated {new Date(m.updatedAt).toLocaleDateString()} · Confidence{' '}
                {Math.round(m.confidence * 100)}%
              </p>
            </div>
            <MissionStatusBadge status={m.status} />
          </div>
          {m.domainTags.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {m.domainTags.map((t) => (
                <span key={t} className="glass-chip rounded-full px-2.5 py-0.5 text-caption">
                  {t}
                </span>
              ))}
            </div>
          ) : null}
        </Link>
      ))}
    </div>
  );
}
