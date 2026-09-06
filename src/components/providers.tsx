// @polsia:user-owned — the agent OWNS this file (edit freely).
//
// App-wide client Context providers go here. AppProviders is rendered by the root
// layout as an ancestor of the nav, page, footer and global mounts, so a Context
// added here reaches every client component (nav, hero, CTAs, modals, forms).
// Put a provider HERE — never scoped to a single leaf like a modal, or consumers
// elsewhere throw "useX must be used within YProvider" during server render.
//
// Example:
//   'use client';
//   import { AuthProvider } from '@/lib/auth-context';
//   export function AppProviders({ children }: { children: React.ReactNode }) {
//     return <AuthProvider>{children}</AuthProvider>;
//   }
//
// Default is a transparent pass-through — safe to leave as-is.
//
// DefaultToDarkOnFirstVisit: explicit request (2026-08-29) to match
// 21st.dev's "Remark" template reference, which is dark-only — the
// reference has no light presentation to compare against, so the site's
// first impression needs to be dark too. layout.tsx's
// defaultTheme="system" and theme-provider.tsx are both framework-owned
// (edit-gated), so this seam is the correct place to override the
// starting theme without touching either: on mount, if next-themes has no
// stored preference yet (first visit, or `theme` was never explicitly
// set), switch to dark. A visitor who has already chosen light is never
// touched — this only steers the *default*, not an existing choice. Same
// pattern this file hosted once before, removed only because both themes
// were, at the time, equally well-designed — that's not the ask here.

'use client';

import { useTheme } from 'next-themes';
import * as React from 'react';

function DefaultToDarkOnFirstVisit() {
  const { theme, setTheme } = useTheme();
  React.useEffect(() => {
    if (theme === 'system') setTheme('dark');
    // Empty deps: only ever run once, on mount — this steers the
    // unset-preference default, not something to re-apply on every
    // theme value change (which would fight a visitor's own toggle).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <>
      <DefaultToDarkOnFirstVisit />
      {children}
    </>
  );
}
