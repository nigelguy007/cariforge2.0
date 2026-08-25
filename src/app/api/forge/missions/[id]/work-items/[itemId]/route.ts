// @polsia:user-owned — PATCH /api/forge/missions/:id/work-items/:itemId.

import 'server-only';
import { NextResponse } from 'next/server';
import type { z } from 'zod';
import { forgeErrorResponse, requireForgeAuth } from '@/lib/business/forge/api-helpers';
import { transitionWorkItem } from '@/lib/business/forge/service';
import { WorkItemRead, WorkItemStatusTransition } from '@/lib/contracts/forge';

export const dynamic = 'force-dynamic';

function fieldErrorBody(error: z.ZodError): { errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  for (const [field, messages] of Object.entries(error.flatten().fieldErrors)) {
    const message = messages?.[0];
    if (message) errors[field] = message;
  }
  return { errors };
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string; itemId: string }> },
) {
  const auth = await requireForgeAuth(req);
  if (auth instanceof Response) return auth;
  const { id, itemId } = await ctx.params;
  const parsed = WorkItemStatusTransition.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(fieldErrorBody(parsed.error), { status: 400 });
  }
  try {
    const updated = await transitionWorkItem({
      missionId: id,
      userId: auth.user.id,
      isAdmin: auth.isAdmin,
      itemId,
      toStatus: parsed.data.status,
      reasonCode: parsed.data.reasonCode,
      reasonText: parsed.data.reasonText,
    });
    return NextResponse.json(WorkItemRead.parse(updated), { status: 200 });
  } catch (err) {
    return forgeErrorResponse(err);
  }
}
