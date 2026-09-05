// @polsia:user-owned — Templates (nav restructure, 2026-09-05). No template
// feature exists in this codebase yet — this is an honest placeholder, not
// fabricated example data, with a clear path to the thing that does exist
// today: describing a need in your own words on /missions/new.
import type { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = {
  title: 'Templates',
  description: 'Pre-configured starting points for common Caribbean business needs — coming soon.',
};

export default function TemplatesPage() {
  return (
    <div className="app-content space-y-5">
      <header>
        <h1 className="app-h1 text-[var(--app-text)]">Templates</h1>
        <p className="app-body mt-1 max-w-prose text-[var(--app-text-muted)]">
          Pre-configured starting points for common Caribbean business needs — coming soon.
        </p>
      </header>
      <div className="app-panel p-6">
        <p className="app-body text-[var(--app-text-muted)]">
          There are no templates yet. For now, describe your need in your own words and CariForge
          will draft the right project from scratch.
        </p>
        <Button asChild className="mt-4 min-h-11">
          <Link href="/missions/new">Start a project</Link>
        </Button>
      </div>
    </div>
  );
}
