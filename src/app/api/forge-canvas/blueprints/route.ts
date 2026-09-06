// @polsia:user-owned — /api/forge-canvas/blueprints. GET lists the latest
// version of every saved CARI Blueprint; POST validates and saves a NEW
// immutable version (never mutates a prior one). Semantic validation
// failures come back as a 422 carrying the node-anchored issue list so the
// canvas can badge the offending nodes.

import 'server-only';
import { NextResponse } from 'next/server';
import { requireForgeAuth } from '@/lib/business/forge/api-helpers';
import { listBlueprints, saveBlueprint } from '@/lib/business/forge-canvas/service';
import { BlueprintItem, BlueprintList, BlueprintSave } from '@/lib/contracts/forge-canvas';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const auth = await requireForgeAuth(req);
  if (auth instanceof Response) return auth;
  return NextResponse.json(BlueprintList.parse(await listBlueprints()));
}

export async function POST(req: Request) {
  const auth = await requireForgeAuth(req);
  if (auth instanceof Response) return auth;
  const parsed = BlueprintSave.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid blueprint payload' }, { status: 400 });
  }
  try {
    const saved = await saveBlueprint(auth.user.id, parsed.data);
    return NextResponse.json(BlueprintItem.parse(saved), { status: 201 });
  } catch (err) {
    if ((err as Error).message === 'CANVAS_INVALID') {
      const issues = (err as Error & { issues?: unknown }).issues ?? [];
      return NextResponse.json({ error: 'Blueprint failed validation', issues }, { status: 422 });
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
