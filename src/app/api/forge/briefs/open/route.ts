// @polsia:user-owned — GET /api/forge/briefs/open (UX review C1, wireframe
// v2). The signed-in user's own submitted briefs that no mission has
// converted yet, matched strictly by the session email. This is what powers
// the dashboard's "Your brief · CF-XXXX → Convert to mission" card — the
// bridge that turns the public front door's reference number into a
// governed mission instead of a dead end.

import 'server-only';
import { NextResponse } from 'next/server';
import { friendlyLeadReference, OpenBriefList } from '@/lib/contracts/leads';
import { prisma } from '@/lib/db';
import { requireAuth, type SessionUser } from '@/lib/require-auth';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  let user: SessionUser;
  try {
    user = await requireAuth(req);
  } catch (res) {
    return res as Response;
  }
  if (!user.email) return NextResponse.json(OpenBriefList.parse({ items: [] }));

  // Email match is case-insensitive; only front-door briefs qualify
  // (walkthrough/newsletter rows have their own flows).
  const leads = await prisma.lead.findMany({
    where: {
      email: { equals: user.email, mode: 'insensitive' },
      OR: [{ source: 'home' }, { source: null }],
    },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      brief: true,
      createdAt: true,
      attachments: { select: { id: true }, take: 1 },
    },
    take: 10,
  });
  if (leads.length === 0) return NextResponse.json(OpenBriefList.parse({ items: [] }));

  // "Open" = no mission (from anyone) references this lead yet.
  const converted = await prisma.mission.findMany({
    where: { sourceLeadId: { in: leads.map((l) => l.id) } },
    select: { sourceLeadId: true },
  });
  const convertedIds = new Set(converted.map((m) => m.sourceLeadId));

  const items = leads
    .filter((l) => !convertedIds.has(l.id))
    .map((l) => ({
      id: l.id,
      reference: friendlyLeadReference(l.id),
      brief: l.brief,
      createdAt: l.createdAt.toISOString(),
      hasAttachment: l.attachments.length > 0,
    }));
  return NextResponse.json(OpenBriefList.parse({ items }));
}
