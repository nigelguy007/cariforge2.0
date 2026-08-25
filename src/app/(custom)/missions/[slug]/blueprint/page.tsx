// @polsia:user-owned — Blueprint page (Server Component shell).
import type { Metadata } from 'next';
import { MissionBlueprintClient } from '@/components/custom/missions/mission-blueprint-client';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  return {
    title: `Blueprint · ${slug}`,
    description: `Reusable blueprint for mission ${slug} on the CARI Forge control plane.`,
  };
}

export default async function MissionBlueprintPage({ params }: PageProps) {
  const { slug } = await params;
  return (
    <section className="container-page py-section">
      <MissionBlueprintClient missionSlug={slug} />
    </section>
  );
}
