// @polsia:user-owned — POST /api/forge-canvas/blueprints/[slug]/import (PR
// A5). Parses a posted YAML document into a CARI Blueprint and validates
// it against the live agent registry — the server-side counterpart of
// .../validate, for YAML rather than JSON. Never saves: the canvas
// toolbar's own Import control parses client-side (yamlToBlueprint ->
// toFlow -> set nodes/edges) and never calls this at all; this route
// exists for programmatic/API callers that hand over a YAML document and
// want back the parsed definition plus a validation verdict before they
// decide whether to POST it on to /api/forge-canvas/blueprints
// themselves. `slug` isn't used to look anything up — kept in the path
// only for symmetry with the sibling .../yaml export route.

import 'server-only';
import { NextResponse } from 'next/server';
import { requireForgeAuth } from '@/lib/business/forge/api-helpers';
import { validateForSave } from '@/lib/business/forge-canvas/service';
import { yamlToBlueprint } from '@/lib/business/forge-canvas/yaml';
import type { CariBlueprintDefinition } from '@/lib/contracts/forge-canvas';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const auth = await requireForgeAuth(req);
  if (auth instanceof Response) return auth;

  const source = await req.text();
  let parsed: ReturnType<typeof CariBlueprintDefinition.parse>;
  try {
    parsed = yamlToBlueprint(source);
  } catch (err) {
    // Syntax-level failure (bad YAML, or valid YAML that fails the
    // blueprint schema) — same treatment as .../validate: a validation
    // result, not a raw 400, so an API caller gets one consistent shape.
    const message = err instanceof Error ? err.message : 'Could not parse YAML document.';
    return NextResponse.json({ ok: false, issues: [{ nodeId: null, message }], definition: null });
  }

  const validation = await validateForSave(parsed);
  return NextResponse.json({
    ok: validation.ok,
    issues: validation.issues,
    definition: validation.ok ? parsed : null,
  });
}
