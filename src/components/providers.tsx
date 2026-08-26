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
// Currently hosts DefaultToDarkOnFirstVisit (below) — everything else is a
// transparent pass-through.

'use client';

import { useTheme } from 'next-themes';
import { useEffect } from 'react';

/* layout.tsx's <ThemeProvider> is @polsia:framework-owned (defaultTheme="system"),
   so it can't be edited directly to make dark mode the site's default — see
   AGENTS.md "Customizing the shell". This is the sanctioned workaround: a
   user-owned seam, mounted inside that same ThemeProvider, that forces dark
   on first visit only. "First visit" = next-themes hasn't persisted an
   explicit choice yet (its default localStorage key is "theme") — once a
   visitor has one, explicitly or via the toggle, this never overrides it
   again. Exists specifically for the site's new deep-ocean identity: with
   plain defaultTheme="system", anyone whose OS resolves to light mode would
   land on the lighter variant first and could easily read that as "nothing
   changed," even though the light variant was also retinted. */
function DefaultToDarkOnFirstVisit() {
  const { theme, setTheme } = useTheme();
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.localStorage.getItem('theme')) return; // explicit choice already made
    if (theme !== 'dark') setTheme('dark');
    // `theme` deliberately in deps (not []): the first render can see `theme`
    // as undefined before next-themes resolves it, so this re-checks once
    // resolution happens. Safe against loops — once setTheme('dark') runs,
    // next-themes persists "dark" to localStorage, so the re-run's own
    // getItem('theme') check above returns early.
  }, [theme, setTheme]);
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
