// @polsia:user-owned — GET /api/forge/missions/:id/deliverables. Real user
// report (2026-09-06): a completed mission's generated files and technical
// spec existed in the database all along, but no UI ever rendered them.
// This route is the read path: the active SoftwareBuild handoff's payload
// (files + spec), plus the "MVP to Production" roadmap (generated once,
// then cached — see business/forge/deliverables.ts). Returns 404 if the
// mission hasn't reached/cleared Software Build yet — a real, honest
// state, not an error.
import 'server-only';
import { NextResponse } from 'next/server';
import { forgeErrorResponse, requireForgeAuth } from '@/lib/business/forge/api-helpers';
import {
  getOrCreateProductionRoadmap,
  readSoftwareBuildPayload,
} from '@/lib/business/forge/deliverables';
import { getMissionDetail } from '@/lib/business/forge/service';
import { MissionDeliverables } from '@/lib/contracts/forge';

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireForgeAuth(req);
  if (auth instanceof Response) return auth;
  const { id } = await ctx.params;
  try {
    const detail = await getMissionDetail(id, auth.user.id, auth.isAdmin);
    if (!detail) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const handoff = detail.handoffs.find(
      (h) => h.stage === 'SoftwareBuild' && h.supersededById === null,
    );
    const spec = handoff ? readSoftwareBuildPayload(handoff.payload) : null;
    if (!spec) {
      return NextResponse.json(
        { error: 'This project has not produced a Software Build output yet.' },
        { status: 404 },
      );
    }

    const roadmap = await getOrCreateProductionRoadmap(id, spec);

    const body = MissionDeliverables.parse({
      missionId: id,
      summary: spec.summary,
      techStack: spec.techStack,
      architectureOverview: spec.architectureOverview,
      dataModel: spec.dataModel,
      apiSurface: spec.apiSurface,
      deploymentNotes: spec.deploymentNotes,
      files: spec.files,
      roadmap,
    });
    return NextResponse.json(body);
  } catch (err) {
    return forgeErrorResponse(err);
  }
}
