// @polsia:user-owned — UX review C1 (wireframe v2, screen 2c): the bridge
// from the public front door into Mission Control. When the signed-in
// user's email matches a brief that no mission has converted yet, this
// card surfaces it above the quick-capture hero — the CF reference the
// visitor was given at submission finally goes somewhere. "Convert to
// mission" opens /missions/new with the brief text pre-filled and the
// lead id attached so the reference stays on the mission forever.

'use client';

import Link from 'next/link';
import * as React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { apiFetch } from '@/lib/api-client';
import { OpenBriefList, type OpenBriefItem } from '@/lib/contracts/leads';

export function BriefConversionCard() {
  const [briefs, setBriefs] = React.useState<OpenBriefItem[] | null>(null);
  const [expanded, setExpanded] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    apiFetch('/api/forge/briefs/open', { schema: OpenBriefList })
      .then((data) => {
        if (!cancelled) setBriefs(data.items);
      })
      .catch(() => {
        // Silent: this card is a bonus bridge, never a blocker — the
        // dashboard renders identically for users with no open brief.
        if (!cancelled) setBriefs([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!briefs || briefs.length === 0) return null;

  return (
    <div className="flex flex-col gap-4">
      {briefs.map((b) => (
        <section
          key={b.id}
          className="glass-panel rounded-2xl border border-brand-300/60 p-6"
          aria-label={`Open brief ${b.reference}`}
        >
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-h4 text-foreground">
              Your brief · <span className="font-mono text-brand-700">{b.reference}</span>
            </h2>
            <Badge variant="secondary">received</Badge>
            <span className="text-small text-muted-foreground">
              {new Date(b.createdAt).toLocaleDateString()}
              {b.hasAttachment ? ' · 1 attachment' : ''}
            </span>
          </div>
          <p className="mt-2 text-body text-muted-foreground">
            {expanded === b.id ? b.brief : `${b.brief.slice(0, 180)}${b.brief.length > 180 ? '…' : ''}`}
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button asChild className="glass-cta">
              <Link
                href={`/missions/new?intake=${encodeURIComponent(b.brief.slice(0, 4800))}&lead=${encodeURIComponent(b.id)}`}
              >
                Convert to mission
              </Link>
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="glass-outline-cta"
              onClick={() => setExpanded((cur) => (cur === b.id ? null : b.id))}
            >
              {expanded === b.id ? 'Collapse brief' : 'View brief'}
            </Button>
          </div>
        </section>
      ))}
    </div>
  );
}
