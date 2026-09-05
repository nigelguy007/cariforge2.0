// @polsia:user-owned — the one signed-in chrome (brief, Step 3 + 7).
//
// Replaces DashboardShell: a slim top bar (brand + avatar menu), a 220px
// PrimaryNav column on desktop, a three-item bottom bar on mobile, and an
// 860px content column. Admin, profile, the visual canvas and sign-out are
// under the avatar — never in the primary nav. Signed-out visitors are
// redirected to /login exactly as before.

'use client';

import { ChevronDown } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { BrandMark } from '@/components/custom/brand-mark';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { signOut, useSession } from '@/lib/auth-client';
import { PrimaryNav } from './primary-nav';

export interface AppShellProps {
  children: React.ReactNode;
}

function hasRole(role: string | null | undefined, expected: string) {
  return (
    role
      ?.split(',')
      .map((item) => item.trim())
      .includes(expected) ?? false
  );
}

function initials(name: string | null | undefined, email: string | null | undefined) {
  const source = (name ?? email ?? '').trim();
  if (!source) return '?';
  const parts = source.split(/[\s@._-]+/).filter(Boolean);
  return parts
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}

export function AppShell({ children }: AppShellProps) {
  const { data: session, isPending } = useSession();
  const router = useRouter();
  const isAdmin = hasRole(session?.user?.role, 'admin');

  React.useEffect(() => {
    if (!isPending && !session?.user) {
      router.replace('/login');
    }
  }, [isPending, router, session?.user]);

  async function handleSignOut() {
    await signOut();
    router.replace('/login');
  }

  if (isPending || !session?.user) {
    return (
      <main className="app-shell dark flex min-h-dvh items-center justify-center px-6">
        <div className="app-halo" aria-hidden="true">
        <div className="app-halo-rays" />
      </div>
        <p className="app-small text-[var(--app-text-muted)]" aria-live="polite">
          {isPending ? 'Loading…' : 'Redirecting to sign in…'}
        </p>
      </main>
    );
  }

  const user = session.user;
  const displayName = user.name?.trim() || user.email || 'Account';

  return (
    <div className="app-shell dark min-h-dvh">
      <div className="app-halo" aria-hidden="true">
        <div className="app-halo-rays" />
      </div>
      <a
        href="#app-main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-md focus:bg-[var(--app-surface)] focus:px-3 focus:py-2"
      >
        Skip to content
      </a>
      <header className="sticky top-0 z-30 border-b border-[var(--app-border)] bg-[var(--app-surface)]">
        <div className="mx-auto flex h-14 w-full max-w-[1200px] items-center justify-between gap-3 px-4 sm:px-6">
          <Link href="/missions" className="flex min-w-0 items-center gap-2">
            <BrandMark size={26} />
            <span className="truncate font-semibold text-[var(--app-text)]">CariForge</span>
          </Link>
          <div className="flex items-center gap-1">
            <DropdownMenu>
              <DropdownMenuTrigger
                className="app-transition flex min-h-11 items-center gap-2 rounded-[var(--app-radius-sm)] px-2 hover:bg-[var(--secondary)]"
                aria-label="Account menu"
              >
                <Avatar className="size-8">
                  {user.image ? <AvatarImage src={user.image} alt="" /> : null}
                  <AvatarFallback className="bg-[var(--app-accent-soft)] text-[length:var(--app-caption)] font-semibold text-[var(--app-text)]">
                    {initials(user.name, user.email)}
                  </AvatarFallback>
                </Avatar>
                <ChevronDown aria-hidden="true" className="size-4 text-[var(--app-text-muted)]" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-56">
                <DropdownMenuLabel className="font-normal">
                  <span className="block truncate font-medium text-[var(--app-text)]">
                    {displayName}
                  </span>
                  <span className="block truncate text-[length:var(--app-caption)] text-[var(--app-text-muted)]">
                    {isAdmin ? 'Administrator' : 'Member'}
                  </span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/profile">Profile</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/dashboard/pipeline">How the steps work</Link>
                </DropdownMenuItem>
                {isAdmin ? (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel className="text-[length:var(--app-caption)] text-[var(--app-text-muted)]">
                      Admin
                    </DropdownMenuLabel>
                    <DropdownMenuItem asChild>
                      <Link href="/admin/leads">Briefs received</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/admin/missions">All projects</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/admin/telemetry">Usage</Link>
                    </DropdownMenuItem>
                  </>
                ) : null}
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => void handleSignOut()}>Sign out</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-[1200px] gap-6 px-4 pb-24 pt-6 sm:px-6 lg:pb-10">
        <aside className="hidden w-[var(--app-nav-w)] shrink-0 lg:block">
          <div className="sticky top-20">
            <PrimaryNav variant="sidebar" />
          </div>
        </aside>
        <main id="app-main" className="app-content min-w-0 flex-1">
          {children}
        </main>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--app-border)] bg-[var(--app-surface)] pb-[env(safe-area-inset-bottom)] lg:hidden">
        <PrimaryNav variant="bottom" />
      </div>
    </div>
  );
}
