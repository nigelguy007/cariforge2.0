// @polsia:user-owned — the single custom React Flow node view for every
// Forge Canvas node type. One component, styled by type, per the repo's
// restrained light-first system (.impeccable.md: brand colour as accent,
// not wash; status never conveyed by colour alone — each card carries its
// type name and any validation issue as text).

'use client';

import { Handle, type NodeProps, Position } from '@xyflow/react';
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  CircleDot,
  GitBranch,
  Globe,
  Route,
  Square,
  UserCheck,
} from 'lucide-react';
import type { CanvasNodeType } from '@/lib/contracts/forge-canvas';
import { cn } from '@/lib/utils';

export interface ForgeNodeData extends Record<string, unknown> {
  label: string;
  nodeType: CanvasNodeType;
  subtitle?: string;
  issue?: string;
  runStatus?: string; // set on the trace view: Succeeded | Failed | AwaitingApproval | Approved | Rejected
}

const TYPE_META: Record<CanvasNodeType, { title: string; icon: typeof Bot; accent: string }> = {
  start: { title: 'Start', icon: CircleDot, accent: 'text-emerald-700' },
  agent: { title: 'Agent', icon: Bot, accent: 'text-brand-700' },
  condition: { title: 'Condition', icon: GitBranch, accent: 'text-amber-700' },
  approval: { title: 'Human approval', icon: UserCheck, accent: 'text-purple-700' },
  end: { title: 'End', icon: Square, accent: 'text-slate-600' },
  conductor: { title: 'Conductor', icon: Route, accent: 'text-cyan-700' },
  http: { title: 'HTTP (dry run)', icon: Globe, accent: 'text-slate-500' },
};

export function ForgeCanvasNode({ data, selected }: NodeProps & { data: ForgeNodeData }) {
  const meta = TYPE_META[data.nodeType];
  const Icon = meta.icon;
  return (
    <div
      className={cn(
        'w-56 rounded-xl border bg-card px-4 py-3 shadow-sm transition-shadow',
        selected ? 'border-brand-400 shadow-md' : 'border-border',
        data.issue && 'border-destructive',
      )}
    >
      {data.nodeType !== 'start' && (
        <Handle type="target" position={Position.Left} className="!size-2.5 !bg-brand-400" />
      )}
      <div className="flex items-center gap-2">
        <Icon className={cn('size-4 shrink-0', meta.accent)} aria-hidden="true" />
        <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          {meta.title}
        </span>
        {data.runStatus ? (
          <span className="ml-auto inline-flex items-center gap-1 text-[10px] font-medium text-muted-foreground">
            {data.runStatus === 'Succeeded' || data.runStatus === 'Approved' ? (
              <CheckCircle2 className="size-3 text-emerald-600" aria-hidden="true" />
            ) : (
              <AlertTriangle className="size-3 text-amber-600" aria-hidden="true" />
            )}
            {data.runStatus}
          </span>
        ) : null}
      </div>
      <p className="mt-1 truncate text-sm font-medium text-foreground">{data.label}</p>
      {data.subtitle ? (
        <p className="truncate text-xs text-muted-foreground">{data.subtitle}</p>
      ) : null}
      {data.issue ? <p className="mt-1 text-xs text-destructive">{data.issue}</p> : null}

      {data.nodeType === 'condition' ? (
        <>
          <Handle
            id="true"
            type="source"
            position={Position.Right}
            style={{ top: '35%' }}
            className="!size-2.5 !bg-emerald-500"
          />
          <Handle
            id="false"
            type="source"
            position={Position.Right}
            style={{ top: '70%' }}
            className="!size-2.5 !bg-rose-500"
          />
          <div className="pointer-events-none absolute -right-9 top-[24%] text-[10px] font-medium text-emerald-700">
            True
          </div>
          <div className="pointer-events-none absolute -right-9 top-[60%] text-[10px] font-medium text-rose-700">
            False
          </div>
        </>
      ) : data.nodeType !== 'end' ? (
        <Handle type="source" position={Position.Right} className="!size-2.5 !bg-brand-400" />
      ) : null}
    </div>
  );
}
