// @polsia:user-owned — POST /api/forge/missions/:id/work-items/:itemId/test-evidence.

import 'server-only';
import { NextResponse } from 'next/server';
import type { z } from 'zod';
import { forgeErrorResponse, requireForgeAuth } from '@/lib/business/forge/api-helpers';
import { attachTestEvidenceToWorkItem } from '@/lib/business/forge/service';
import { WorkItemRead, WorkItemTestEvidenceAttach } from '@/lib/contracts/forge';

export const dynamic = 'force-dynamic';

function fieldErrorBody(error: z.ZodError): { errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  for (const [field, messages] of Object.entries(error.flatten().fieldErrors)) {
    const message = messages?.[0];
    if (message) errors[field] = message;
  }
  return { errors };
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string; itemId: string }> }) {
  const auth = await requireForgeAuth(req);
  if (auth instanceof Response) return auth;
  const { id, itemId } = await ctx.params;
  const parsed = WorkItemTestEvidenceAttach.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(fieldErrorBody(parsed.error), { status: 400 });
  }
  try {
    const updated = await attachTestEvidenceToWorkItem({
      missionId: id,
      userId: auth.user.id,
      isAdmin: auth.isAdmin,
      itemId,
      evidenceRefId: parsed.data.evidenceRefId,
      note: 'test evidence attached via API',
    });
    return NextResponse.json(WorkItemRead.parse(updated), { status: 200 });
  } catch (err) {
    return forgeErrorResponse(err);
  }
}
