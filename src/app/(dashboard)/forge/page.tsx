// @polsia:user-owned — /forge: the Forge Canvas builder page (Agent
// Builder Release 1). Client island does all the work; this page just
// frames it with the parallax liquid-glass backdrop.
'use client';

import Link from 'next/link';
import { ForgeCanvasBuilder } from '@/components/custom/forge-canvas/canvas-builder';
import { ParallaxAurora } from '@/components/custom/forge-canvas/parallax-aurora';

export default function ForgeCanvasPage() {
  return (
    <>
      <ParallaxAurora />
      <div className="space-y-4">
        <header>
          <p className="text-caption uppercase tracking-wide text-brand-700">Forge Canvas</p>
          {/* Real user testing feedback (2026-09-04): "I don't know what is
              the meaning of this page... it needs an explanation and
              objective of what we are trying to achieve." Two fixes: the
              old H1 said "Build a GOVERNED workflow" — the exact same word
              the OTHER path uses ("Start a GOVERNED mission"), making the
              two sound like variants of one thing instead of the two
              genuinely different paths they are. Renamed to stop that
              collision, and added one sentence stating the objective in
              plain terms before the mechanics (Start → Agents → ...) —
              which explains HOW, not WHY you're here.
              Link text updated (simplified-workspace redesign) to match
              /missions/new's own current heading, "Start a project". */}
          <h1 className="text-h2 text-foreground">Sketch it, then run it</h1>
          <p className="text-small text-foreground">
            This is the self-service path: you build the actual steps yourself on a canvas, and
            test-run them right here — nothing formal, nothing reviewed by anyone else. Looking for
            the audited, sign-off version instead?{' '}
            <Link href="/missions/new" className="link-brand">
              Start a project
            </Link>
            .
          </p>
          <p className="mt-2 text-small text-muted-foreground">
            Connect Start → Agents → Conditions → Human approval → End, validate, then test-run it
            safely. Runs pause at every Human approval node until someone decides with a typed
            reason.
          </p>
        </header>
        <ForgeCanvasBuilder />
      </div>
    </>
  );
}
