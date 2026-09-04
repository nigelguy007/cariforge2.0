// @polsia:user-owned
'use client';

import { BookOpenText, LayoutDashboard, ListChecks } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

// R2 (mission pipeline rebuild): Missions now lives in this same nav as
// Overview — the dashboard shell used to have exactly one item and never
// linked to /missions at all. Both routes share this one DashboardShell.
//
// "Pipeline detail" added 2026-09-04: the only nav entry point to
// /dashboard/pipeline, the new home for the stage/architecture/agent-
// boundary detail moved off the public /how-it-works page (real user
// feedback: "this is giving away the app functionality to everyone").
// Without a nav link this page would only be reachable by URL.
const navItems = [
  {
    href: '/dashboard',
    label: 'Overview',
    icon: LayoutDashboard,
  },
  {
    href: '/missions',
    label: 'Missions',
    icon: ListChecks,
  },
  {
    href: '/dashboard/pipeline',
    label: 'Pipeline detail',
    icon: BookOpenText,
  },
];

export function DashboardNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Dashboard"
      className="flex gap-2 overflow-x-auto pb-1 lg:grid lg:overflow-visible lg:pb-0"
    >
      {navItems.map((item) => {
        const Icon = item.icon;
        const active =
          pathname === item.href || (item.href === '/missions' && pathname.startsWith('/missions'));

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex h-10 shrink-0 items-center gap-2 rounded-md px-3 text-sm font-medium transition-colors',
              active
                ? 'bg-secondary text-secondary-foreground'
                : 'text-muted-foreground hover:bg-secondary/70 hover:text-foreground',
            )}
          >
            <Icon aria-hidden="true" className="size-4" />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
