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

export interface BriefConversionCardProps {
  // Real user feedback (2026-09-04, with screenshot): the dashboard showed
  // "Your brief" (with its own Build-visually / Start-a-mission choice)
  // immediately followed by a second, generic "What do you want to build?"
  // quick-capture box — "remove the what do you want to build because u
  // would have added it in the your brief." This card is the only thing
  // that knows whether an open brief actually exists (it owns the fetch),
  // so it reports that back via this callback rather than the dashboard
  // page re-fetching the same data itself.
  onLoaded?: (hasOpenBriefs: boolean) => void;
}

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
        // Silent: this card is a bonus bridge, never a blocker — the
        // dashboard renders identically for users with no open brief.
        if (cancelled) return;
        setBriefs([]);
        onLoaded?.(false);
      });
    return () => {
      cancelled = true;
    };
    // onLoaded is included per biome's useExhaustiveDependencies — in
    // practice this is always a useState setter (DashboardPage passes
    // setHasOpenBrief directly), which React guarantees is referentially
    // stable across renders, so this still only fetches once on mount.
  }, [onLoaded]);

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
          {/* Real user feedback (2026-09-04): "what is the meaning of build
              visually and start a governed mission is nothing is built?
              what is the point of both?" Fair, and found by actually
              completing a real mission end to end: gate 4's approval
              produces a Blueprint + Runbook — a reviewed, audited SPEC,
              not running code (GATE_DEFS[4].name is literally "Prototype
              spec approved", not "Build complete" — see forge.ts). The
              old copy here said "before anything is built," which reads
              as a promise this pipeline itself never keeps. Rewritten to
              state each path's actual deliverable, plus the one fact that
              answers "what's the point": neither path deploys real
              software from inside this app — that's a separate, later
              step (Production Forge, run by your own team), using
              whichever output you pick below. */}
          <p className="mt-3 text-small font-medium text-foreground">
            What do you want to do with it?
          </p>
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-2 rounded-xl border border-border p-3">
              <p className="text-small font-semibold text-foreground">
                Sketch it and try it yourself
              </p>
              <p className="text-caption text-muted-foreground">
                A working draft you test-run in a sandbox, right away — nothing real happens, nobody
                else reviews it. Good for checking the logic makes sense first.
              </p>
              <Button asChild className="glass-cta mt-1 self-start">
                <Link href={`/forge?draft=${encodeURIComponent(b.brief.slice(0, 4800))}`}>
                  Build visually
                </Link>
              </Button>
            </div>
            <div className="flex flex-col gap-2 rounded-xl border border-border p-3">
              <p className="text-small font-semibold text-foreground">
                Get it formally reviewed and specced
              </p>
              <p className="text-caption text-muted-foreground">
                Not code — a fully audited, human-approved build spec, with a named person signing
                off at every stage. Often the actual deliverable a regulated buyer needs.
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
          <p className="mt-2 text-caption text-muted-foreground">
            Neither one deploys real software by itself — that happens afterward, by your own team,
            using whichever output you build from here.
          </p>
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
