// @polsia:user-owned — POST /api/forge/intake-chat. One turn of the
// chat-based project-intake flow: takes the conversation so far, returns
// CariForge's next reply plus whatever structured intake fields it has
// extracted. No mission exists yet at this point — any signed-in user may
// call this (requireForgeAuth, not an ownership check).
import 'server-only';
import { NextResponse } from 'next/server';
import type { z } from 'zod';
import { requireForgeAuth } from '@/lib/business/forge/api-helpers';
import { intakeChatTurn } from '@/lib/business/forge/intake-chat';
import { IntakeChatRequest } from '@/lib/contracts/intake-chat';

export const dynamic = 'force-dynamic';

// Same local convention every other /api/forge/* POST route uses (see
// missions/route.ts and its siblings) — field-level errors bucketed under
// `errors`, 400.
function fieldErrorBody(error: z.ZodError): { errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  for (const [field, messages] of Object.entries(error.flatten().fieldErrors)) {
    const message = messages?.[0];
    if (message) errors[field] = message;
  }
  return { errors };
}

export async function POST(req: Request) {
  const auth = await requireForgeAuth(req);
  if (auth instanceof Response) return auth;

  const parsed = IntakeChatRequest.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(fieldErrorBody(parsed.error), { status: 400 });
  }

  const result = await intakeChatTurn({ messages: parsed.data.messages });
  if (result.status === 'unavailable') {
    return NextResponse.json(
      { error: 'CariForge could not continue the conversation right now. Try again shortly.' },
      { status: 503 },
    );
  }

  return NextResponse.json(result.result, { status: 200 });
}
