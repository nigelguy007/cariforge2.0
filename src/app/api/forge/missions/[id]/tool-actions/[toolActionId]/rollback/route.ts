// @polsia:user-owned — POST /api/forge/missions/:id/tool-actions/:toolActionId/rollback.

import 'server-only';
import { NextResponse } from 'next/server';
import type { z } from 'zod';
import { forgeErrorResponse, requireForgeAuth } from '@/lib/business/forge/api-helpers';
import { rollbackToolAction } from '@/lib/business/forge/service';
import { ToolActionRollback } from '@/lib/contracts/forge';

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
  ctx: { params: Promise<{ id: string; toolActionId: string }> },
) {
  const auth = await requireForgeAuth(req);
  if (auth instanceof Response) return auth;
  const parsed = ToolActionRollback.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(fieldErrorBody(parsed.error), { status: 400 });
  }
  const { id, toolActionId } = await ctx.params;
  try {
    const detail = await rollbackToolAction({
      missionId: id,
      userId: auth.user.id,
      isAdmin: auth.isAdmin,
      toolActionId,
      rollbackOfToolActionId: parsed.data.rollbackOfToolActionId,
      reasonCode: parsed.data.reasonCode,
      reasonText: parsed.data.reasonText,
    });
    return NextResponse.json(detail, { status: 200 });
  } catch (err) {
    return forgeErrorResponse(err);
  }
}
