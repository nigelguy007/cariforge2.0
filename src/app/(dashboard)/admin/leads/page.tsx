// @polsia:user-owned — /admin/leads. Server Component that gates the page
// itself (redirects unauthenticated / non-admin visitors at request time).
// The page is purely a composition layer — no data fetch, no inner-await. The
// client island <AdminLeadsTable/> fetches via /api/admin/leads on mount, and
// both route handler + island parse against the shared LeadList contract so
// the response shape can't drift. `robots: noindex` keeps the page out of
// search engines.

import type { Metadata } from 'next';
import { AdminLeadsTable } from '@/components/custom/admin-leads-table';
import { requireAdminOnPage } from '@/lib/admin-page-guard';

export const metadata: Metadata = {
  title: 'Leads',
  description:
    'Every lead captured on cariforge.com — front-door briefs, blog newsletter signups, and procurement-grade walkthrough requests.',
  robots: { index: false, follow: false },
};

export default async function AdminLeadsPage() {
  await requireAdminOnPage();

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">Admin</p>
        <h1 className="font-display text-2xl tracking-tight text-foreground">Leads</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Every lead captured on cariforge.com, newest first: front-door briefs, blog newsletter
          signups (tagged &ldquo;Newsletter&rdquo;), and procurement-grade walkthrough requests.
          Click <span className="font-semibold text-foreground">Export CSV</span> to download the
          full set — the downloaded file has the same rows you see here.
        </p>
      </header>
      <AdminLeadsTable />
    </div>
  );
}
