// @polsia:user-owned — POST /api/forge/missions/[id]/telemetry/release-source.
// Explicit re-stamp of the mission's ReleaseSource row. Idempotent on
// missionId @unique. Owner-scoped (admin can re-stamp any mission).
import 'server-only';
import { NextResponse } from 'next/server';
import type { z } from 'zod';
import { forgeErrorResponse, requireForgeAuth } from '@/lib/business/forge/api-helpers';
import { recordReleaseSourceOnPostRelease } from '@/lib/business/forge/release-source';
import { ReleaseSourceActorInput } from '@/lib/contracts/telemetry';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

function fieldErrorBody(error: z.ZodError): { errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  for (const [field, messages] of Object.entries(error.flatten().fieldErrors)) {
    const message = messages?.[0];
    if (message) errors[field] = message;
  }
  return { errors };
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireForgeAuth(req);
  if (auth instanceof Response) return auth;
  const { id } = await ctx.params;
  const parsed = ReleaseSourceActorInput.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(fieldErrorBody(parsed.error), { status: 400 });
  }
  try {
    const mission = await prisma.mission.findUnique({ where: { id } });
    if (!mission) {
      return NextResponse.json({ error: 'Mission not found' }, { status: 404 });
    }
    if (!auth.isAdmin && mission.createdById !== auth.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    // Replay deriveReleaseActor from cached tags; if no tags yet the helper
    // falls back to the explicit actor input.
    const [approvals, handoffs] = await Promise.all([
      prisma.approval.findMany({ where: { missionId: id } }),
      prisma.stageHandoff.findMany({ where: { missionId: id } }),
    ]);
    const approvalIds = approvals.map((a) => a.id);
    const tags =
      approvalIds.length === 0
        ? []
        : await prisma.approvalActorTag.findMany({ where: { approvalId: { in: approvalIds } } });
    const tagsByApproval = new Map<string, { actorKind: string }[]>();
    for (const t of tags) {
      const arr = tagsByApproval.get(t.approvalId) ?? [];
      arr.push({ actorKind: t.actorKind });
      tagsByApproval.set(t.approvalId, arr);
    }
    await recordReleaseSourceOnPostRelease({
      missionId: id,
      missionCreatedById: mission.createdById,
      decidedById: parsed.data.decidedById ?? auth.user.id,
      reasonText: parsed.data.reasonText,
      releaserIsHuman: parsed.data.actor !== 'AIOnly',
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
    return NextResponse.json({ ok: true });
  } catch (err) {
    return forgeErrorResponse(err);
  }
}
