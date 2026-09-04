// @polsia:user-owned — GET /api/agents. Static catalog copy for the
// seven-agent core model: 1 Discovery, 2 Readiness, 3 Workflow, 4 Governance,
// 5 AI Build, 6 Partner, 7 Impact. Served from in-process `as const` constants
// with no DB. The route parses through the shared CoreAgents contract so the
// client island can rely on the same shape on both ends of the wire. Distinct
// from /api/council (the five-voice governance council that audits the brief).
//
// Session-gated since 2026-09-04 (real user feedback: "this is giving away
// the app functionality to everyone"). Unauthenticated callers get every
// field except `boundary` (inputs/tools/outputs/prohibited/humanApproval/
// evidence/successMeasures) stripped — a name and a one-line mandate is a
// brief explanation, the full operational spec is not. This is a soft gate,
// not a 401/403: the public /how-it-works page still needs a 200 to render
// its trimmed agent summary for anonymous visitors.

import 'server-only';
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { CORE_AGENTS } from '@/lib/business/agents';
import { CoreAgents } from '@/lib/contracts/agents';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  const isAuthenticated = Boolean(session?.user);

  if (isAuthenticated) {
    return NextResponse.json(CoreAgents.parse(CORE_AGENTS));
  }

  const publicItems = CORE_AGENTS.items.map(({ boundary: _boundary, ...rest }) => rest);
  return NextResponse.json(CoreAgents.parse({ items: publicItems }));
}
