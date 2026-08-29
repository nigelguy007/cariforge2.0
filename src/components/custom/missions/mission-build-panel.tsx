// @polsia:user-owned — UX review C2 (wireframe v2, screen 2d): Gate 5's
// handoff into the Forge. Renders only once the mission has reached the
// Software Build gate (Governance approved → currentStageIndex 4). If a
// blueprint is already linked to this mission it deep-links into the
// canvas (and the latest run); otherwise one click creates a seeded,
// mission-scoped blueprint whose authority boundary arrives as a
// mandatory human-approval node.

'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { apiFetch } from '@/lib/api-client';
import {
  BlueprintItem,
  BlueprintList,
  CanvasRunList,
} from '@/lib/contracts/forge-canvas';

interface LinkedBlueprint {
  slug: string;
  name: string;
  version: number;
}

export function MissionBuildPanel({
  missionId,
  currentStageIndex,
}: {
  missionId: string;
  currentStageIndex: number;
}) {
  const router = useRouter();
  const [blueprint, setBlueprint] = React.useState<LinkedBlueprint | null | 'loading'>('loading');
  const [lastRunId, setLastRunId] = React.useState<string | null>(null);
  const [creating, setCreating] = React.useState(false);

  const atBuildGate = currentStageIndex >= 4;

  React.useEffect(() => {
    if (!atBuildGate) return;
    let cancelled = false;
    (async () => {
      try {
        const list = await apiFetch('/api/forge-canvas/blueprints', { schema: BlueprintList });
        const linked = list.items.find((b) => b.missionId === missionId) ?? null;
        if (cancelled) return;
        setBlueprint(
          linked ? { slug: linked.slug, name: linked.name, version: linked.version } : null,
        );
        if (linked) {
          const runs = await apiFetch('/api/forge-canvas/runs', { schema: CanvasRunList });
          if (cancelled) return;
          const latest = runs.items.find((r) => r.blueprintSlug === linked.slug) ?? null;
          setLastRunId(latest?.id ?? null);
        }
      } catch {
        if (!cancelled) setBlueprint(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [missionId, atBuildGate]);

  if (!atBuildGate) return null;

  async function createFromMission() {
    setCreating(true);
    try {
      const bp = await apiFetch('/api/forge-canvas/blueprints/from-mission', {
        method: 'POST',
        body: JSON.stringify({ missionId }),
        schema: BlueprintItem,
      });
      toast.success(`Blueprint ${bp.slug} v${bp.version} created`);
      router.push(`/forge?slug=${encodeURIComponent(bp.slug)}`);
    } catch (err) {
      toast.error((err as Error).message || 'Could not create the blueprint');
      setCreating(false);
    }
  }

  return (
    <section className="glass-panel rounded-2xl border border-brand-300/60 p-6">
      <p className="text-eyebrow text-brand-700">Software Build</p>
      <h2 className="text-h3 text-foreground">Build</h2>
      {blueprint === 'loading' ? (
        <p className="mt-2 text-body text-muted-foreground">Checking for a linked blueprint…</p>
      ) : blueprint ? (
        <>
          <p className="mt-2 text-body text-muted-foreground">
            Blueprint <span className="font-mono text-brand-700">{blueprint.slug}</span> v
            {blueprint.version} is linked to this mission.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Button asChild className="glass-cta">
              <Link href={`/forge?slug=${encodeURIComponent(blueprint.slug)}`}>
                Open in Forge Canvas
              </Link>
            </Button>
            {lastRunId ? (
              <Button asChild variant="secondary" className="glass-outline-cta">
                <Link href={`/forge/runs/${lastRunId}`}>View last run</Link>
              </Button>
            ) : null}
          </div>
        </>
      ) : (
        <>
          <p className="mt-2 text-body text-muted-foreground">
            No blueprint yet. Create one from this mission — its name, slug and authority
            boundary carry over, with the boundary enforced as a human-approval node.
          </p>
          <Button className="glass-cta mt-4" onClick={createFromMission} disabled={creating}>
            {creating ? 'Creating…' : 'Create blueprint from mission'}
          </Button>
        </>
      )}
    </section>
  );
}
