// @polsia:user-owned — GET/POST /api/forge/missions/:id/release.

import 'server-only';
import { NextResponse } from 'next/server';
import { type ZodError, z } from 'zod';
import { forgeErrorResponse, requireForgeAuth } from '@/lib/business/forge/api-helpers';
import { deriveReleaseStatus } from '@/lib/business/forge/release';
import { recordReleaseSourceOnPostRelease } from '@/lib/business/forge/release-source';
import { getReleaseReadout, recordRelease } from '@/lib/business/forge/service';
import { ReleaseRead } from '@/lib/contracts/forge';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

function fieldErrorBody(error: ZodError): { errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  for (const [field, messages] of Object.entries(error.flatten().fieldErrors)) {
    const message = messages?.[0];
    if (message) errors[field] = message;
  }
  return { errors };
}

const ReleaseRecord = z.object({
  summary: z.string().trim().max(2000).optional(),
});

// Helper to derive ReleaseRead payload from a MissionDetail.
function toRelease(detail: Awaited<ReturnType<typeof getReleaseReadout>>) {
  const lastApproval = detail.approvals[0] ?? null;
  const lastExecuted = detail.toolActions.find((t) => t.executedAt !== null) ?? null;
  const status = deriveReleaseStatus({
    status: detail.mission.status,
    completedAt: detail.mission.completedAt,
    releaseReadoutAt: detail.mission.releaseReadoutAt ?? null,
    lastApproval,
  });
  let summary = `${status} — ${detail.mission.name}`;
  if (status === 'BuildApprovedNotReleased') {
    summary += ' (build approved, release readout not yet recorded)';
  } else if (status === 'Released') {
    summary += ' (release readout recorded)';
  } else if (status === 'RolledBack') {
    summary += ' (rolled back — see audit trail for the rollback reason code)';
  } else if (status === 'Paused') {
    summary += ' (paused — resume to continue)';
  } else if (status === 'WalkedAway') {
    summary += ' (closed without release)';
  } else if (status === 'Blocked') {
    summary += ' (blocked — see outstanding objections)';
  } else {
    summary += ' (work in progress)';
  }
  return {
    releaseStatus: status,
    releaseReadoutAt: detail.mission.releaseReadoutAt ?? null,
    completedAt: detail.mission.completedAt ?? null,
    lastApproval,
    lastToolActionExecutedAt: lastExecuted?.executedAt ?? null,
    summary,
  };
}

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireForgeAuth(req);
  if (auth instanceof Response) return auth;
  const { id } = await ctx.params;
  try {
    const detail = await getReleaseReadout({
      missionId: id,
      userId: auth.user.id,
      isAdmin: auth.isAdmin,
    });
    return NextResponse.json(ReleaseRead.parse(toRelease(detail)), { status: 200 });
  } catch (err) {
    return forgeErrorResponse(err);
  }
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireForgeAuth(req);
  if (auth instanceof Response) return auth;
  const { id } = await ctx.params;
  const parsed = ReleaseRecord.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(fieldErrorBody(parsed.error), { status: 400 });
  }
  try {
    const detail = await recordRelease({
      missionId: id,
      userId: auth.user.id,
      isAdmin: auth.isAdmin,
      summary: parsed.data.summary,
    });
    // Telemetry side-effect: stamp the mission's ReleaseSource. Idempotent
    // (upsert on missionId @unique), tolerant of failure (logs + continues)
    // — never alters the visible contract of POST /release. Gated by the
    // FORGE_TELEMETRY_ENABLED env var (default ON for this slice).
    if (process.env.FORGE_TELEMETRY_ENABLED !== 'false') {
      void (async () => {
        try {
          const [approvals, handoffs] = await Promise.all([
            prisma.approval.findMany({ where: { missionId: id } }),
            prisma.stageHandoff.findMany({ where: { missionId: id } }),
          ]);
          const approvalIds = approvals.map((a) => a.id);
          const tags =
            approvalIds.length === 0
              ? []
              : await prisma.approvalActorTag.findMany({
                  where: { approvalId: { in: approvalIds } },
                });
          const tagsByApproval = new Map<string, { actorKind: string }[]>();
          for (const t of tags) {
            const arr = tagsByApproval.get(t.approvalId) ?? [];
            arr.push({ actorKind: t.actorKind });
            tagsByApproval.set(t.approvalId, arr);
          }
          await recordReleaseSourceOnPostRelease({
            missionId: id,
            missionCreatedById: detail.mission.createdById,
            decidedById: auth.user.id,
            reasonText: parsed.data.summary ?? undefined,
            releaserIsHuman: true,
            handoffsForAge: handoffs.map((h) => ({
              createdAt: h.createdAt,
              supersededById: h.supersededById,
            })),
            approvalsWithActorTags: approvals.map((a) => ({
              decision: a.decision as 'Approve' | 'Return' | 'Refuse',
              id: a.id,
            })),
            actorTagsByApproval: tagsByApproval,
          });
        } catch (_err) {}
      })();
    }
    return NextResponse.json(ReleaseRead.parse(toRelease(detail)), { status: 200 });
  } catch (err) {
    return forgeErrorResponse(err);
  }
}
