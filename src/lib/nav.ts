// @polsia:user-owned — app navigation rendered by SiteNav/SiteFooter and read by
// the sitemap. Edit it as pages are added or removed.
// This list is a convenience, not module registration.

export type NavGroup = 'primary' | 'secondary' | 'footer';

export interface NavItem {
  /** Visible link text. */
  label: string;
  /** App route, e.g. '/' or '/dashboard'. */
  href: string;
  /** Where it renders: top-nav 'primary'/'secondary', or 'footer'. */
  group: NavGroup;
  /** Group `primary` items into a dropdown: items sharing a `menu` value collapse
   *  into one "<menu> ⌄" top-bar slot (e.g. `menu: 'Resources'` on Blog/Docs/
   *  Changelog). Keeps the bar short. Ignored for 'secondary'/'footer'. */
  menu?: string;
  /** When true, render only if a session exists (see site-nav.tsx). */
  requiresAuth?: boolean;
  /** Sort key within a group (ascending); unordered items fall to the end. */
  order?: number;
}

// Keep the bar short: ~3-5 primary slots, group the tail with `menu`, push the
// rest to 'footer' (SiteNav overflows extras into a "More" dropdown).
export const navItems: NavItem[] = [
  // The / homepage is a single fixed-viewport hero (see
  // src/app/(setup)/page.tsx) — these anchors live on /how-it-works now,
  // where the Oracles/Agents/Stages sections + the real brief-intake form
  // moved to.
  { label: 'How it works', href: '/how-it-works', group: 'primary', order: 0 },
  { label: 'Council', href: '/how-it-works#council', group: 'primary', order: 1 },
  { label: 'Stages', href: '/how-it-works#stages', group: 'primary', order: 2 },
  { label: 'Oracles', href: '/pilot/oracle-council', group: 'primary', order: 3 },
  { label: 'FAQ', href: '/faq', group: 'primary', order: 4 },
  { label: 'Blog', href: '/blog', group: 'primary', order: 5 },
  // Mission Control — signed-in users see this; the page itself enforces auth.
  { label: 'Missions', href: '/missions', group: 'primary', requiresAuth: true, order: 5 },
  // Admin-only — visible when signed in; the page itself gates with role === 'admin'
  // server-side, so a non-admin who reaches the link is redirected to /. Grouped
  // under `menu: 'Admin'` so the top bar stays short (SiteNav collapses these
  // into one "Admin ⌄" slot). Public visitors never see this group (gated by
  // requiresAuth).
  {
    label: 'Leads',
    href: '/admin/leads',
    group: 'primary',
    requiresAuth: true,
    menu: 'Admin',
    order: 6,
  },
  {
    label: 'Admin missions',
    href: '/admin/missions',
    group: 'primary',
    requiresAuth: true,
    menu: 'Admin',
    order: 7,
  },
  {
    label: 'Telemetry',
    href: '/admin/telemetry',
    group: 'primary',
    requiresAuth: true,
    menu: 'Admin',
    order: 8,
  },
  { label: 'Compare', href: '/compare', group: 'footer', order: 0 },
  { label: 'Pricing', href: '/pricing', group: 'footer', order: 1 },
  { label: 'Testimonials', href: '/testimonials', group: 'footer', order: 2 },
  {
    label: 'How the council works',
    href: '/how-the-council-works',
    group: 'footer',
    order: 3,
  },
  {
    label: 'Why this is a scaffold',
    href: '/why-this-is-a-scaffold',
    group: 'footer',
    order: 4,
  },
  { label: 'Blog', href: '/blog', group: 'footer', order: 5 },
  {
    label: 'Sample brief',
    href: '/sample-brief',
    group: 'footer',
    order: 6,
  },
  {
    label: 'Request a walkthrough',
    href: '/request-walkthrough',
    group: 'footer',
    order: 7,
  },
  { label: 'Mission control', href: '/missions', group: 'footer', order: 8 },
  { label: 'Pilot intro', href: '/pilot-intro', group: 'footer', order: 9 },
  {
    label: 'Submit a brief',
    href: '/how-it-works#front-door',
    group: 'secondary',
    order: 0,
  },
];
