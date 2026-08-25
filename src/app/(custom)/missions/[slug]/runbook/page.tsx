// @polsia:user-owned — Runbook page (Server Component shell).
import type { Metadata } from 'next';
import { MissionRunbookClient } from '@/components/custom/missions/mission-runbook-client';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  return {
    title: `Runbook · ${slug}`,
    description: `Runbook for mission ${slug} on the CARI Forge control plane.`,
  };
}

export default async function MissionRunbookPage({ params }: PageProps) {
  const { slug } = await params;
  return (
    <section className="container-page py-section">
      <MissionRunbookClient missionSlug={slug} />
    </section>
  );
}
