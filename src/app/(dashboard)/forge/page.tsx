// @polsia:user-owned — /forge: the Forge Canvas builder page (Agent
// Builder Release 1). Client island does all the work; this page just
// frames it with the parallax liquid-glass backdrop.
'use client';

import { ForgeCanvasBuilder } from '@/components/custom/forge-canvas/canvas-builder';
import { ParallaxAurora } from '@/components/custom/forge-canvas/parallax-aurora';

export default function ForgeCanvasPage() {
  return (
    <>
      <ParallaxAurora />
      <div className="space-y-4">
        <header>
          <p className="text-caption uppercase tracking-wide text-brand-700">Forge Canvas</p>
          <h1 className="text-h2 text-foreground">Build a governed workflow</h1>
          <p className="text-small text-muted-foreground">
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
