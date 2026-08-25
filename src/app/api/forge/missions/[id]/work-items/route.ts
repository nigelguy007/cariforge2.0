// @polsia:user-owned — GET/POST /api/forge/missions/:id/work-items.

import 'server-only';
import { NextResponse } from 'next/server';
import type { z } from 'zod';
import { z as zod } from 'zod';
import { forgeErrorResponse, requireForgeAuth } from '@/lib/business/forge/api-helpers';
import { createWorkItems, listWorkItems } from '@/lib/business/forge/service';
import { WorkItemList, type WorkItemReadT } from '@/lib/contracts/forge';

export const dynamic = 'force-dynamic';

function fieldErrorBody(error: z.ZodError): { errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  for (const [field, messages] of Object.entries(error.flatten().fieldErrors)) {
    const message = messages?.[0];
    if (message) errors[field] = message;
  }
  return { errors };
}

// Allow either a single object body or a `{ items: [...] }` wrapper so callers
// can submit one or many items per request.
const WorkItemBatchCreate = zod.union([
  zod.object({
    parentStageHandoffId: zod.string().trim().min(1),
    title: zod.string().trim().min(1).max(200),
    scope: zod.string().trim().min(1).max(2000),
    acceptanceCriteria: zod.string().trim().min(1).max(2000),
    ownerUserId: zod.string().trim().max(120).optional(),
  }),
  zod.object({
    items: zod
      .array(
        zod.object({
          parentStageHandoffId: zod.string().trim().min(1),
          title: zod.string().trim().min(1).max(200),
          scope: zod.string().trim().min(1).max(2000),
          acceptanceCriteria: zod.string().trim().min(1).max(2000),
          ownerUserId: zod.string().trim().max(120).optional(),
        }),
      )
      .min(1),
  }),
]);

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireForgeAuth(req);
  if (auth instanceof Response) return auth;
  const { id } = await ctx.params;
  try {
    const items: WorkItemReadT[] = await listWorkItems({
      missionId: id,
      userId: auth.user.id,
      isAdmin: auth.isAdmin,
    });
    return NextResponse.json(WorkItemList.parse({ items }), { status: 200 });
  } catch (err) {
    return forgeErrorResponse(err);
  }
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireForgeAuth(req);
  if (auth instanceof Response) return auth;
  const { id } = await ctx.params;
  const parsed = WorkItemBatchCreate.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(fieldErrorBody(parsed.error), { status: 400 });
  }
  const items = 'items' in parsed.data ? parsed.data.items : [parsed.data];
  try {
    const created = await createWorkItems({
      missionId: id,
      userId: auth.user.id,
      isAdmin: auth.isAdmin,
      items,
    });
    return NextResponse.json(WorkItemList.parse({ items: created }), { status: 201 });
  } catch (err) {
    return forgeErrorResponse(err);
  }
}
