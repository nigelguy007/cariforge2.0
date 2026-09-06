// @polsia:user-owned — POST /api/forge/missions/:id/gates/:gateIndex/decide.

import 'server-only';
import { NextResponse } from 'next/server';
import type { z } from 'zod';
import { forgeErrorResponse, requireForgeAuth } from '@/lib/business/forge/api-helpers';
import { decideGate } from '@/lib/business/forge/service';
import { GateDecide } from '@/lib/contracts/forge';

export const dynamic = 'force-dynamic';

function fieldErrorBody(error: z.ZodError): { errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  for (const [field, messages] of Object.entries(error.flatten().fieldErrors)) {
    const message = messages?.[0];
    if (message) errors[field] = message;
  }
  return { errors };
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string; gateIndex: string }> },
) {
  const auth = await requireForgeAuth(req);
  if (auth instanceof Response) return auth;
  const { id, gateIndex } = await ctx.params;
  const parsedIdx = Number.parseInt(gateIndex, 10);
  if (!Number.isFinite(parsedIdx) || parsedIdx < 0 || parsedIdx > 4) {
    return NextResponse.json({ errors: { gateIndex: 'gateIndex must be 0..4' } }, { status: 400 });
  }
  const parsed = GateDecide.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(fieldErrorBody(parsed.error), { status: 400 });
  }
  try {
    const detail = await decideGate({
      missionId: id,
      userId: auth.user.id,
      isAdmin: auth.isAdmin,
      gateIndex: parsedIdx,
      decision: parsed.data.decision,
      controls: parsed.data.controls ?? null,
      reasonCode: parsed.data.reasonCode,
      reasonText: parsed.data.reasonText,
      stageHandoffId: parsed.data.stageHandoffId,
    });
    return NextResponse.json(detail, { status: 200 });
  } catch (err) {
    return forgeErrorResponse(err);
  }
}
