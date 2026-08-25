// @polsia:user-owned — Mission evidence list.
'use client';

import type { MissionDetailT } from '@/lib/contracts/forge';

export function MissionEvidenceList({ detail }: { detail: MissionDetailT }) {
  if (detail.evidence.length === 0) {
    return (
      <div className="glass-card rounded-2xl p-6 text-body text-muted-foreground">
        No evidence has been attached yet.
      </div>
    );
  }
  return (
    <ul className="grid gap-3 md:grid-cols-2">
      {detail.evidence.map((e) => (
        <li key={e.id} className="glass-card lift-soft rounded-2xl p-5">
          <p className="text-caption uppercase tracking-wide text-brand-700">{e.kind}</p>
          <p className="text-h4">{e.label}</p>
          <p className="mt-1 break-all text-small">
            <a className="link-brand" href={e.ref} target="_blank" rel="noreferrer">
              {e.ref}
            </a>
          </p>
          <p className="mt-2 text-small text-muted-foreground">
            Captured {new Date(e.capturedAt).toLocaleString()} by{' '}
            <code>{e.capturedById.slice(-6)}</code>
          </p>
        </li>
      ))}
    </ul>
  );
}
