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

import { useRouter } from 'next/navigation';
import * as React from 'react';
import { AgentTeamPanel } from '@/components/custom/dashboard/agent-team-panel';
import { BriefConversionCard } from '@/components/custom/dashboard/brief-conversion-card';
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

  // 2026-09-01 UX pass: the primary action from this box is now "build it"
  // (straight into the Forge Canvas via Guide, /forge?draft=), not "start a
  // mission" (the full 5-gate governance flow). Real user feedback: the
  // visual builder existed but nothing on the first screen pointed at it,
  // and the gate/Oracle/audit machinery was the FIRST thing shown for
  // something that just wants to be sketched and tried. Mission tracking
  // (formal governance, audit trail, gate sign-off) is still fully there —
  // demoted to a secondary link, not removed.
  function handleBuildVisually(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = intake.trim();
    router.push(trimmed ? `/forge?draft=${encodeURIComponent(trimmed)}` : '/forge');
  }

  // The quick-capture box hands off to /missions/new via a query param
  // rather than creating a mission directly: MissionCreate requires nine
  // structured attribution fields (need, intended outcome, constraints,
  // authority boundary, ...) that a single textarea can't satisfy on its
  // own, and loosening that schema is out of scope here. This still gets a
  // user from "type the need" to a pre-filled intake form in one step.
  function handleStartMission() {
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
      {/* UX review C1 (wireframe v2, 2c): the front door's CF reference
          finally goes somewhere — an open brief matched by email surfaces
          here as a one-click conversion into the governed pipeline. */}
      <BriefConversionCard />
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
              {isAdmin ? 'Admin dashboard' : 'Build something'}
            </p>
            <h1 className="text-h2 text-foreground">What do you want to build?</h1>
          </div>
          <Badge variant="secondary" className="w-fit">
            {isAdmin ? 'Admin role' : 'User role'}
          </Badge>
        </div>
        <form onSubmit={handleBuildVisually} className="mt-4 space-y-3">
          <Textarea
            value={intake}
            onChange={(event) => setIntake(event.target.value)}
            rows={3}
            placeholder="Describe what you want — a support-ticket triage bot, a document reviewer, anything. You'll see it as a visual workflow next."
            aria-label="What do you want to build?"
          />
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" className="glass-cta">
              Build visually
            </Button>
            {/* UX review M2: name what this box actually does. Mission
                tracking (formal governance, gate sign-off, audit trail) is
                still available, just no longer the first/only option. */}
            <span className="text-small text-muted-foreground">
              Need formal sign-off tracking instead?{' '}
              <button
                type="button"
                onClick={handleStartMission}
                className="underline underline-offset-4 hover:text-foreground"
              >
                Start a governed mission
              </button>{' '}
              — same text, the full 5-gate flow.
            </span>
          </div>
        </form>
      </section>

      <section>
        <h2 className="text-h3 text-foreground">Your missions</h2>
        <div className="mt-4">
          {/* The hero above already has its own "Start a mission" CTA —
              real user report: a second identical button here was
              confusing ("start a mission and your missions start a
              mission"). */}
          <MissionList showEmptyCta={false} />
        </div>
      </section>

      <section>
        <h2 className="text-h3 text-foreground">Your AI team</h2>
        {/* UX review: real user confusion — "what's the difference between
            the 5 agents and 7 specialised agents?" Spelled out here, plus a
            per-agent "Runs gate N" / "Wraps delivery" pill below. */}
        <p className="mt-1 text-small text-muted-foreground">
          Five of these seven agents each run one of your mission&rsquo;s five gates; Partner and
          Impact wrap around delivery rather than owning a gate — you never have to manage any of
          them directly.
        </p>
        <div className="mt-4">
          <AgentTeamPanel />
        </div>
      </section>
    </div>
  );
}
