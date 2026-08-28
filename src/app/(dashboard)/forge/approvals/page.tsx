// @polsia:user-owned — /forge/approvals: the Approval Desk.
'use client';

import { ApprovalDesk } from '@/components/custom/forge-canvas/approval-desk';
import { ParallaxAurora } from '@/components/custom/forge-canvas/parallax-aurora';

export default function ApprovalDeskPage() {
  return (
    <>
      <ParallaxAurora />
      <div className="space-y-4">
        <header>
          <p className="text-caption uppercase tracking-wide text-brand-700">Approval Desk</p>
          <h1 className="text-h2 text-foreground">Decisions waiting on a human</h1>
          <p className="text-small text-muted-foreground">
            Every paused run shows its evidence here. Approve or reject with a typed reason — the
            run resumes or stops accordingly, and the decision is recorded in the trace.
          </p>
        </header>
        <ApprovalDesk />
      </div>
    </>
  );
}
