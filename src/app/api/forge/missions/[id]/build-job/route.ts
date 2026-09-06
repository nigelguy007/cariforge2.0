// @polsia:user-owned — POST /api/forge/missions/:id/build-job. Advances
// (creating if needed) the SoftwareBuild stage's async generation job by
// exactly one bounded step and returns its new state — see
// business/forge/build-job.ts's own header for the full "why" (this
// project's Vercel Hobby plan caps a function at 60s; a real MVP's
// generation genuinely needs ~150s, so it's chunked across repeated short
// polls instead of one long synchronous call the old /draft endpoint made
// for this one stage). The client (next-action-card.tsx) calls this in a
// loop until status is 'Done' or 'Failed'.
//
// Reuses draft-context.ts's resolveDraftContext for the exact same
// governance guards the synchronous /draft route enforces (which gate is
// actually next, whether it already has a handoff) — this route is ONLY
// ever the right thing to call when that resolves to the SoftwareBuild
// gate; anything else is a 409, same as /draft would give.
import 'server-only';
import { NextResponse } from 'next/server';
import { forgeErrorResponse, requireForgeAuth } from '@/lib/business/forge/api-helpers';
import { advanceSoftwareBuildJob } from '@/lib/business/forge/build-job';
import { resolveDraftContext } from '@/lib/business/forge/draft-context';
import { getMissionDetail } from '@/lib/business/forge/service';

export const dynamic = 'force-dynamic';
// Explicit, not left to the framework default: this route's own AI call
// can now run up to 90s (see build-job.ts's generateFileContent comment
// on why 45s wasn't enough) plus the Prisma write after it. 120s leaves
// real headroom under the ~300s ceiling this project has already hit
// live once before (see ai-draft.ts's getClient() comment).
export const maxDuration = 120;

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireForgeAuth(req);
  if (auth instanceof Response) return auth;
  const { id } = await ctx.params;
  try {
    const detail = await getMissionDetail(id, auth.user.id, auth.isAdmin);
    if (!detail) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const ctxResult = resolveDraftContext(detail);
    if (!ctxResult.ok) {
      return NextResponse.json({ error: ctxResult.error }, { status: ctxResult.status });
    }
    if (ctxResult.stage !== 'SoftwareBuild') {
      // A caller pointed this endpoint at the wrong stage — same shape of
      // guard as /draft's "already has a draft" 409s, just a different
      // cause. The client only ever calls this route once it already
      // knows the next gate is SoftwareBuild (see next-action-card.tsx),
      // so this is a defensive floor, not an expected path.
      return NextResponse.json(
        { error: 'This endpoint only advances the SoftwareBuild stage.' },
        { status: 409 },
      );
    }

    const need = detail.mission.normalizedNeed.trim() || detail.mission.intake.trim();
    const result = await advanceSoftwareBuildJob({
      missionId: id,
      userId: auth.user.id,
      isAdmin: auth.isAdmin,
      ownerUserId: ctxResult.ownerUserId,
      need,
      priorContext: ctxResult.priorContext,
      feedback: ctxResult.feedback,
      evidence: ctxResult.evidence,
    });

    if (result.status === 'Failed') {
      return NextResponse.json({ status: 'Failed', error: result.error }, { status: 503 });
    }
    return NextResponse.json(result, { status: result.status === 'Done' ? 201 : 200 });
  } catch (err) {
    return forgeErrorResponse(err);
  }
}
