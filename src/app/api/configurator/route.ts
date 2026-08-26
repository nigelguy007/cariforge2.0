// @polsia:user-owned — POST /api/configurator. Public, unauthenticated —
// this is a pre-sales tool a prospect uses before they've submitted
// anything real, same trust tier as POST /api/leads. Computed fresh on
// each call, nothing persisted (this is explicitly indicative and
// non-binding, not a real case file — see contracts/configurator.ts).
// Every failure path returns { status: 'unavailable' } with a 200, not an
// error status, so a flaky or unconfigured AI call can't break the form —
// same convention as the qa-review route this is modeled on.

import 'server-only';
import { NextResponse } from 'next/server';
import { getConfiguratorResult } from '@/lib/business/configurator';
import { ConfiguratorRequest, ConfiguratorResponse } from '@/lib/contracts/configurator';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ errors: { description: 'Invalid request body.' } }, { status: 400 });
  }

  const parsed = ConfiguratorRequest.safeParse(raw);
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const [field, messages] of Object.entries(parsed.error.flatten().fieldErrors)) {
      const message = messages?.[0];
      if (message) errors[field] = message;
    }
    return NextResponse.json({ errors }, { status: 400 });
  }

  const result = await getConfiguratorResult(parsed.data.description);
  return NextResponse.json(ConfiguratorResponse.parse(result));
}
