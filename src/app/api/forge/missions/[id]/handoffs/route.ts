// @polsia:user-owned — POST /api/forge/missions/:id/handoffs.

import 'server-only';
import { NextResponse } from 'next/server';
import type { z } from 'zod';
import { forgeErrorResponse, requireForgeAuth } from '@/lib/business/forge/api-helpers';
import { submitHandoff } from '@/lib/business/forge/service';
import { HandoffCreate } from '@/lib/contracts/forge';

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
  const parsed = HandoffCreate.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(fieldErrorBody(parsed.error), { status: 400 });
  }
  const { id } = await ctx.params;
  try {
    const detail = await submitHandoff({
      missionId: id,
      userId: auth.user.id,
      isAdmin: auth.isAdmin,
      stage: parsed.data.stage,
      payload: parsed.data.payload,
      confidence: parsed.data.confidence,
      missingEvidence: parsed.data.missingEvidence,
      toolRefs: parsed.data.toolRefs,
      parentVersionId: parsed.data.parentVersionId,
    });
    return NextResponse.json(detail, { status: 201 });
  } catch (err) {
    return forgeErrorResponse(err);
  }
}
