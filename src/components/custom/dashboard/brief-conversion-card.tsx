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
import { type OpenBriefItem, OpenBriefList } from '@/lib/contracts/leads';

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
            {expanded === b.id
              ? b.brief
              : `${b.brief.slice(0, 180)}${b.brief.length > 180 ? '…' : ''}`}
          </p>
          {/* Real user testing feedback (2026-09-04, TWICE): "what does
              build visually try to achieve and what does start governed
              mission instead try to achieve..." and later, after a first
              fix (a shared paragraph above the buttons explaining both):
              "what is build visually, what is start a governed mission
              instead, dont know what is happening here and its not user
              friendly." One paragraph above two buttons apparently still
              reads as boilerplate to skip past — restructured into two
              separate, self-contained option cards, each with its own
              one-line answer directly attached to its own button, so
              there's nothing to cross-reference. */}
          <p className="mt-3 text-small font-medium text-foreground">
            What do you want to do with it?
          </p>
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-2 rounded-xl border border-border p-3">
              <p className="text-small font-semibold text-foreground">Build it yourself, now</p>
              <p className="text-caption text-muted-foreground">
                Sketch the steps on a canvas and test-run it right away. Nobody else reviews it.
              </p>
              <Button asChild className="glass-cta mt-1 self-start">
                <Link href={`/forge?draft=${encodeURIComponent(b.brief.slice(0, 4800))}`}>
                  Build visually
                </Link>
              </Button>
            </div>
            <div className="flex flex-col gap-2 rounded-xl border border-border p-3">
              <p className="text-small font-semibold text-foreground">
                Send it for formal sign-off
              </p>
              <p className="text-caption text-muted-foreground">
                Nothing runs yet. A named human approves every stage before anything is built.
              </p>
              <Button asChild variant="secondary" className="glass-outline-cta mt-1 self-start">
                <Link
                  href={`/missions/new?intake=${encodeURIComponent(b.brief.slice(0, 4800))}&lead=${encodeURIComponent(b.id)}`}
                >
                  Start a governed mission
                </Link>
              </Button>
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="mt-2"
            onClick={() => setExpanded((cur) => (cur === b.id ? null : b.id))}
          >
            {expanded === b.id ? 'Collapse brief' : 'View brief'}
          </Button>
        </section>
      ))}
    </div>
  );
}
