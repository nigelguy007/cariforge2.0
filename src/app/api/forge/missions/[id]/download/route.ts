// @polsia:user-owned — GET /api/forge/missions/:id/download. Real user
// request (2026-09-06): "create a download button where the files, spec
// and everything else produced can be downloaded from the platform. make
// sure the download remainds when the person logs in and out and
// comeback." This route builds the .zip fresh from data already persisted
// in Postgres (StageHandoff.payload + the cached MissionDeliverable
// roadmap) on every request — there is no browser-side state to lose, so
// the download is available again any time this URL is hit, by design,
// not because anything was specifically "remembered".
import 'server-only';
import { NextResponse } from 'next/server';
import { forgeErrorResponse, requireForgeAuth } from '@/lib/business/forge/api-helpers';
import {
  buildDeliverablesZip,
  getOrCreateProductionRoadmap,
  readSoftwareBuildPayload,
} from '@/lib/business/forge/deliverables';
import { getMissionDetail } from '@/lib/business/forge/service';

// The roadmap may need one AI call (~60s worst case) on the very first
// download for a mission — see deliverables.ts's own comment. Subsequent
// downloads hit the cached row and finish almost instantly.
export const maxDuration = 90;

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
    const zipBuffer = await buildDeliverablesZip(id, detail.mission.name, spec, roadmap);

    return new NextResponse(new Uint8Array(zipBuffer), {
      status: 200,
      headers: {
        'content-type': 'application/zip',
        'content-disposition': `attachment; filename="${detail.mission.slug}.zip"`,
        'content-length': String(zipBuffer.byteLength),
      },
    });
  } catch (err) {
    return forgeErrorResponse(err);
  }
}
