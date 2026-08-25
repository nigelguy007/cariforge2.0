// @polsia:user-owned — GET /api/agents. Static catalog copy for the
// seven-agent core model: 1 Discovery, 2 Readiness, 3 Workflow, 4 Governance,
// 5 AI Build, 6 Partner, 7 Impact. Served from in-process `as const` constants
// with no DB. The route parses through the shared CoreAgents contract so the
// client island can rely on the same shape on both ends of the wire. Distinct
// from /api/council (the five-voice governance council that audits the brief).

import 'server-only';
import { NextResponse } from 'next/server';
import { CORE_AGENTS } from '@/lib/business/agents';
import { CoreAgents } from '@/lib/contracts/agents';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(CoreAgents.parse(CORE_AGENTS));
}
