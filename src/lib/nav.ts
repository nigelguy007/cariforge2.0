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
  /** When true, render only if NO session exists — for Log in / Sign up,
   * so a signed-in user doesn't see a prompt to sign in again. */
  hideWhenAuth?: boolean;
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
  // Nav-discipline pass (2026-09-03, rebuild-brief review): public primary
  // was 6 slots (How it works, Council, Stages, Oracles, FAQ, Blog) against
  // a target of "no more than 5" — real, worth fixing, and fixable without
  // moving a single URL. Council/Stages were never separate PAGES, just
  // anchors on /how-it-works itself (#council, #stages) — a visitor already
  // on that page can scroll to them; they don't need their own top-bar
  // slot. Removed from primary here, but the anchors and the sections they
  // point at are untouched, so nothing that used to work stops working —
  // only the top-bar entry point is gone.
  { label: 'How it works', href: '/how-it-works', group: 'primary', order: 0 },
  { label: 'Oracles', href: '/pilot/oracle-council', group: 'primary', order: 3 },
  { label: 'FAQ', href: '/faq', group: 'primary', order: 4 },
  // Blog demoted out of primary (footer entry below is unaffected): verified
  // 2026-09-03 the page has zero real articles (0 matches for a `title:`
  // entry in its own source) — it is a newsletter-signup shell describing
  // future editor notes, not existing content. Publishing it as a top-bar
  // destination overpromises; the brief's "remove until 3+ real articles
  // exist" holds here. The route/page itself is untouched — a direct visit
  // or the footer link still reaches it.
  // Signed-in users see this; the page itself enforces auth. Labelled
  // "Projects" to match the simplified workspace's own nav and copy
  // (redesign brief, Step 2/3) — the route and page are unchanged.
  { label: 'Projects', href: '/missions', group: 'primary', requiresAuth: true, order: 5 },
  // Promoted out of the 'Forge' dropdown and given the lowest order (sorts
  // first for a signed-in user, ahead of the marketing links) — 2026-09-01
  // user report: the visual builder existed but nobody found it, buried one
  // click inside a "Forge ⌄" menu. This is meant to be the primary,
  // immediately-reachable action once signed in, not a submenu entry.
  {
    label: 'Build',
    href: '/forge',
    group: 'primary',
    requiresAuth: true,
    order: -1,
  },
  // UX review C3 (wireframe v2): one unified Approvals inbox — gate
  // decisions + run pauses. /forge/approvals redirects here.
  {
    label: 'Approvals',
    href: '/approvals',
    group: 'primary',
    requiresAuth: true,
    menu: 'Forge',
    order: 6,
  },
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
  { label: 'Projects', href: '/missions', group: 'footer', order: 8 },
  { label: 'Pilot intro', href: '/pilot-intro', group: 'footer', order: 9 },
  {
    label: 'Submit a brief',
    href: '/how-it-works#front-door',
    group: 'secondary',
    order: 0,
  },
  // Root cause of a real, user-reported bug: there was no discoverable path
  // from the public site to the signed-in product at all — /missions only
  // appears once a session already exists (requiresAuth above), and no
  // secondary nav item pointed at /login or /signup, so a visitor had no
  // way to find either short of already knowing the URL. hideWhenAuth so a
  // signed-in user doesn't see a prompt to log in again.
  { label: 'Log in', href: '/login', group: 'secondary', hideWhenAuth: true, order: 1 },
  { label: 'Sign up', href: '/signup', group: 'secondary', hideWhenAuth: true, order: 2 },
];
