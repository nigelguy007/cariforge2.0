// @polsia:user-owned — POST + GET /api/forge/missions/:id/evidence.

import 'server-only';
import { NextResponse } from 'next/server';
import type { z } from 'zod';
import { forgeErrorResponse, requireForgeAuth } from '@/lib/business/forge/api-helpers';
import { attachEvidence, getMissionDetail } from '@/lib/business/forge/service';
import { EvidenceCreate } from '@/lib/contracts/forge';

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
  const parsed = EvidenceCreate.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(fieldErrorBody(parsed.error), { status: 400 });
  }
  const { id } = await ctx.params;
  try {
    const detail = await attachEvidence({
      missionId: id,
      userId: auth.user.id,
      isAdmin: auth.isAdmin,
      kind: parsed.data.kind,
      ref: parsed.data.ref,
      label: parsed.data.label,
      attachedToStageHandoffId: parsed.data.attachedToStageHandoffId,
    });
    return NextResponse.json(detail, { status: 201 });
  } catch (err) {
    return forgeErrorResponse(err);
  }
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireForgeAuth(_req);
  if (auth instanceof Response) return auth;
  const { id } = await ctx.params;
  try {
    const detail = await getMissionDetail(id, auth.user.id, auth.isAdmin);
    if (!detail) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ items: detail.evidence }, { status: 200 });
  } catch (err) {
    return forgeErrorResponse(err);
  }
}
