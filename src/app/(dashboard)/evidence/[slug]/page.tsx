// @polsia:user-owned — one project's evidence record (Server Component
// shell).
import type { Metadata } from 'next';
import { EvidenceRecord } from '@/components/custom/app/evidence-record';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  return {
    title: `Evidence — ${slug}`,
    description: `The evidence record for project ${slug} on CariForge.`,
  };
}

export default async function EvidenceRecordPage({ params }: PageProps) {
  const { slug } = await params;
  return <EvidenceRecord missionSlug={slug} />;
}
