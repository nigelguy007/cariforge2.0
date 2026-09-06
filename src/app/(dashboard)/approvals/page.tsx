// @polsia:user-owned — /approvals (brief, Step 5): one queue of everything
// waiting on the signed-in person — projects at an approval step and paused
// workflow runs. The heading is the count in words ("Two approvals need
// you"); the empty state says so plainly. /forge/approvals redirects here.

import type { Metadata } from 'next';
import { ApprovalsQueue } from '@/components/custom/app/approvals-queue';

export const metadata: Metadata = {
  title: 'Approvals',
  description:
    'Every decision waiting on you — projects at an approval step and paused workflow runs — in one list. Each decision is recorded with your name and a note.',
};

export default function ApprovalsPage() {
  return (
    <div className="app-content">
      <ApprovalsQueue />
    </div>
  );
}
