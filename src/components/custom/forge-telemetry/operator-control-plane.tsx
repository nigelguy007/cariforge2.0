// @polsia:user-owned — Operator Control Plane card for the admin missions
// page. Pulls the admin telemetry overview + per-mission control-plane rows
// and renders the Mission Control table with gate states, release-source
// actors, and blended-cost cents per mission. Read-only island ('use
// client' because it fetches via apiFetch).

'use client';

import * as React from 'react';
import { z } from 'zod';
import { apiFetch } from '@/lib/api-client';
import {
  AdminTelemetryOverview,
  type AdminTelemetryOverviewT,
  type OperatorControlPlaneRowT,
  OperatorControlPlane as OperatorControlPlaneSchema,
} from '@/lib/contracts/telemetry';

const GATE_TONES: Record<OperatorControlPlaneRowT['latestGateState'], string> = {
  Awaiting: 'ring-slate-500/40',
  Approved: 'ring-emerald-500/40',
  Returned: 'ring-amber-500/40',
  Refused: 'ring-rose-500/40',
};

function formatActor(actor: OperatorControlPlaneRowT['releaseActor']): string {
  if (actor === 'AIOnly') return 'AI only';
  if (actor === 'Human') return 'Human released';
  return 'Hybrid';
}

function formatCents(cents: number): string {
  // Display only — server-side math stays in integer cents.
  return `$${(cents / 100).toFixed(2)}`;
}

