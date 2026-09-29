// @polsia:user-owned — headline numbers for the fundraise loop. Meeting rate
// is meetings / contacted and reads "—" until anyone has been contacted.

'use client';

import type { LoopSummary } from '@/lib/contracts/fundraise-loop';
import { num, pct } from './fundraise-shared';

export function KpiTiles({ totals }: { totals: LoopSummary['totals'] }) {
  const tiles: { label: string; value: string; hint?: string }[] = [
    { label: 'Contacted', value: num(totals.contacted) },
    { label: 'Replies', value: num(totals.replies) },
    { label: 'Meetings', value: num(totals.meetings) },
    {
      label: 'Meeting rate',
      value: totals.contacted > 0 ? pct(totals.meetings / totals.contacted) : '—',
      hint: 'meetings ÷ contacted',
    },
    { label: 'Pending approvals', value: num(totals.pendingApproval) },
    { label: 'Warm intros', value: num(totals.warmIntros) },
  ];
  return (
    <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {tiles.map((tile) => (
        <div key={tile.label} className="app-panel flex flex-col gap-1 p-4">
          <dt className="app-caption font-medium text-[var(--app-text-muted)]">{tile.label}</dt>
          <dd className="font-display text-2xl font-semibold tabular-nums text-[var(--app-text)]">
            {tile.value}
          </dd>
          {tile.hint ? (
            <dd className="app-caption text-[var(--app-text-muted)]">{tile.hint}</dd>
          ) : null}
        </div>
      ))}
    </dl>
  );
}
