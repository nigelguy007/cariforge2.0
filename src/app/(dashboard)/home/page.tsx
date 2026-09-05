// @polsia:user-owned — Home (nav restructure, 2026-09-05): the new default
// landing page after sign-in. See home-view.tsx for the actual content;
// this file only owns the route's metadata (a Server Component can't sit
// inside the same 'use client' file as the hooks HomeView needs).
import type { Metadata } from 'next';
import { HomeView } from '@/components/custom/app/home-view';

export const metadata: Metadata = {
  title: 'Home',
  description: 'Start a new project, or pick up one you already have.',
};

export default function HomePage() {
  return (
    <div className="app-content">
      <HomeView />
    </div>
  );
}
