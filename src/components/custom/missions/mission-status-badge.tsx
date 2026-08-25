// @polsia:user-owned — Mission status badge.
'use client';

import type { MissionStatus } from '@/lib/contracts/forge';
import { cn } from '@/lib/utils';

interface MissionStatusBadgeProps {
  status: MissionStatus;
  className?: string;
}

const STATUS_STYLES: Record<MissionStatus, string> = {
  Draft: 'glass-chip text-muted-foreground',
  InDiscovery: 'bg-brand-500/15 text-brand-800 ring-1 ring-brand-500/30',
  InReadiness: 'bg-brand-500/15 text-brand-800 ring-1 ring-brand-500/30',
  InWorkflow: 'bg-brand-500/15 text-brand-800 ring-1 ring-brand-500/30',
  InGovernance: 'bg-brand-500/15 text-brand-800 ring-1 ring-brand-500/30',
  InBuild: 'bg-brand-500/15 text-brand-800 ring-1 ring-brand-500/30',
  AwaitingApproval: 'bg-amber-500/15 text-amber-800 ring-1 ring-amber-500/30',
  Paused: 'bg-slate-500/15 text-slate-700 ring-1 ring-slate-500/30',
  Blocked: 'bg-rose-500/15 text-rose-800 ring-1 ring-rose-500/30',
  Rejected: 'bg-rose-500/20 text-rose-900 ring-1 ring-rose-500/40',
  Completed: 'bg-emerald-500/15 text-emerald-800 ring-1 ring-emerald-500/30',
  WalkedAway: 'bg-slate-500/15 text-slate-700 ring-1 ring-slate-500/30',
  RolledBack: 'bg-rose-500/15 text-rose-800 ring-1 ring-rose-500/30',
};

const STATUS_LABEL: Record<MissionStatus, string> = {
  Draft: 'Draft',
  InDiscovery: 'In Discovery',
  InReadiness: 'In Readiness',
  InWorkflow: 'In Workflow',
  InGovernance: 'In Governance',
  InBuild: 'In Build',
  AwaitingApproval: 'Awaiting approval',
  Paused: 'Paused',
  Blocked: 'Blocked',
  Rejected: 'Rejected',
  Completed: 'Completed',
  WalkedAway: 'Walked away',
  RolledBack: 'Rolled back',
};

export function MissionStatusBadge({ status, className }: MissionStatusBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-caption font-medium uppercase tracking-wide',
        STATUS_STYLES[status] ?? STATUS_STYLES.Draft,
        className,
      )}
    >
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}
