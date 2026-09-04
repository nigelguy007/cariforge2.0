// @polsia:user-owned — Project workspace page (Server Component shell).
import type { Metadata } from 'next';
import { ProjectWorkspace } from '@/components/custom/app/project-workspace';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  return {
    title: `Project ${slug}`,
    description: `Workspace for project ${slug} on CariForge.`,
  };
}

export default async function MissionDetailPage({ params }: PageProps) {
  const { slug } = await params;
  return <ProjectWorkspace missionSlug={slug} />;
}
