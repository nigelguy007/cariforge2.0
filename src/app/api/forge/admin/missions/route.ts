// @polsia:user-owned — GET /api/forge/admin/missions. Admin-only listing.

import 'server-only';
import { NextResponse } from 'next/server';
import { requireForgeAdmin } from '@/lib/business/forge/api-helpers';
import { listAllMissions } from '@/lib/business/forge/service';
import { MissionList } from '@/lib/contracts/forge';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const auth = await requireForgeAdmin(req);
  if (auth instanceof Response) return auth;
  const items = await listAllMissions();
  return NextResponse.json(MissionList.parse({ items }), { status: 200 });
}
