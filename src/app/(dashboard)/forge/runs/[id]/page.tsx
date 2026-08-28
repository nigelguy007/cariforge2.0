// @polsia:user-owned — /forge/runs/[id]: node-by-node run trace.
'use client';

import { use } from 'react';
import { ParallaxAurora } from '@/components/custom/forge-canvas/parallax-aurora';
import { RunTrace } from '@/components/custom/forge-canvas/run-trace';

export default function ForgeRunPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <>
      <ParallaxAurora />
      <RunTrace runId={id} />
    </>
  );
}
