// @polsia:user-owned — POST /api/forge/missions/:id/elder-oracle.
// Admin-only assignment of the named Elder Oracle for a mission. Upsert on
// (missionId, 'ElderOracle'). Records an audit row.

import 'server-only';
import { NextResponse } from 'next/server';
import type { z } from 'zod';
import { forgeErrorResponse, requireForgeAdmin } from '@/lib/business/forge/api-helpers';
import { assignElderOracle } from '@/lib/business/forge/service';
import { MissionElderOracleAssign } from '@/lib/contracts/forge';

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
  const auth = await requireForgeAdmin(req);
  if (auth instanceof Response) return auth;
  const { id } = await ctx.params;
  const parsed = MissionElderOracleAssign.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(fieldErrorBody(parsed.error), { status: 400 });
  }
  try {
    const detail = await assignElderOracle({
      missionId: id,
      appointedById: auth.user.id,
      userId: parsed.data.userId,
    });
    return NextResponse.json(detail, { status: 200 });
  } catch (err) {
    return forgeErrorResponse(err);
  }
}
