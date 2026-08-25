// @polsia:user-owned — Admin telemetry overview island. Aggregates:
// autonomy ladder, per-company credit ledger, chat cost by day. Read-only.

'use client';

import * as React from 'react';
import { apiFetch } from '@/lib/api-client';
import {
  AdminTelemetryOverview as AdminTelemetryOverviewSchema,
  type AdminTelemetryOverviewT,
} from '@/lib/contracts/telemetry';

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function Bar({ value, tone }: { value: number; tone: 'brand' | 'rose' }) {
  return (
    <div className="mt-2 h-2 rounded-full bg-border">
      <div
        className={`h-2 rounded-full ${tone === 'brand' ? 'bg-brand-500' : 'bg-rose-500'}`}
        style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%` }}
      />
    </div>
  );
}

export function AdminTelemetryOverview() {
  const [data, setData] = React.useState<AdminTelemetryOverviewT | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    apiFetch('/api/forge/admin/telemetry', { schema: AdminTelemetryOverviewSchema })
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
        <p className="text-foreground">Could not load telemetry: {error}</p>
      </section>
    );
  }
  if (!data) {
    return (
      <section className="glass-card rounded-2xl p-6">
        <p className="text-eyebrow text-brand-700">Telemetry</p>
        <p className="mt-2 text-body text-muted-foreground">Loading overview…</p>
      </section>
    );
  }

  return (
    <div className="space-y-6">
      <section className="glass-card rounded-2xl p-6">
        <header>
          <p className="text-eyebrow text-brand-700">Autonomy ladder</p>
          <h2 className="text-h3">Per-gate decisions</h2>
        </header>
        {data.autonomyLadder.length === 0 ? (
          <p className="mt-2 text-body text-muted-foreground">No approvals recorded yet.</p>
        ) : (
          <div className="mt-4 grid gap-3 md:grid-cols-5">
            {data.autonomyLadder.map((g) => (
              <div key={g.gateIndex} className="glass-chip rounded-xl p-4">
                <p className="text-caption uppercase tracking-wide text-muted-foreground">
                  Gate {g.gateIndex} — {g.stage}
                </p>
                <p className="mt-1 text-h4">{g.approvedTotal}</p>
                <p className="mt-1 text-caption text-muted-foreground">
                  {g.editedTotal} edited · {g.rejectedTotal} rejected
                </p>
                <p className="mt-3 text-caption text-muted-foreground">
                  AI share {Math.round(g.aiOnlyShare * 100)}%
                </p>
                <Bar value={g.aiOnlyShare} tone="brand" />
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="glass-card rounded-2xl p-6">
        <header>
          <p className="text-eyebrow text-brand-700">Per-company credit ledger</p>
          <h2 className="text-h3">Signed spend</h2>
        </header>
        {data.perCompanyCredit.length === 0 ? (
          <p className="mt-2 text-body text-muted-foreground">No credit entries.</p>
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
              {data.perCompanyCredit.map((row) => (
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
          <h2 className="text-h3">Daily rollup</h2>
        </header>
        {data.chatCostByDay.length === 0 ? (
          <p className="mt-2 text-body text-muted-foreground">No chat rows recorded.</p>
        ) : (
          <ul className="mt-4 divide-y divide-border/50">
            {data.chatCostByDay.map((row) => (
              <li key={row.day} className="flex items-center justify-between py-2 text-body">
                <span>
                  <code>{row.day}</code> — {row.messages} messages
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
    </div>
  );
}
