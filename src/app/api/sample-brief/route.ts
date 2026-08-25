// @polsia:user-owned — GET /api/sample-brief. Static catalog copy for the
// /sample-brief worked-example page: one concrete EU insurance claims-triage
// brief, the council's five objections, the chairman's reconciled ruling,
// the five-agent pipeline of stage handoffs (Agents 1–5) with each named
// supervisor and typed reason attached, and Agent 5's working solution as
// the end of the pipeline. Served from an in-process constant with no DB and
// no live AI call. Parsed through the shared SampleBrief contract.

import 'server-only';
import { NextResponse } from 'next/server';
import { SAMPLE_BRIEF } from '@/lib/business/sample-brief';
import { SampleBrief } from '@/lib/contracts/sample-brief';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(SampleBrief.parse(SAMPLE_BRIEF));
}
