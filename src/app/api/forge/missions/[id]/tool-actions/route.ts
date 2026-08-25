// @polsia:user-owned — POST /api/forge/missions/:id/tool-actions.

import 'server-only';
import { NextResponse } from 'next/server';
import type { z } from 'zod';
import { forgeErrorResponse, requireForgeAuth } from '@/lib/business/forge/api-helpers';
import { proposeToolAction } from '@/lib/business/forge/service';
import { ToolActionCreate } from '@/lib/contracts/forge';

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
  const parsed = ToolActionCreate.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(fieldErrorBody(parsed.error), { status: 400 });
  }
  const { id } = await ctx.params;
  try {
    const detail = await proposeToolAction({
      missionId: id,
      userId: auth.user.id,
      isAdmin: auth.isAdmin,
      tool: parsed.data.tool,
      scope: parsed.data.scope,
      payload: parsed.data.payload,
      requiresGateApproval: parsed.data.requiresGateApproval,
    });
    return NextResponse.json(detail, { status: 201 });
  } catch (err) {
    return forgeErrorResponse(err);
  }
}
