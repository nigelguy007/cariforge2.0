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
// show "Log in" to signed-out visitors and "Sign out" to signed-in ones.
//
// Real user testing feedback (2026-09-04): "when I'm logged in there's no
// log out of the system" + "on the homepage there is a log in at the bottom
// but don't see it at the top, all I see is submit a brief." Two separate
// bugs, both real: (1) this header never offered a sign-out action at all —
// signed in, it only ever linked to /dashboard, which does have a sign-out
// button in DashboardShell, but that's a second hop, not "no log out"; (2)
// cosmoq-home.css hid .cq-header-link below 620px, so on a phone this
// secondary action disappeared completely and only "Submit a brief"
// remained. Fixed here (sign out added) and in cosmoq-home.css (mobile
// hide rule removed).

'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { BrandMark } from '@/components/custom/brand-mark';
import { signOut, useSession } from '@/lib/auth-client';

const NAV_ITEMS = [
  { label: 'How it works', href: '/how-it-works' },
  { label: 'Council', href: '/how-it-works#council' },
  { label: 'Oracles', href: '/pilot/oracle-council' },
  { label: 'Pricing', href: '/pricing' },
] as const;

export function CqHeader() {
  const { data: session, isPending } = useSession();
  const router = useRouter();
  const isAuthenticated = !isPending && Boolean(session?.user);

  async function handleSignOut() {
    await signOut();
    router.replace('/');
    router.refresh();
  }

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
          <button type="button" onClick={handleSignOut} className="cq-header-link cq-header-btn">
            Sign out
          </button>
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

// Same fix, footer instance: the footer's "Governance" column had a
// hardcoded `<Link href="/login">Log in</Link>` — always showed "Log in"
// even when already signed in, with no sign-out path from the footer either.
export function CqFooterAuthLink() {
  const { data: session, isPending } = useSession();
  const router = useRouter();
  const isAuthenticated = !isPending && Boolean(session?.user);

  async function handleSignOut() {
    await signOut();
    router.replace('/');
    router.refresh();
  }

  if (isAuthenticated) {
    return (
      <button type="button" onClick={handleSignOut} className="cq-footer-link-btn">
        Sign out
      </button>
    );
  }
  return <Link href="/login">Log in</Link>;
}
