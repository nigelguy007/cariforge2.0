// @polsia:user-owned — Audit timeline display.
'use client';

import type { MissionAuditItemT } from '@/lib/contracts/forge';

export function MissionAuditTimeline({ audits }: { audits: MissionAuditItemT[] }) {
  if (audits.length === 0) {
    return (
      <div className="glass-card rounded-2xl p-6 text-body text-muted-foreground">
        No audit events yet.
      </div>
    );
  }
  return (
    <ol className="space-y-2">
      {audits.map((a) => (
        <li key={a.id} className="glass-card rounded-xl p-4">
          <p className="text-caption text-muted-foreground">{new Date(a.at).toLocaleString()}</p>
          <p className="text-h4">{a.event}</p>
          <p className="text-small text-muted-foreground">
            Actor: <code>{a.actorId ? a.actorId.slice(-6) : 'system'}</code> · v
            {a.missionVersionAtEvent}
          </p>
          <pre className="mt-2 overflow-x-auto rounded-lg bg-muted/60 p-2 text-caption">
            {JSON.stringify(a.payload, null, 2).slice(0, 500)}
          </pre>
        </li>
      ))}
    </ol>
  );
}
