// @polsia:user-owned — Settings (nav restructure, 2026-09-05). See
// settings-view.tsx for the actual content; this file only owns the route's
// metadata (a Server Component can't sit inside the same 'use client' file
// as the useIsAdmin hook SettingsView needs).
import type { Metadata } from 'next';
import { SettingsView } from '@/components/custom/app/settings-view';

export const metadata: Metadata = {
  title: 'Settings',
  description: 'Your account, and the admin tools if you administer this workspace.',
};

export default function SettingsPage() {
  return (
    <div className="app-content space-y-5">
      <header>
        <h1 className="app-h1 text-[var(--app-text)]">Settings</h1>
        <p className="app-body mt-1 max-w-prose text-[var(--app-text-muted)]">
          Your account, and the admin tools if you administer this workspace.
        </p>
      </header>
      <SettingsView />
    </div>
  );
}
