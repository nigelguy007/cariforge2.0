// @polsia:user-owned — POST /api/forge/missions/:id/handoffs/:handoffId/correct.

import 'server-only';
import { NextResponse } from 'next/server';
import type { z } from 'zod';
import { forgeErrorResponse, requireForgeAuth } from '@/lib/business/forge/api-helpers';
import { correctHandoff } from '@/lib/business/forge/service';
import { HandoffCorrect } from '@/lib/contracts/forge';

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
  ctx: { params: Promise<{ id: string; handoffId: string }> },
) {
  const auth = await requireForgeAuth(req);
  if (auth instanceof Response) return auth;
  const parsed = HandoffCorrect.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(fieldErrorBody(parsed.error), { status: 400 });
  }
  const { id, handoffId } = await ctx.params;
  try {
    const detail = await correctHandoff({
      missionId: id,
      userId: auth.user.id,
      isAdmin: auth.isAdmin,
      handoffId,
      payload: parsed.data.payload,
      confidence: parsed.data.confidence,
      missingEvidence: parsed.data.missingEvidence,
      reasonCode: parsed.data.reasonCode,
      reasonText: parsed.data.reasonText,
    });
    return NextResponse.json(detail, { status: 200 });
  } catch (err) {
    return forgeErrorResponse(err);
  }
}
