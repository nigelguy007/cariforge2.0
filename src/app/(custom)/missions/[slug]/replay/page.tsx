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
    <section className="container-page py-section">
      <header className="glass-panel rounded-2xl p-6">
        <p className="text-eyebrow text-brand-700">Targeted replay</p>
        <h1 className="text-h1 text-foreground">Replay a stage</h1>
        <p className="mt-2 text-body text-muted-foreground">
          Replay from a stage to invalidate downstream handoffs via the typed replay reason code.
          The mission knocks back to the replayed stage and stays there until the new handoff +
          decisions restore progress.
        </p>
      </header>
      <div className="mt-8">
        <Link className="link-brand" href={`/missions/${slug}#handoffs`}>
          Open Mission detail and use the replay control →
        </Link>
      </div>
    </section>
  );
}
