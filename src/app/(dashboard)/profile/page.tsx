// @polsia:user-owned — /profile: account details + sign out. Moved into the
// (dashboard) route group (2026-09-05) from (auth), where it sat alongside
// /login and /signup as a fully standalone page — its own full-page
// background, no header, no nav — so every link into it (Settings, the
// account-menu dropdown, the marketing header's auth-nav) was a dead end
// with no way back except the browser's own Back button. Real user report:
// "when you go to this page you cant go back". Wrapped in AppShell like
// every other /(dashboard) route (see layout.tsx) so the persistent header/
// nav is always there to leave from. The URL is unchanged — route groups
// don't affect it — so nothing linking to /profile needed to change.
'use client';

import { Button } from '@/components/ui/button';
import { signOut, useSession } from '@/lib/auth-client';

export default function ProfilePage() {
  const { data: session, isPending } = useSession();

  if (isPending) {
    return <p className="app-small text-[var(--app-text-muted)]">Loading…</p>;
  }
  // AppShell itself redirects to /login once it knows there's no session —
  // this only ever renders for a moment before that happens.
  if (!session?.user) {
    return null;
  }

  const { user } = session;
  const initial =
    user.name?.trim()?.charAt(0)?.toUpperCase() || user.email?.charAt(0)?.toUpperCase() || '?';

  async function handleSignOut() {
    await signOut();
    window.location.assign('/login');
  }

  return (
    <div className="app-content space-y-5">
      <header>
        <h1 className="app-h1 text-[var(--app-text)]">Profile</h1>
        <p className="app-body mt-1 text-[var(--app-text-muted)]">Your account details.</p>
      </header>

      <div className="app-panel space-y-6 p-5 sm:p-6">
        <div className="flex items-center gap-4">
          <div
            aria-hidden="true"
            className="flex size-14 shrink-0 items-center justify-center rounded-full bg-[var(--app-accent-soft)] text-[length:var(--app-h3)] font-semibold text-[var(--app-text)]"
          >
            {initial}
          </div>
          <div className="min-w-0">
            <p className="app-body truncate font-medium text-[var(--app-text)]">
              {user.name || 'Account'}
            </p>
            <p className="app-small truncate text-[var(--app-text-muted)]">{user.email}</p>
          </div>
        </div>

        <dl className="divide-y divide-[var(--app-border)] border-t border-[var(--app-border)]">
          <div className="flex items-center justify-between py-3">
            <dt className="app-small text-[var(--app-text-muted)]">Name</dt>
            <dd className="app-small font-medium text-[var(--app-text)]">{user.name || '—'}</dd>
          </div>
          <div className="flex items-center justify-between py-3">
            <dt className="app-small text-[var(--app-text-muted)]">Email</dt>
            <dd className="app-small font-medium text-[var(--app-text)]">{user.email}</dd>
          </div>
        </dl>

        <div className="flex justify-end">
          <Button type="button" variant="secondary" onClick={() => void handleSignOut()}>
            Sign out
          </Button>
        </div>
      </div>
    </div>
  );
}
