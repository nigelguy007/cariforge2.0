// @polsia:user-owned — GET /api/forge-canvas/blueprints/[slug]. Loads the
// latest version (or ?version=N) of one CARI Blueprint for the canvas.

import 'server-only';
import { NextResponse } from 'next/server';
import { forgeErrorResponse, requireForgeAuth } from '@/lib/business/forge/api-helpers';
import { getBlueprint } from '@/lib/business/forge-canvas/service';
import { BlueprintItem } from '@/lib/contracts/forge-canvas';

export const dynamic = 'force-dynamic';

export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const auth = await requireForgeAuth(req);
  if (auth instanceof Response) return auth;
  const { slug } = await params;
  const versionRaw = new URL(req.url).searchParams.get('version');
  const version = versionRaw ? Number.parseInt(versionRaw, 10) : undefined;
  try {
    const bp = await getBlueprint(slug, Number.isFinite(version) ? version : undefined);
    return NextResponse.json(BlueprintItem.parse(bp));
  } catch (err) {
    return forgeErrorResponse(err);
  }
}
