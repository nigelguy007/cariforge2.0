// @polsia:user-owned — PATCH /api/admin/leads/notes. Admin-only write that
// persists an operator note on a single Lead row.
//
// Same role-`admin` JSON gate as the other /api/admin/leads/* handlers — no
// redirect, so the client island's save indicator gets a parseable response
// on failure (404 when the row vanished, 400 on a bad payload, 500 on
// anything unexpected).

import 'server-only';
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import type { z } from 'zod';
import { auth } from '@/lib/auth';
import { setLeadNotes } from '@/lib/business/leads';
import { LeadNotesUpdate, LeadNotesUpdateResponse } from '@/lib/contracts/leads';

export const dynamic = 'force-dynamic';

function fieldErrorBody(error: z.ZodError): { errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  for (const [field, messages] of Object.entries(error.flatten().fieldErrors)) {
    const message = messages?.[0];
    if (message) errors[field] = message;
  }
  return { errors };
}

async function ensureAdmin(): Promise<
  { ok: true } | { ok: false; status: 401 | 403; body: { error: string } }
> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return { ok: false, status: 401, body: { error: 'Unauthorized' } };
  }
  if (session.user.role !== 'admin') {
    return { ok: false, status: 403, body: { error: 'Forbidden' } };
  }
  return { ok: true };
}

export async function PATCH(req: Request) {
  const gate = await ensureAdmin();
  if (!gate.ok) return NextResponse.json(gate.body, { status: gate.status });

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = LeadNotesUpdate.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(fieldErrorBody(parsed.error), { status: 400 });
  }

  try {
    const item = await setLeadNotes(parsed.data.id, parsed.data.notes);
    return NextResponse.json(LeadNotesUpdateResponse.parse({ ok: true, item }), {
      status: 200,
    });
  } catch (err) {
    // P2025 from Prisma when the row id doesn't exist.
    if (
      err &&
      typeof err === 'object' &&
      'code' in err &&
      (err as { code?: string }).code === 'P2025'
    ) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
