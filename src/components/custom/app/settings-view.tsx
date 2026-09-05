// @polsia:user-owned — Settings landing (nav restructure, 2026-09-05): links
// out to whichever account/admin surfaces already exist (Profile, and the
// admin pages when the signed-in user is one) rather than duplicating their
// content. No fabricated toggles — if a real settings page doesn't exist
// yet, it isn't listed here.

'use client';

import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { useIsAdmin } from '@/lib/auth-client';

interface SettingsLink {
  readonly href: string;
  readonly title: string;
  readonly hint: string;
}

const ADMIN_LINKS: readonly SettingsLink[] = [
  { href: '/admin/leads', title: 'Briefs received', hint: 'Public briefs waiting to become a project.' },
  { href: '/admin/missions', title: 'All projects', hint: 'Every project across every user.' },
  { href: '/admin/telemetry', title: 'Usage', hint: 'Platform usage and activity.' },
];

function SettingsRow({ link }: { link: SettingsLink }) {
  return (
    <li>
      <Link
        href={link.href}
        className="app-transition flex min-h-14 items-center justify-between gap-4 px-4 py-3 hover:bg-[var(--app-accent-soft)] focus-visible:bg-[var(--app-accent-soft)]"
      >
        <div className="min-w-0">
          <p className="app-body font-medium text-[var(--app-text)]">{link.title}</p>
          <p className="app-small text-[var(--app-text-muted)]">{link.hint}</p>
        </div>
        <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-[var(--app-text-muted)]" />
      </Link>
    </li>
  );
}

export function SettingsView() {
  const isAdmin = useIsAdmin();
  return (
    <ul className="app-panel divide-y divide-[var(--app-border)]">
      <SettingsRow link={{ href: '/profile', title: 'Profile', hint: 'Your name, email and sign-out.' }} />
      {isAdmin
        ? ADMIN_LINKS.map((link) => <SettingsRow key={link.href} link={link} />)
        : null}
    </ul>
  );
}
