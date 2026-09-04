// @polsia:user-owned — Projects list page (Server Component shell). The URL
// stays /missions so nothing bookmarked breaks; the page reads "Projects".
import type { Metadata } from 'next';
import Link from 'next/link';
import { ProjectList } from '@/components/custom/app/project-list';
import { BriefConversionCard } from '@/components/custom/dashboard/brief-conversion-card';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = {
  title: 'Projects',
  description: 'Your projects, each moving through five approved steps.',
};

export default function MissionsIndexPage() {
  return (
    <div className="app-content space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="app-h1 text-[var(--app-text)]">Projects</h1>
          <p className="app-body mt-1 text-[var(--app-text-muted)]">
            Each project moves through five steps. You approve every one.
          </p>
        </div>
        <Button asChild className="min-h-11">
          <Link href="/missions/new">Start a project</Link>
        </Button>
      </header>
      <BriefConversionCard />
      <ProjectList showEmptyCta={false} />
    </div>
  );
}
