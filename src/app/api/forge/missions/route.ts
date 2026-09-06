// @polsia:user-owned — GET/POST /api/forge/missions. List-owned + create.
// Standard data-plane pattern (requireAuth + zod parse + 400 envelope +
// DB write + audit).

import 'server-only';
import { NextResponse } from 'next/server';
import type { z } from 'zod';
import { createMission, listMissionsForUser } from '@/lib/business/forge/service';
import { MissionCreate, MissionList } from '@/lib/contracts/forge';
import { prisma } from '@/lib/db';
import { requireAuth, type SessionUser } from '@/lib/require-auth';

export const dynamic = 'force-dynamic';

function fieldErrorBody(error: z.ZodError): { errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  for (const [field, messages] of Object.entries(error.flatten().fieldErrors)) {
    const message = messages?.[0];
    if (message) errors[field] = message;
  }
  return { errors };
}

export async function GET(_req: Request) {
  let user: SessionUser;
  try {
    user = await requireAuth(_req);
  } catch (res) {
    return res as Response;
  }
  const items = await listMissionsForUser(user.id);
  return NextResponse.json(MissionList.parse({ items }), { status: 200 });
}

export async function POST(req: Request) {
  let user: SessionUser;
  try {
    user = await requireAuth(req);
  } catch (res) {
    return res as Response;
  }
  const parsed = MissionCreate.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(fieldErrorBody(parsed.error), { status: 400 });
  }
  // UX review C1: a brief may only be converted by the person who submitted
  // it — the lead's email must match the session user's email. Without this
  // check any signed-in user could attach someone else's brief by guessing
  // its id.
  if (parsed.data.sourceLeadId) {
    const lead = await prisma.lead.findUnique({
      where: { id: parsed.data.sourceLeadId },
      select: { email: true },
    });
    if (!lead || !lead.email || lead.email.toLowerCase() !== user.email.toLowerCase()) {
      return NextResponse.json(
        { errors: { sourceLeadId: 'That brief does not belong to this account.' } },
        { status: 403 },
      );
    }
  }
  try {
    const detail = await createMission({
      userId: user.id,
      intake: parsed.data.intake,
      name: parsed.data.name,
      normalizedNeed: parsed.data.normalizedNeed,
      intakeStructured: parsed.data.intakeStructured as Record<string, unknown> | undefined,
      domainTags: parsed.data.domainTags,
      sourceLeadId: parsed.data.sourceLeadId,
    });
    return NextResponse.json(detail, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
