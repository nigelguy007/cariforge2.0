// @polsia:user-owned — /admin/fundraise. Server Component that only gates the
// page (redirects unauthenticated / non-admin visitors at request time) and
// renders the static header. All data lives in the <FundraiseDashboard/>
// client island, which fetches /api/admin/fundraise via apiFetch and parses
// it against the shared LoopSummary contract. `robots: noindex` keeps the
// page out of search engines.

import type { Metadata } from 'next';
import { FundraiseDashboard } from '@/components/custom/fundraise/fundraise-dashboard';
import { requireAdminOnPage } from '@/lib/admin-page-guard';

export const metadata: Metadata = {
  title: 'Fundraise loop',
  description:
    'CariForge investor outreach loop — approve batches, watch which segments book meetings, and log outcomes.',
  robots: { index: false, follow: false },
};

export default async function AdminFundraisePage() {
  await requireAdminOnPage();

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">Admin</p>
        <h1 className="font-display text-2xl tracking-tight text-foreground">Fundraise loop</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Find, approve, send, measure, re-aim. Nothing is sent unless you approve the batch{' '}
          <span className="font-semibold text-foreground">and</span> sending is switched on. Warm
          paths never get a cold message.
        </p>
      </header>
      <FundraiseDashboard />
    </div>
  );
}
