// @polsia:user-owned — Admin mission list client island.

'use client';

import Link from 'next/link';
import * as React from 'react';
import { apiFetch } from '@/lib/api-client';
import { MissionList, type MissionListItemT } from '@/lib/contracts/forge';
import { MissionStatusBadge } from './mission-status-badge';

export function AdminMissionList() {
  const [items, setItems] = React.useState<MissionListItemT[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    apiFetch('/api/forge/admin/missions', { schema: MissionList })
      .then((data) => {
        if (!cancelled) setItems(data.items);
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
      <div className="glass-card rounded-2xl p-6 text-body">
        <p>Could not load missions: {error}</p>
      </div>
    );
  }
  if (items === null) {
    return (
      <div className="glass-card rounded-2xl p-6 text-body">
        <p>Loading missions…</p>
      </div>
    );
  }
  if (items.length === 0) {
    return (
      <div className="glass-card rounded-2xl p-6 text-body text-muted-foreground">
        No missions recorded.
      </div>
    );
  }
  return (
    <table className="w-full text-body">
      <thead className="text-caption uppercase tracking-wide text-muted-foreground">
        <tr>
          <th className="py-2 text-left">Mission</th>
          <th className="py-2 text-left">Owner</th>
          <th className="py-2 text-left">Status</th>
          <th className="py-2 text-left">Confidence</th>
          <th className="py-2 text-left">Updated</th>
        </tr>
      </thead>
      <tbody>
        {items.map((m) => (
          <tr key={m.id} className="border-t border-border/50">
            <td className="py-2">
              <Link className="link-brand" href={`/missions/${m.slug}`}>
                {m.name}
              </Link>
            </td>
            <td className="py-2">
              <code>{m.id.slice(-6)}</code>
            </td>
            <td className="py-2">
              <MissionStatusBadge status={m.status} />
            </td>
            <td className="py-2">{Math.round(m.confidence * 100)}%</td>
            <td className="py-2 text-small">{new Date(m.updatedAt).toLocaleString()}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
