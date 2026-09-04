// @polsia:user-owned — which URL prefixes belong to the signed-in
// application (rendered inside AppShell with its own three-item PrimaryNav)
// versus the public marketing site (rendered with SiteNav/SiteFooter).
// Read by site-nav.tsx so the marketing chrome steps aside on app routes,
// and by the redirects that retire old app URLs.

export const APP_ROUTE_PREFIXES = [
  '/missions',
  '/approvals',
  '/evidence',
  '/forge',
  '/dashboard',
  '/admin',
  '/profile',
] as const;

export function isAppRoute(pathname: string): boolean {
  return APP_ROUTE_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export interface PrimaryNavItem {
  readonly href: '/missions' | '/approvals' | '/evidence';
  readonly label: string;
}

/** The only three global destinations in the app (brief, Step 3). */
export const PRIMARY_NAV: readonly PrimaryNavItem[] = [
  { href: '/missions', label: 'Projects' },
  { href: '/approvals', label: 'Approvals' },
  { href: '/evidence', label: 'Evidence' },
];
