// @polsia:user-owned — Mission evidence list.
'use client';

import { CheckCircle2 } from 'lucide-react';
import type { MissionDetailT } from '@/lib/contracts/forge';
import { humanise } from '@/lib/ui-terms';

export function MissionEvidenceList({ detail }: { detail: MissionDetailT }) {
  if (detail.evidence.length === 0) {
    return (
      <div className="glass-card rounded-2xl p-6 text-body text-muted-foreground">
        No evidence has been attached yet.
      </div>
    );
  }
  return (
    <ul className="flex flex-wrap gap-2">
      {detail.evidence.map((e) => (
        <li
          key={e.id}
          className="glass-chip flex min-w-0 max-w-full flex-col gap-1 rounded-2xl px-3 py-2 sm:max-w-xs"
        >
          <div className="flex min-w-0 items-center gap-1.5">
            <CheckCircle2 className="size-4 shrink-0 text-emerald-600" aria-hidden="true" />
            <span className="truncate text-small font-semibold" title={e.label}>
              {e.label}
            </span>
            <span className="ml-auto shrink-0 rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-brand-700">
              {humanise(e.kind)}
            </span>
          </div>
          <a
            className="link-brand truncate text-caption"
            href={e.ref}
            target="_blank"
            rel="noreferrer"
            title={e.ref}
          >
            {e.ref}
          </a>
          <p className="text-caption text-muted-foreground">
            Captured {new Date(e.capturedAt).toLocaleString()}
          </p>
        </li>
      ))}
    </ul>
  );
}
