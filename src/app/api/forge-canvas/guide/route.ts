// @polsia:user-owned — POST /api/forge-canvas/guide (PR B, Forge Guide).
// Reuses the existing workflow configurator (getConfiguratorResult — no
// second Claude persona, no extra model call) and compiles its result into
// a starter CARI Blueprint with deterministic TypeScript (guide.ts). Never
// saves — the canvas loads the returned definition as an in-memory draft;
// the author reviews, edits, and explicitly saves it like any other
// workflow. Auth-gated (do not expose this as the public /api/configurator
// route is): it directly returns a compiled graph, which the public
// front-door configurator does not.

import 'server-only';
import { NextResponse } from 'next/server';
import { getConfiguratorResult } from '@/lib/business/configurator';
import { requireForgeAuth } from '@/lib/business/forge/api-helpers';
import {
  compileGuideDraft,
  fallbackGuideDraft,
  suggestNameAndSlug,
} from '@/lib/business/forge-canvas/guide';
import { validateForSave } from '@/lib/business/forge-canvas/service';
import { GuideRequest, GuideResponse } from '@/lib/contracts/guide';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const auth = await requireForgeAuth(req);
  if (auth instanceof Response) return auth;

  const parsed = GuideRequest.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid guide request' }, { status: 400 });
  }
  const { description } = parsed.data;
  const { name: suggestedName, slug: suggestedSlug } = suggestNameAndSlug(description);

  const configured = await getConfiguratorResult(description);

  if (configured.status === 'unavailable') {
    const definition = fallbackGuideDraft(description);
    const validation = await validateForSave(definition);
    if (!validation.ok) {
      // The fallback graph is a fixed, hand-written template — if it ever
      // fails its own validator that's a bug in guide.ts, not bad input.
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
    return NextResponse.json(
      GuideResponse.parse({
        status: 'unavailable',
        indicative: true,
        definition,
        suggestedSlug,
        suggestedName,
      }),
    );
  }

  const definition = compileGuideDraft({ description, result: configured.result });
  const validation = await validateForSave(definition);
  if (!validation.ok) {
    // compileGuideDraft is deterministic TypeScript over a validated
    // ConfiguratorResult — a failure here means the compiler itself is
    // wrong, not that the input was bad.
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }

  return NextResponse.json(
    GuideResponse.parse({
      status: 'ok',
      indicative: true,
      result: configured.result,
      definition,
      suggestedSlug,
      suggestedName,
    }),
  );
}
