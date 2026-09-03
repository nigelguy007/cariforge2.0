// @polsia:user-owned — header + floating pill nav for the / homepage.
//
// Client component for one reason only: the session check below. The rest of
// this header is static. It replaces vesper-header.tsx, whose mobile burger
// menu (open/close state, body-scroll lock, Escape handler, resize listener,
// backdrop button) is deliberately NOT carried over — the reference's nav is
// a centred pill that simply doesn't render on narrow viewports, and every
// destination in it is also reachable from the page footer, so dropping the
// drawer removes a focus-trap surface without making anything unreachable.
//
// Same auth seam as site-nav.tsx: this page opts out of the global SiteNav
// (see the `pathname === '/'` check there), so it needs its own check to
// show "Log in" to signed-out visitors and "Dashboard" to signed-in ones.

'use client';

import Link from 'next/link';
import { useSession } from '@/lib/auth-client';

const NAV_ITEMS = [
  { label: 'How it works', href: '/how-it-works' },
  { label: 'Council', href: '/how-it-works#council' },
  { label: 'Oracles', href: '/pilot/oracle-council' },
  { label: 'Pricing', href: '/pricing' },
] as const;

function LogoMark() {
  // The real CARI Forge mark (anvil + spark — src/app/icon.svg), rendered
  // monochrome inside the gradient tile rather than as its usual
  // teal-on-white version, so the header carries the same aquamarine ->
  // indigo gradient as the rest of the page.
  return (
    <span className="cq-logo-mark">
      <svg width="18" height="18" viewBox="0 0 32 32" fill="none" aria-hidden="true">
        <rect x="6" y="22" width="20" height="3" rx="0.5" fill="currentColor" />
        <rect x="11.5" y="17" width="9" height="5" fill="currentColor" />
        <path
          d="M7 14 H22 a3 3 0 0 1 0 3 H21 L19 14 H10 a2.5 2.5 0 0 0 -3 2.5 z"
          fill="currentColor"
        />
        <path d="M16 4 v8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M11 7 l4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        <path d="M21 7 l-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    </span>
  );
}

export function CqHeader() {
  const { data: session, isPending } = useSession();
  const isAuthenticated = !isPending && Boolean(session?.user);

  return (
    <header className="cq-header">
      <Link href="/" aria-label="CARI Forge" className="cq-logo">
        <LogoMark />
        <span>CARI Forge</span>
      </Link>

      <nav id="site-nav" aria-label="Primary" className="cq-nav">
        {NAV_ITEMS.map((item) => (
          <Link key={item.href} href={item.href} className="cq-nav-link">
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="cq-header-end">
        {isAuthenticated ? (
          <Link href="/dashboard" className="cq-header-link">
            Dashboard
          </Link>
        ) : (
          <Link href="/login" className="cq-header-link">
            Log in
          </Link>
        )}
        <Link href="/how-it-works#front-door" className="cq-btn cq-btn-primary cq-btn-sm">
          Submit a brief
        </Link>
      </div>
    </header>
  );
}
