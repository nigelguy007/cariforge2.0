// @polsia:user-owned — GET /api/forge/missions/:id/runbook.

import 'server-only';
import { NextResponse } from 'next/server';
import { forgeErrorResponse, requireForgeAuth } from '@/lib/business/forge/api-helpers';
import {
  blueprintFromHandoffs,
  deriveReleaseStatus,
  runbookFromHandoffs,
} from '@/lib/business/forge/release';
import { getMissionDetail } from '@/lib/business/forge/service';
import { RunbookRead } from '@/lib/contracts/forge';

export const dynamic = 'force-dynamic';

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireForgeAuth(req);
  if (auth instanceof Response) return auth;
  const { id } = await ctx.params;
  try {
    const detail = await getMissionDetail(id, auth.user.id, auth.isAdmin);
    if (!detail) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const releaseStatus = deriveReleaseStatus({
      status: detail.mission.status,
      completedAt: detail.mission.completedAt,
      releaseReadoutAt: detail.mission.releaseReadoutAt ?? null,
      lastApproval: detail.approvals[0] ?? null,
    });
    // Re-run blueprint derivation only to ensure both ends of the
    // contract are exercised; the runbook itself is independent.
    blueprintFromHandoffs({
      mission: {
        id: detail.mission.id,
        name: detail.mission.name,
        releaseReadoutAt: detail.mission.releaseReadoutAt ?? null,
      },
      handoffs: detail.handoffs,
    });
    const runbook = runbookFromHandoffs({
      mission: {
        id: detail.mission.id,
        name: detail.mission.name,
        releaseReadoutAt: detail.mission.releaseReadoutAt ?? null,
      },
      handoffs: detail.handoffs,
      releaseStatus,
    });
    return NextResponse.json(RunbookRead.parse(runbook), { status: 200 });
  } catch (err) {
    return forgeErrorResponse(err);
  }
}
