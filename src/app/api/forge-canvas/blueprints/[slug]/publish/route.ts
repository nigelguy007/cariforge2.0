// @polsia:user-owned — POST /api/forge-canvas/blueprints/[slug]/publish
// (PR A6). Promotes the latest Draft version of a blueprint to Published —
// a one-way, no-body request. Owner or admin only; 409 if the latest
// version is already Published.

import 'server-only';
import { NextResponse } from 'next/server';
import { forgeErrorResponse, requireForgeAuth } from '@/lib/business/forge/api-helpers';
import { publishBlueprint } from '@/lib/business/forge-canvas/service';
import { BlueprintItem } from '@/lib/contracts/forge-canvas';

export const dynamic = 'force-dynamic';

export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const auth = await requireForgeAuth(req);
  if (auth instanceof Response) return auth;
  const { slug } = await params;
  try {
    const bp = await publishBlueprint({ userId: auth.user.id, isAdmin: auth.isAdmin, slug });
    return NextResponse.json(BlueprintItem.parse(bp));
  } catch (err) {
    if ((err as Error).message === 'FORGE_CONFLICT') {
      return NextResponse.json({ error: 'This blueprint is already Published.' }, { status: 409 });
    }
    return forgeErrorResponse(err);
  }
}
