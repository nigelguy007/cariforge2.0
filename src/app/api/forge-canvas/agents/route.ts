// @polsia:user-owned — GET /api/forge-canvas/agents. The Agent Foundry
// registry read for the canvas palette. Auth-gated like every other
// /api/forge* route.

import 'server-only';
import { NextResponse } from 'next/server';
import { requireForgeAuth } from '@/lib/business/forge/api-helpers';
import { listCanvasAgents } from '@/lib/business/forge-canvas/service';
import { CanvasAgentList } from '@/lib/contracts/forge-canvas';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const auth = await requireForgeAuth(req);
  if (auth instanceof Response) return auth;
  return NextResponse.json(CanvasAgentList.parse(await listCanvasAgents()));
}
