// @polsia:user-owned — per-segment evidence + next allocation for the
// fundraise loop, with add / edit (incl. pause / activate) via SegmentDialog.

'use client';

import { Pencil, Plus } from 'lucide-react';
import * as React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { LoopPlan, SegmentStats } from '@/lib/contracts/fundraise-loop';
import { cn } from '@/lib/utils';
import { num, Panel, pct, RecommendationBadge } from './fundraise-shared';
import { SegmentDialog } from './segment-dialog';

function weeksLeft(value: number | null): string {
  if (value === null) return '—';
  if (!Number.isFinite(value)) return '∞';
  return value < 10 ? value.toFixed(1) : String(Math.round(value));
}

export function SegmentTable({
  plan,
  onChanged,
}: {
  plan: LoopPlan;
  onChanged: () => Promise<void>;
}) {
  const [editing, setEditing] = React.useState<SegmentStats | null>(null);
  const [open, setOpen] = React.useState(false);

  const openEdit = (s: SegmentStats | null) => {
    setEditing(s);
    setOpen(true);
  };

  return (
    <Panel
      labelledBy="fundraise-segments"
      eyebrow="Segments"
      title="Where the next batch goes"
      description={
        <p>
          Next batch: {num(plan.batchSize)} prospects. Allocation only shifts between segments once
          a segment has enough matured contacts (people old enough to have had time to reply), so
          early noise can&rsquo;t cut a slow segment. Pausing a segment is always your choice
          &mdash; the loop only recommends.
        </p>
      }
      action={
        <Button type="button" size="sm" variant="outline" onClick={() => openEdit(null)}>
          <Plus aria-hidden />
          Add segment
        </Button>
      }
    >
      {plan.segments.length === 0 ? (
        <p className="app-small p-5 text-[var(--app-text-muted)]">
          No segments yet. Add one to give the loop somewhere to look.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[180px]">Segment</TableHead>
                <TableHead className="text-right">Contacted / universe</TableHead>
                <TableHead className="text-right">Matured</TableHead>
                <TableHead className="text-right">Replies</TableHead>
                <TableHead className="text-right">Meetings</TableHead>
                <TableHead className="text-right">
                  <abbr title="Posterior mean meeting rate" className="no-underline">
                    Est. rate
                  </abbr>
                </TableHead>
                <TableHead className="text-right">
                  <abbr title="Probability this segment is the best" className="no-underline">
                    P(best)
                  </abbr>
                </TableHead>
                <TableHead className="text-right">Next batch</TableHead>
                <TableHead className="text-right">Weeks left</TableHead>
                <TableHead>Recommendation</TableHead>
                <TableHead>
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {plan.segments.map((s) => (
                <TableRow key={s.key} className={cn(s.status === 'PAUSED' && 'opacity-70')}>
                  <TableCell className="align-top">
                    <div className="flex flex-col gap-1">
                      <span className="font-medium text-[var(--app-text)]">{s.label}</span>
                      <span className="flex flex-wrap items-center gap-1.5">
                        <Badge
                          variant={s.status === 'ACTIVE' ? 'secondary' : 'outline'}
                          className="text-[10px] uppercase tracking-wide"
                        >
                          {s.status === 'ACTIVE' ? 'Active' : 'Paused'}
                        </Badge>
                        <span className="app-caption font-mono text-[var(--app-text-muted)]">
                          {s.key}
                        </span>
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right align-top tabular-nums">
                    <div>
                      {num(s.contacted)} / {num(s.estUniverse)}
                    </div>
                    <div className="app-caption text-[var(--app-text-muted)]">
                      {pct(s.burnPct)} used
                    </div>
                  </TableCell>
                  <TableCell className="text-right align-top tabular-nums">
                    {num(s.maturedTrials)}
                  </TableCell>
                  <TableCell className="text-right align-top tabular-nums">
                    {num(s.replies)}
                  </TableCell>
                  <TableCell className="text-right align-top tabular-nums">
                    {num(s.meetings)}
                  </TableCell>
                  <TableCell className="text-right align-top tabular-nums">
                    {pct(s.posteriorMean)}
                  </TableCell>
                  <TableCell className="text-right align-top tabular-nums">
                    {pct(s.probBest)}
                  </TableCell>
                  <TableCell className="text-right align-top font-semibold tabular-nums">
                    {num(s.allocation)}
                  </TableCell>
                  <TableCell className="text-right align-top tabular-nums">
                    {weeksLeft(s.weeksOfMarketLeft)}
                  </TableCell>
                  <TableCell className="align-top">
                    <RecommendationBadge value={s.recommendation} />
                  </TableCell>
                  <TableCell className="align-top">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => openEdit(s)}
                      aria-label={`Edit segment ${s.label}`}
                    >
                      <Pencil aria-hidden />
                      <span className="hidden sm:inline">Edit</span>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <SegmentDialog open={open} onOpenChange={setOpen} segment={editing} onSaved={onChanged} />
    </Panel>
  );
}
