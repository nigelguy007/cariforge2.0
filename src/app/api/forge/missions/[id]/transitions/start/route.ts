// @polsia:user-owned — POST /api/forge/missions/:id/transitions/start.
// Explicit advance from Draft -> InDiscovery. No-op after the first call so
// the UI can be deterministic.

import 'server-only';
import { NextResponse } from 'next/server';
import type { z } from 'zod';
import { forgeErrorResponse, requireForgeAuth } from '@/lib/business/forge/api-helpers';
import { getMissionDetail } from '@/lib/business/forge/service';
import { TransitionStart } from '@/lib/contracts/forge';
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
  const parsed = TransitionStart.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(fieldErrorBody(parsed.error), { status: 400 });
  }
  const { id } = await ctx.params;
  try {
    const mission = await prisma.mission.findUnique({ where: { id } });
    if (!mission) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (!auth.isAdmin && mission.createdById !== auth.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    await prisma.mission.update({
      where: { id },
      data: { status: 'InDiscovery' },
    });
    await prisma.missionAudit.create({
      data: {
        missionId: id,
        event: 'transition_started',
        payload: { triggerReasonCode: parsed.data.triggerReasonCode ?? null } as never,
        actorId: auth.user.id,
        missionVersionAtEvent: mission.currentStageIndex,
      },
    });
    const detail = await getMissionDetail(id, auth.user.id, auth.isAdmin);
    if (!detail) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(detail, { status: 200 });
  } catch (err) {
    return forgeErrorResponse(err);
  }
}
