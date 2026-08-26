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

  return (
    <div className="grid gap-6">
      <section className="glass-panel rounded-2xl p-6 md:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
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
    </div>
  );
}
