// @polsia:user-owned — which URL prefixes belong to the signed-in
// application (rendered inside AppShell with its own four-item PrimaryNav)
// versus the public marketing site (rendered with SiteNav/SiteFooter).
// Read by site-nav.tsx so the marketing chrome steps aside on app routes,
// and by the redirects that retire old app URLs.

export const APP_ROUTE_PREFIXES = [
  '/home',
  '/missions',
  '/approvals',
  '/evidence',
  '/forge',
  '/dashboard',
  '/admin',
  '/profile',
  '/templates',
  '/settings',
] as const;

export function isAppRoute(pathname: string): boolean {
  return APP_ROUTE_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export interface PrimaryNavItem {
  readonly href: '/home' | '/missions' | '/templates' | '/settings';
  readonly label: string;
}

// Nav restructure (2026-09-05, Kore.ai-Artemis comparison brief): four global
// destinations, not three. Approvals and Evidence stay real, working routes —
// just no longer persistent nav items. Approvals is reached from Home's
// Needs-you section (and from a project's own next action); Evidence from a
// project's own Supporting Detail. "Evidence" itself keeps its route/data-model
// name — only a visible nav LABEL for it would say "Proof" (ui-terms.ts's own
// translate-for-display convention).
export const PRIMARY_NAV: readonly PrimaryNavItem[] = [
  { href: '/home', label: 'Home' },
  { href: '/missions', label: 'Projects' },
  { href: '/templates', label: 'Templates' },
  { href: '/settings', label: 'Settings' },
];
