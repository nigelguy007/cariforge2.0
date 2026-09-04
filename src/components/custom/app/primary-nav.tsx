// @polsia:user-owned — the app's only global navigation: Projects,
// Approvals (with a count only when something needs the user), Evidence.
// Desktop: a 220px left column. Mobile: a three-item bottom bar. Everything
// else (admin, profile, sign out, the visual canvas) lives in AppShell's
// avatar menu or is reached contextually from a project.

'use client';

import { CheckSquare, FolderKanban, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { PRIMARY_NAV, type PrimaryNavItem } from '@/lib/app-routes';
import { cn } from '@/lib/utils';
import { useApprovalsCount } from './use-approvals-count';

const ICONS: Record<PrimaryNavItem['href'], typeof FolderKanban> = {
  '/missions': FolderKanban,
  '/approvals': CheckSquare,
  '/evidence': ShieldCheck,
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
        variant === 'bottom' && 'grid grid-cols-3',
      )}
    >
      {PRIMARY_NAV.map((item) => {
        const Icon = ICONS[item.href];
        const active = isActive(pathname, item.href);
        const showCount = item.href === '/approvals' && approvals.total > 0;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'app-transition flex min-h-11 items-center gap-2 rounded-[var(--app-radius-sm)] px-3 text-[length:var(--app-body)] font-medium',
              variant === 'bottom' &&
                'flex-col justify-center gap-0.5 rounded-none py-1.5 text-[length:var(--app-caption)]',
              active
                ? 'bg-[var(--app-accent-soft)] text-[var(--app-text)]'
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
