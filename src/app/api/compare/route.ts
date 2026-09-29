// @polsia:user-owned — GET /api/compare. Static catalog copy for the /compare
// page: the categories of alternative a Caribbean buyer weighs, named
// examples, and where each falls short, taken from the investor deck's
// competition slide. Served from an in-process constant with no DB read and
// no auth gate. The route still parses through the shared Compare contract so
// the page can rely on the same shape on both ends of the wire.
//
// Positions are CariForge's own assessment. Do not add per-vendor claims
// beyond these category-level lines without a cited source.

import 'server-only';
import { NextResponse } from 'next/server';
import { Compare } from '@/lib/contracts/compare';

export const dynamic = 'force-dynamic';

const ROWS = [
  {
    id: 'global-consultancies',
    category: 'Global consultancies',
    examples: 'Big Four Caribbean practices',
    position: 'Months of work; a cost base built for bigger markets.',
    isSubject: false,
  },
  {
    id: 'ai-governance-platforms',
    category: 'AI governance platforms',
    examples: 'Credo AI, Holistic AI, IBM watsonx.governance, OneTrust',
    position: 'Govern models you already run; they do not build the working system.',
    isSubject: false,
  },
  {
    id: 'agent-builders',
    category: 'Agent builders',
    examples: 'Microsoft Copilot Studio, UiPath',
    position: 'Need an engineering team; governance is build-your-own.',
    isSubject: false,
  },
  {
    id: 'general-ai-assistants',
    category: 'General AI assistants',
    examples: 'ChatGPT, Gemini, Copilot',
    position: 'Advice with no orchestration, approvals or audit trail.',
    isSubject: false,
  },
  {
    id: 'cariforge',
    category: 'CariForge',
    examples: 'Governed agents, human gates and local delivery',
    position: 'A governed, working prototype in 21 days, priced for local budgets.',
    isSubject: true,
  },
] as const;

const DISCLAIMER = "Positions are CariForge's own assessment.";

export async function GET() {
  return NextResponse.json(Compare.parse({ rows: ROWS, disclaimer: DISCLAIMER }));
}
