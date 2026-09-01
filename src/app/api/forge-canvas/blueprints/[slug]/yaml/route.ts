// @polsia:user-owned — GET /api/forge-canvas/blueprints/[slug]/yaml (PR
// A5). Exports the latest (or ?version=N) saved version of a CARI
// Blueprint as YAML text — a projection of the canonical JSON definition,
// generated on read, never stored separately.

import 'server-only';
import { NextResponse } from 'next/server';
import { forgeErrorResponse, requireForgeAuth } from '@/lib/business/forge/api-helpers';
import { getBlueprint } from '@/lib/business/forge-canvas/service';
import { blueprintToYaml } from '@/lib/business/forge-canvas/yaml';

export const dynamic = 'force-dynamic';

export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const auth = await requireForgeAuth(req);
  if (auth instanceof Response) return auth;
  const { slug } = await params;
  const versionRaw = new URL(req.url).searchParams.get('version');
  const version = versionRaw ? Number.parseInt(versionRaw, 10) : undefined;
  try {
    const bp = await getBlueprint(slug, Number.isFinite(version) ? version : undefined);
    const yaml = blueprintToYaml(bp.definition);
    return new NextResponse(yaml, {
      headers: {
        'content-type': 'application/yaml; charset=utf-8',
        'content-disposition': `attachment; filename="${bp.slug}-v${bp.version}.yaml"`,
      },
    });
  } catch (err) {
    return forgeErrorResponse(err);
  }
}
