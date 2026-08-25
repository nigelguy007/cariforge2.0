// @polsia:user-owned — Mission detail page (Server Component shell).
import type { Metadata } from 'next';
import { MissionAutonomyCard } from '@/components/custom/forge-telemetry/mission-autonomy-card';
import { MissionCostCard } from '@/components/custom/forge-telemetry/mission-cost-card';
import { MissionDetail } from '@/components/custom/missions/mission-detail';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  return {
    title: `Mission ${slug}`,
    description: `Detail page for mission ${slug} — Mission Control on the CARI Forge control plane.`,
  };
}

export default async function MissionDetailPage({ params }: PageProps) {
  const { slug } = await params;
  return (
    <section className="container-page py-section">
      <MissionDetail missionSlug={slug} />
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <MissionAutonomyCard missionSlug={slug} />
        <MissionCostCard missionSlug={slug} />
      </div>
    </section>
  );
}
