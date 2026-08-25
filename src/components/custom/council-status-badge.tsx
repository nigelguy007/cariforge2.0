// @polsia:user-owned — Council run status badge. Maps a CouncilRun.status
// (+ optional verdict + the lead's notified bit) onto a <Badge/> with a
// human label. Kept as its own client island so the table stays scannable.

'use client';

import { CheckCircle2, CircleDashed, CircleSlash, Clock, XCircle } from 'lucide-react';
import type * as React from 'react';
import { Badge } from '@/components/ui/badge';
import type { LeadListItem, RunStatus, Verdict } from '@/lib/contracts/leads';
import { cn } from '@/lib/utils';

interface CouncilStatusBadgeProps {
  status: LeadListItem['councilRunStatus'];
  verdict: LeadListItem['councilRunVerdict'];
  notified: boolean;
}

// Variant + icon + label set per RunStatus. Verdict (when present) is appended.
const VARIANTS: Record<
  RunStatus,
  {
    variant: 'default' | 'secondary' | 'destructive' | 'outline';
    label: string;
    Icon: React.ComponentType<{ 'aria-hidden'?: boolean; className?: string }>;
  }
> = {
  Pending: { variant: 'outline', label: 'Pending', Icon: CircleDashed },
  Running: { variant: 'secondary', label: 'Running', Icon: Clock },
  Succeeded: { variant: 'default', label: 'Succeeded', Icon: CheckCircle2 },
  Failed: { variant: 'destructive', label: 'Failed', Icon: XCircle },
  WalkedAway: { variant: 'outline', label: 'Walked away', Icon: CircleSlash },
};

export function CouncilStatusBadge({ status, verdict, notified }: CouncilStatusBadgeProps) {
  if (!status) {
    return (
      <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
        {notified ? 'Awaiting kick' : 'Intake only'}
      </Badge>
    );
  }
  const cfg = VARIANTS[status];
  const ver = verdict ? ` · ${verdict}` : '';
  const Icon = cfg.Icon;
  return (
    <Badge
      variant={cfg.variant}
      className={cn('inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wide')}
    >
      <Icon aria-hidden className="size-3" />
      {cfg.label}
      {ver ? (
        <span className="ml-0.5 font-mono normal-case opacity-90">{verdict as Verdict}</span>
      ) : null}
    </Badge>
  );
}