export function OperatorControlPlane() {
  const [overview, setOverview] = React.useState<AdminTelemetryOverviewT | null>(null);
  const [rows, setRows] = React.useState<OperatorControlPlaneRowT[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    const envelope = z.object({
      overview: AdminTelemetryOverview,
      controlPlane: OperatorControlPlaneSchema,
    });
    apiFetch('/api/forge/admin/telemetry', { schema: envelope })
      .then((data) => {
        if (cancelled) return;
        setOverview(data.overview);
        setRows(data.controlPlane.rows);
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
        <p className="text-foreground">Could not load telemetry: {error}</p>
      </section>
    );
  }
  if (!overview || !rows) {
    return (
      <section className="glass-card rounded-2xl p-6">
        <p className="text-eyebrow text-brand-700">Operator control plane</p>
        <p className="mt-2 text-body text-muted-foreground">Loading telemetry…</p>
      </section>
    );
  }

  return (
    <div className="space-y-6">
      <section className="glass-card rounded-2xl p-6">
        <header>
          <p className="text-eyebrow text-brand-700">Autonomy ladder</p>
          <h2 className="text-h3">Gate-by-gate decisions + AI share</h2>
          <p className="mt-1 text-small text-muted-foreground">
            AI share is the fraction of approve decisions that carry an AI actor marker; 0 means no
            approvals were marked, 1 means every approval was AI-driven.
          </p>
        </header>
        <div className="mt-4 grid gap-3 md:grid-cols-5">
          {overview.autonomyLadder.map((g) => (
            <div key={g.gateIndex} className="glass-chip rounded-xl p-4">
              <p className="text-caption uppercase tracking-wide text-muted-foreground">
                Gate {g.gateIndex} — {g.stage}
              </p>
              <p className="mt-1 text-h4">{g.approvedTotal}</p>
              <dl className="mt-2 grid grid-cols-2 gap-2 text-small">
                <div>
                  <dt className="text-caption text-muted-foreground">Edited</dt>
                  <dd>{g.editedTotal}</dd>
                </div>
                <div>
                  <dt className="text-caption text-muted-foreground">Rejected</dt>
                  <dd>{g.rejectedTotal}</dd>
                </div>
              </dl>
              <p className="mt-3 text-caption text-muted-foreground">
                AI share {Math.round(g.aiOnlyShare * 100)}%
              </p>
              <div className="mt-2 h-2 rounded-full bg-border">
                <div
                  className="h-2 rounded-full bg-brand-500"
                  style={{ width: `${Math.round(g.aiOnlyShare * 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="glass-card rounded-2xl p-6">
        <header>
          <p className="text-eyebrow text-brand-700">Credit ledger</p>
          <h2 className="text-h3">Per-company spend</h2>
        </header>
        {overview.perCompanyCredit.length === 0 ? (
          <p className="mt-2 text-body text-muted-foreground">No credit entries recorded.</p>
        ) : (
          <table className="mt-4 w-full text-body">
            <thead className="text-caption uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="py-2 text-left">Company</th>
                <th className="py-2 text-right">Credits</th>
                <th className="py-2 text-right">Debits</th>
                <th className="py-2 text-right">Net</th>
              </tr>
            </thead>
            <tbody>
              {overview.perCompanyCredit.map((row) => (
                <tr key={row.companyId} className="border-t border-border/50">
                  <td className="py-2">
                    <code>{row.companyId}</code>
                  </td>
                  <td className="py-2 text-right">{formatCents(row.credits)}</td>
                  <td className="py-2 text-right">{formatCents(row.debits)}</td>
                  <td
                    className={`py-2 text-right ${row.netCents < 0 ? 'text-rose-600 dark:text-rose-400' : ''}`}
                  >
                    {formatCents(row.netCents)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="glass-card rounded-2xl p-6">
        <header>
          <p className="text-eyebrow text-brand-700">Chat cost by day</p>
          <h2 className="text-h3">Daily chat spend</h2>
        </header>
        {overview.chatCostByDay.length === 0 ? (
          <p className="mt-2 text-body text-muted-foreground">No chat usage recorded.</p>
        ) : (
          <ul className="mt-4 divide-y divide-border/50">
            {overview.chatCostByDay.map((row) => (
              <li key={row.day} className="flex items-center justify-between py-2 text-body">
                <span>
                  <code>{row.day}</code> — {row.messages} msgs
                </span>
                <span className="flex items-center gap-2">
                  {row.hasUnknownCost ? (
                    <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-caption text-amber-700 dark:text-amber-300">
                      unknown cost
                    </span>
                  ) : null}
                  <span>{formatCents(row.cents)}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="glass-card rounded-2xl p-6">
        <header>
          <p className="text-eyebrow text-brand-700">Mission Control surface</p>
          <h2 className="text-h3">Mission telemetry rollup</h2>
        </header>
        {rows.length === 0 ? (
          <p className="mt-2 text-body text-muted-foreground">No missions on the platform yet.</p>
        ) : (
          <table className="mt-4 w-full text-body">
            <thead className="text-caption uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="py-2 text-left">Mission</th>
                <th className="py-2 text-left">Status</th>
                <th className="py-2 text-left">Gate</th>
                <th className="py-2 text-left">Release actor</th>
                <th className="py-2 text-left">Draft age</th>
                <th className="py-2 text-right">Blended cost</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.missionId} className="border-t border-border/50">
                  <td className="py-2">
                    <a href={`/missions/${r.missionSlug}`} className="link-brand">
                      {r.missionName}
                    </a>
                    {r.hasUnknownCost ? (
                      <span className="ml-2 rounded-full bg-amber-500/15 px-2 py-0.5 text-caption text-amber-700 dark:text-amber-300">
                        unknown cost
                      </span>
                    ) : null}
                  </td>
                  <td className="py-2">
                    <code>{r.missionStatus}</code>
                  </td>
                  <td className="py-2">
                    <span
                      className={`glass-chip rounded-full px-2 py-0.5 ring-1 ${GATE_TONES[r.latestGateState]}`}
                    >
                      {r.latestGateState}
                    </span>
                  </td>
                  <td className="py-2">{formatActor(r.releaseActor)}</td>
                  <td className="py-2">
                    {r.isAwaiting ? (
                      r.draftAgeBucket
                    ) : (
                      <span className="text-muted-foreground">released</span>
                    )}
                  </td>
                  <td className="py-2 text-right">{formatCents(r.blendedCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
