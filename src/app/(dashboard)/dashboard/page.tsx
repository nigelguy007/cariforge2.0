// @polsia:user-owned
'use client';

// R1 (mission pipeline rebuild): this used to render four hardcoded
// placeholder KPI cards (Activity: '0', Support: 'Open') and a generic
// "Workspace" checklist, and never linked to /missions at all — the
// Missions pipeline (~30 wired API routes, the most built-out part of this
// app) was invisible from the first screen a signed-in user sees. Replaced
// with a prompt-first entry point (modeled on the reference platform's
// "Ask CARI" hero) above the real mission list, reusing the existing
// GET /api/forge/missions data — page composition, no new backend work.

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { AgentTeamPanel } from '@/components/custom/dashboard/agent-team-panel';
import { MissionList } from '@/components/custom/missions/mission-list';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useSession } from '@/lib/auth-client';

function hasRole(role: string | null | undefined, expected: string) {
  return (
    role
      ?.split(',')
      .map((item) => item.trim())
      .includes(expected) ?? false
  );
}

export default function DashboardPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const isAdmin = hasRole(session?.user?.role, 'admin');
  const [intake, setIntake] = React.useState('');

  // The quick-capture box below hands off to /missions/new via a query
  // param rather than creating a mission directly: MissionCreate requires
  // nine structured attribution fields (need, intended outcome, constraints,
  // authority boundary, ...) that a single textarea can't satisfy on its
  // own, and loosening that schema is out of scope here. This still gets a
  // user from "type the need" to a pre-filled intake form in one step.
  function handleStartMission(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = intake.trim();
    router.push(trimmed ? `/missions/new?intake=${encodeURIComponent(trimmed)}` : '/missions/new');
  }

  // Real mobile bug found in QA, root cause of the dashboard's horizontal
  // scroll: bare `display:grid` with no explicit grid-template-columns
  // auto-sizes its single implicit column to the content's max-content
  // width (610px here) instead of the viewport — every child inherited
  // that width regardless of their own min-w-0. flex-col doesn't have
  // this failure mode.
  return (
    <div className="flex flex-col gap-6">
      {/* Real gap found via user screenshot: this authenticated area has no
          atmospheric background at all (no layout.tsx, just the flat page
          --background), so .glass-panel's blur/translucency had nothing
          textured behind it to reveal — it just looked like a flat box,
          not "liquid glass". hero-aurora (already proven on the homepage
          and /how-it-works) gives it something to actually blur. */}
      <section className="glass-panel hero-aurora relative overflow-hidden rounded-2xl p-6 md:p-8">
        {/* Real mobile bug found in QA: a flex row's children default to
            min-width:auto, so this text block's intrinsic content width
            (the H1 in particular) was forcing the whole hero section wider
            than the viewport instead of letting the heading wrap —
            min-w-0 is the standard fix, lets it shrink and wrap properly. */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-caption uppercase tracking-wide text-brand-700">
              {isAdmin ? 'Admin dashboard' : 'Mission Control'}
            </p>
            <h1 className="text-h2 text-foreground">What would you like to achieve?</h1>
          </div>
          <Badge variant="secondary" className="w-fit">
            {isAdmin ? 'Admin role' : 'User role'}
          </Badge>
        </div>
        <form onSubmit={handleStartMission} className="mt-4 space-y-3">
          <Textarea
            value={intake}
            onChange={(event) => setIntake(event.target.value)}
            rows={3}
            placeholder="Describe the need as you would to a colleague — the forge turns it into a governed, testable mission through five human gates."
            aria-label="What would you like to achieve?"
          />
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" className="glass-cta">
              Start a mission
            </Button>
            <Link
              href="/missions/new"
              className="text-small text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              or open the full intake form
            </Link>
          </div>
        </form>
      </section>

      <section>
        <h2 className="text-h3 text-foreground">Your missions</h2>
        <div className="mt-4">
          <MissionList />
        </div>
      </section>

      <section>
        <h2 className="text-h3 text-foreground">Your AI team</h2>
        <p className="mt-1 text-small text-muted-foreground">
          Seven specialists work every mission — you never have to manage them directly.
        </p>
        <div className="mt-4">
          <AgentTeamPanel />
        </div>
      </section>
    </div>
  );
}
