// @polsia:user-owned — Admin adoption & realised-value dashboard island
// (Section 9 of the Aug 2026 enterprise-platform handoff doc). Sibling to
// AdminTelemetryOverview, same fetch/render pattern. Real aggregates over
// every Mission/Objection row — a small pilot with few real missions will
// show small real numbers here; that's honest, not a bug.

'use client';

import * as React from 'react';
import { apiFetch } from '@/lib/api-client';
import {
  AdoptionDashboard as AdoptionDashboardSchema,
  type AdoptionDashboardT,
} from '@/lib/contracts/telemetry';

function formatPercent(v: number | null): string {
  return v === null ? 'no data yet' : `${Math.round(v * 100)}%`;
}

function formatDays(v: number | null): string {
  return v === null ? 'no data yet' : `${v.toFixed(1)} days`;
}

export function AdminAdoptionOverview() {
  const [data, setData] = React.useState<AdoptionDashboardT | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    apiFetch('/api/forge/admin/adoption', { schema: AdoptionDashboardSchema })
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <section className="glass-card rounded-2xl p-6 text-body">
        <p className="text-foreground">Could not load adoption metrics: {error}</p>
      </section>
    );
  }
  if (!data) {
    return (
      <section className="glass-card rounded-2xl p-6">
        <p className="text-eyebrow text-brand-700">Adoption &amp; value</p>
        <p className="mt-2 text-body text-muted-foreground">Loading…</p>
      </section>
    );
  }

  const { adoption, quality } = data;

  return (
    <div className="space-y-6">
      <section className="glass-card rounded-2xl p-6">
        <header>
          <p className="text-eyebrow text-brand-700">Adoption</p>
          <h2 className="text-h3">Missions &amp; completion</h2>
          <p className="mt-1 text-caption text-muted-foreground">
            Every figure here is a real count over this platform&rsquo;s actual Mission rows — no
            sample data.
          </p>
        </header>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="glass-chip rounded-xl p-4">
            <p className="text-caption uppercase tracking-wide text-muted-foreground">
              Total missions
            </p>
            <p className="mt-1 text-h4">{adoption.totalMissions}</p>
          </div>
          <div className="glass-chip rounded-xl p-4">
            <p className="text-caption uppercase tracking-wide text-muted-foreground">
              Completion rate
            </p>
            <p className="mt-1 text-h4">{formatPercent(adoption.completionRate)}</p>
            <p className="mt-1 text-caption text-muted-foreground">
              of {adoption.terminalMissionCount} terminal mission
              {adoption.terminalMissionCount === 1 ? '' : 's'}
            </p>
          </div>
          <div className="glass-chip rounded-xl p-4">
            <p className="text-caption uppercase tracking-wide text-muted-foreground">
              Avg. cycle time
            </p>
            <p className="mt-1 text-h4">{formatDays(adoption.averageCycleTimeDays)}</p>
            <p className="mt-1 text-caption text-muted-foreground">created &rarr; completed</p>
          </div>
        </div>

        {adoption.statusBreakdown.length > 0 && (
          <div className="mt-6">
            <p className="text-caption uppercase tracking-wide text-muted-foreground">By status</p>
            <ul className="mt-2 flex flex-wrap gap-2">
              {adoption.statusBreakdown.map((s) => (
                <li
                  key={s.status}
                  className="rounded-full border border-border px-3 py-1 text-caption"
                >
                  {s.status}: <span className="font-semibold">{s.count}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {adoption.missionsByWeek.length > 0 && (
          <div className="mt-6">
            <p className="text-caption uppercase tracking-wide text-muted-foreground">
              Missions created, by week
            </p>
            <ul className="mt-2 divide-y divide-border/50">
              {adoption.missionsByWeek.map((w) => (
                <li
                  key={w.weekStartIso}
                  className="flex items-center justify-between py-2 text-body"
                >
                  <span>
                    Week of <code>{w.weekStartIso}</code>
                  </span>
                  <span className="font-semibold">{w.count}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section className="glass-card rounded-2xl p-6">
        <header>
          <p className="text-eyebrow text-brand-700">Quality</p>
          <h2 className="text-h3">Objections raised</h2>
        </header>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="glass-chip rounded-xl p-4">
            <p className="text-caption uppercase tracking-wide text-muted-foreground">Total</p>
            <p className="mt-1 text-h4">{quality.totalObjections}</p>
          </div>
          <div className="glass-chip rounded-xl p-4">
            <p className="text-caption uppercase tracking-wide text-muted-foreground">Resolved</p>
            <p className="mt-1 text-h4">{quality.resolvedCount}</p>
          </div>
          <div className="glass-chip rounded-xl p-4">
            <p className="text-caption uppercase tracking-wide text-muted-foreground">
              Resolution rate
            </p>
            <p className="mt-1 text-h4">{formatPercent(quality.resolutionRate)}</p>
          </div>
        </div>
      </section>
    </div>
  );
}
