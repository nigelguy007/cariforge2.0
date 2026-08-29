// @polsia:user-owned — /approvals (UX review C3, wireframe v2 screen 2e):
// the unified inbox for every human decision — mission gate approvals and
// paused canvas runs in one queue. /forge/approvals now redirects here so
// there is exactly one place an approver has to check.

import type { Metadata } from 'next';
import { UnifiedApprovals } from '@/components/custom/approvals/unified-approvals';

export const metadata: Metadata = {
  title: 'Approvals',
  description:
    'One inbox for every human decision: mission gate approvals and paused workflow runs, each requiring a typed reason.',
};

export default function ApprovalsPage() {
  return (
    <section className="container-page py-section">
      <header className="glass-panel rounded-2xl p-6">
        <p className="text-eyebrow text-brand-700">Human decisions</p>
        <h1 className="text-h1 text-foreground">Approvals</h1>
        <p className="mt-2 text-body text-muted-foreground">
          Every decision the platform is waiting on a human for — gate approvals on missions and
          paused workflow runs — in one queue. Each decision requires a typed reason and lands in
          the exportable evidence trail.
        </p>
      </header>
      <div className="mt-8">
        <UnifiedApprovals />
      </div>
    </section>
  );
}
