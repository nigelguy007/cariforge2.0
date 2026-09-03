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
import { BrandMark } from '@/components/custom/brand-mark';
import { useSession } from '@/lib/auth-client';

const NAV_ITEMS = [
  { label: 'How it works', href: '/how-it-works' },
  { label: 'Council', href: '/how-it-works#council' },
  { label: 'Oracles', href: '/pilot/oracle-council' },
  { label: 'Pricing', href: '/pricing' },
] as const;

export function CqHeader() {
  const { data: session, isPending } = useSession();
  const isAuthenticated = !isPending && Boolean(session?.user);

  return (
    <header className="cq-header">
      <Link href="/" aria-label="CARI Forge" className="cq-logo">
        <BrandMark size={26} className="shrink-0 rounded-md" />
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
