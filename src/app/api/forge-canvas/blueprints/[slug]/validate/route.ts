// @polsia:user-owned — POST /api/forge-canvas/blueprints/[slug]/validate.
// Validates a blueprint definition (the in-editor draft, not necessarily a
// saved version) against syntax + semantics + the live agent registry.
// Never persists anything.

import 'server-only';
import { NextResponse } from 'next/server';
import { requireForgeAuth } from '@/lib/business/forge/api-helpers';
import { validateForSave } from '@/lib/business/forge-canvas/service';
import { BlueprintValidation, CariBlueprintDefinition } from '@/lib/contracts/forge-canvas';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const auth = await requireForgeAuth(req);
  if (auth instanceof Response) return auth;
  const parsed = CariBlueprintDefinition.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    // Syntax-level failure — surface as a validation result, not a 400,
    // so the canvas shows it in the same issues panel.
    return NextResponse.json(
      BlueprintValidation.parse({
        ok: false,
        issues: parsed.error.issues.slice(0, 10).map((i) => ({
          nodeId: null,
          message: `${i.path.join('.')}: ${i.message}`,
        })),
      }),
    );
  }
  return NextResponse.json(BlueprintValidation.parse(await validateForSave(parsed.data)));
}
