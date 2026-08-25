// @polsia:user-owned — /admin/testimonials. Server Component that gates the
// page itself (requireAdminOnPage() redirects unauthenticated visitors to
// /login and signed-in non-admin visitors back to /) and renders the
// <AdminTestimonialsTable/> client island, which fetches via apiFetch +
// AdminTestimonialList contract. `robots: noindex` keeps the page out of
// search engines — the moderation queue is owner-only.

import type { Metadata } from 'next';
import { AdminTestimonialsTable } from '@/components/custom/admin-testimonials-table';
import { requireAdminOnPage } from '@/lib/admin-page-guard';

export const metadata: Metadata = {
  title: 'Testimonials',
  description: 'Approve, unpublish, or reject the buyer narratives on /testimonials.',
  robots: { index: false, follow: false },
};

export default async function AdminTestimonialsPage() {
  await requireAdminOnPage();

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">Admin</p>
        <h1 className="font-display text-2xl tracking-tight text-foreground">Testimonials</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Every quote submitted to the moderation queue, newest entry first. Flip the Published
          switch to send a quote to the public{' '}
          <span className="font-mono text-foreground">/testimonials</span> page; flip it back to
          take it down. The page renders only rows where Published is on.
        </p>
      </header>
      <AdminTestimonialsTable />
    </div>
  );
}
