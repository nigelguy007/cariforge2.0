// @polsia:user-owned — /missions/[slug]/office: the live "Office" view
// (Phase 1 of the Agent Command Centre handoff, scoped to the real
// 5-agent pipeline — see mission-office-view.tsx's own header comment).

import { MissionOfficeView } from '@/components/custom/missions/mission-office-view';

export default async function MissionOfficePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <MissionOfficeView missionSlug={slug} />;
}
