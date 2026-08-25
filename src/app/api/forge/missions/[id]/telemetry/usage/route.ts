// @polsia:user-owned — POST /api/forge/missions/[id]/telemetry/usage.
// Records a ModelUsageRecord (per-mission) or a ChatUsageRecord (mission-scope).
// Owner-scoped. Unknown model returns { unknownCost: true, costCents: 0 }.
import 'server-only';
import { NextResponse } from 'next/server';
import type { z } from 'zod';
import { forgeErrorResponse, requireForgeAuth } from '@/lib/business/forge/api-helpers';
import { chatCostCents, modelUsageCostCents } from '@/lib/business/forge/cost-attribution';
import {
  ModelUsageWrite,
  type UsageRecordReadT,
  UsageRecordWrite,
} from '@/lib/contracts/telemetry';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

function fieldErrorBody(error: z.ZodError): { errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  for (const [field, messages] of Object.entries(error.flatten().fieldErrors)) {
    const message = messages?.[0];
    if (message) errors[field] = message;
  }
  return { errors };
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireForgeAuth(req);
  if (auth instanceof Response) return auth;
  const { id } = await ctx.params;
  const parsed = UsageRecordWrite.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(fieldErrorBody(parsed.error), { status: 400 });
  }
  try {
    const mission = await prisma.mission.findUnique({ where: { id } });
    if (!mission) {
      return NextResponse.json({ error: 'Mission not found' }, { status: 404 });
    }
    if (!auth.isAdmin && mission.createdById !== auth.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (parsed.data.kind === 'model') {
      const validated = ModelUsageWrite.parse(parsed.data.data);
      const cost = modelUsageCostCents(
        validated.model,
        validated.promptTokens,
        validated.completionTokens,
      );
      const row = await prisma.modelUsageRecord.create({
        data: {
          missionId: id,
          taskId: validated.taskId ?? null,
          provider: validated.provider,
          model: validated.model,
          promptTokens: validated.promptTokens,
          completionTokens: validated.completionTokens,
          costCents: cost.cents,
          unknownCost: cost.unknownCost,
          attributedActor: validated.attributedActor,
          occurredAt: validated.occurredAt ? new Date(validated.occurredAt) : new Date(),
        },
      });
      await writeTelemetryAudit({
        missionId: id,
        kind: 'usage',
        payload: {
          recordId: row.id,
          kind: 'model',
          model: validated.model,
          unknownCost: cost.unknownCost,
          costCents: cost.cents,
        },
        actorId: auth.user.id,
        missionVersionAtEvent: mission.currentStageIndex,
      });
      const out: UsageRecordReadT = {
        id: row.id,
        kind: 'model',
        unknownCost: cost.unknownCost,
        costCents: cost.cents,
      };
      return NextResponse.json(out, { status: 201 });
    }
    // chat
    const chat = parsed.data.data;
    const cost = chatCostCents(chat.model, chat.messageCount);
    const row = await prisma.chatUsageRecord.create({
      data: {
        scope: chat.scope,
        companyId: chat.companyId ?? null,
        missionId: chat.scope === 'mission' ? id : null,
        messageCount: chat.messageCount,
        model: chat.model,
        costCents: cost.cents,
        unknownCost: cost.unknownCost,
        windowStart: new Date(chat.windowStart),
        windowEnd: new Date(chat.windowEnd),
      },
    });
    await writeTelemetryAudit({
      missionId: id,
      kind: 'usage',
      payload: {
        recordId: row.id,
        kind: 'chat',
        scope: chat.scope,
        model: chat.model,
        unknownCost: cost.unknownCost,
        costCents: cost.cents,
      },
      actorId: auth.user.id,
      missionVersionAtEvent: mission.currentStageIndex,
    });
    const out: UsageRecordReadT = {
      id: row.id,
      kind: 'chat',
      unknownCost: cost.unknownCost,
      costCents: cost.cents,
    };
    return NextResponse.json(out, { status: 201 });
  } catch (err) {
    return forgeErrorResponse(err);
  }
}

async function writeTelemetryAudit(args: {
  missionId: string;
  kind: 'release_source' | 'usage' | 'credit';
  payload: Record<string, unknown>;
  actorId: string;
  missionVersionAtEvent: number;
}) {
  try {
    await prisma.missionAudit.create({
      data: {
        missionId: args.missionId,
        event: 'telemetry.recorded',
        payload: args.payload as object,
        actorId: args.actorId,
        missionVersionAtEvent: args.missionVersionAtEvent,
      },
    });
  } catch (_err) {}
}
