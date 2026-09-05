// @polsia:user-owned — the app's only global navigation: Home, Projects,
// Templates, Settings (nav restructure, 2026-09-05). Home carries a count
// badge — the same "something needs the user" signal Approvals used to show
// here — since Approvals itself is reached from Home's own Needs-you section
// rather than being a persistent nav item. Desktop: a 220px left column.
// Mobile: a four-item bottom bar. Everything else (admin, profile, sign out,
// the visual canvas) lives in AppShell's avatar menu or is reached
// contextually from a project.

'use client';

import { FolderKanban, Home, LayoutTemplate, Settings } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { PRIMARY_NAV, type PrimaryNavItem } from '@/lib/app-routes';
import { cn } from '@/lib/utils';
import { useApprovalsCount } from './use-approvals-count';

const ICONS: Record<PrimaryNavItem['href'], typeof FolderKanban> = {
  '/home': Home,
  '/missions': FolderKanban,
  '/templates': LayoutTemplate,
  '/settings': Settings,
};

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function PrimaryNav({ variant }: { variant: 'sidebar' | 'bottom' }) {
  const pathname = usePathname();
  const approvals = useApprovalsCount();

  return (
    <nav
      aria-label="Main"
      className={cn(
        variant === 'sidebar' && 'flex flex-col gap-1',
        variant === 'bottom' && 'grid grid-cols-4',
      )}
    >
      {PRIMARY_NAV.map((item) => {
        const Icon = ICONS[item.href];
        const active = isActive(pathname, item.href);
        const showCount = item.href === '/home' && approvals.total > 0;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              // Glowing active-state (design synthesis, 2026-09-05 —
              // credo.ai/product + layer.ai as references): a persistent
              // transparent border-l on every item, coloured only when
              // active, so toggling active state never shifts layout —
              // plus a soft accent glow, the same "glowing nav" treatment
              // pulled from that pass. Bottom bar uses border-t instead
              // (a left edge means nothing in a horizontal bar).
              'app-transition flex min-h-11 items-center gap-2 rounded-[var(--app-radius-sm)] border-l-2 border-transparent px-3 text-[length:var(--app-body)] font-medium',
              variant === 'bottom' &&
                'flex-col justify-center gap-0.5 rounded-none border-t-2 border-l-0 py-1.5 text-[length:var(--app-caption)]',
              active
                ? 'border-[var(--app-accent)] bg-[var(--app-accent-soft)] text-[var(--app-text)] shadow-[0_0_16px_-6px_var(--app-accent-border)]'
                : 'text-[var(--app-text-muted)] hover:bg-[var(--secondary)] hover:text-[var(--app-text)]',
            )}
          >
            <Icon aria-hidden="true" className="size-4 shrink-0" />
            <span className="flex items-center gap-1.5">
              {item.label}
              {showCount ? (
                <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-[var(--app-accent)] px-1.5 text-[length:var(--app-caption)] font-semibold leading-5 text-white">
                  {approvals.total}
                  <span className="sr-only"> waiting</span>
                </span>
              ) : null}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
