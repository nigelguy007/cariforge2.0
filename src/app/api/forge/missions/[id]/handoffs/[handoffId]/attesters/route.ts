// @polsia:user-owned — POST /api/forge/missions/:id/handoffs/:handoffId/attesters.
// Any authed user may add themselves as a typed specialist attester on a
// handoff. Records an audit row. Idempotent on (handoffId, userId).

import 'server-only';
import { NextResponse } from 'next/server';
import type { z } from 'zod';
import { forgeErrorResponse, requireForgeAuth } from '@/lib/business/forge/api-helpers';
import { addHandoffAttester } from '@/lib/business/forge/service';
import { HandoffSpecialistAttesterAdd } from '@/lib/contracts/forge';

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
  const { id, handoffId } = await ctx.params;
  const parsed = HandoffSpecialistAttesterAdd.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(fieldErrorBody(parsed.error), { status: 400 });
  }
  try {
    const detail = await addHandoffAttester({
      missionId: id,
      handoffId,
      userId: parsed.data.userId,
      role: parsed.data.role,
    });
    return NextResponse.json(detail, { status: 200 });
  } catch (err) {
    return forgeErrorResponse(err);
  }
}
