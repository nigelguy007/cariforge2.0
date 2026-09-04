// @polsia:user-owned — Replay deep-link page.
import type { Metadata } from 'next';
import Link from 'next/link';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  return {
    title: `Replay · Mission ${slug}`,
    description: `Targeted replay for mission ${slug}.`,
  };
}

export default async function MissionReplayPage({ params }: PageProps) {
  const { slug } = await params;
  return (
    <section className="app-content py-section">
      <header className="app-panel p-6">
        <p className="app-caption text-[var(--app-text-muted)]">Run again</p>
        <h1 className="app-h1 mt-1 text-[var(--app-text)]">Run this project again from a step</h1>
        <p className="app-body mt-2 text-[var(--app-text-muted)]">
          Running again from a step replaces its output and anything built on it. The project
          returns to that step and stays there until a new step output and decisions restore
          progress.
        </p>
      </header>
      <div className="mt-8">
        <Link
          className="app-link app-small inline-flex min-h-11 items-center"
          href={`/missions/${slug}#supporting-detail-controls`}
        >
          Open the project and run it again from a step
        </Link>
      </div>
    </section>
  );
}
