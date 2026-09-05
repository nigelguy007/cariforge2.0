// @polsia:user-owned — POST + GET /api/forge/missions/:id/evidence.
//
// POST accepts two bodies: the original JSON body (EvidenceCreate — a
// text/URL/etc. reference) and, when the request is multipart/form-data, a
// real file upload (added for the chat-based project intake's document
// attachment — see mission-intake-chat.tsx). The file path reuses the exact
// MIME allowlist, size cap, and Postgres-bytea storage pattern already
// established by POST /api/leads/[id]/attachment, rather than a third,
// diverging upload mechanism.

import 'server-only';
import { NextResponse } from 'next/server';
import type { z } from 'zod';
import {
  type ForgeAuthOk,
  forgeErrorResponse,
  requireForgeAuth,
} from '@/lib/business/forge/api-helpers';
import { attachEvidence, attachEvidenceFile, getMissionDetail } from '@/lib/business/forge/service';
import { EvidenceCreate } from '@/lib/contracts/forge';
import { ALLOWED_ATTACHMENT_MIME_TYPES, MAX_ATTACHMENT_BYTES } from '@/lib/contracts/leads';

export const dynamic = 'force-dynamic';

function fieldErrorBody(error: z.ZodError): { errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  for (const [field, messages] of Object.entries(error.flatten().fieldErrors)) {
    const message = messages?.[0];
    if (message) errors[field] = message;
  }
  return { errors };
}

async function postFile(req: Request, missionId: string, auth: ForgeAuthOk) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: 'Expected multipart/form-data' }, { status: 400 });
  }

  const file = form.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  }
  if (file.size === 0) {
    return NextResponse.json({ error: 'File is empty' }, { status: 400 });
  }
  if (file.size > MAX_ATTACHMENT_BYTES) {
    return NextResponse.json(
      {
        error: `File is too large — cap is ${Math.floor(MAX_ATTACHMENT_BYTES / (1024 * 1024))} MB.`,
      },
      { status: 413 },
    );
  }
  // Trust the browser's declared type for the allowlist check, but never the
  // filename — it's stored and echoed back for display only, never used to
  // build a path or executed (same rule as the leads attachment route).
  if (
    !ALLOWED_ATTACHMENT_MIME_TYPES.includes(
      file.type as (typeof ALLOWED_ATTACHMENT_MIME_TYPES)[number],
    )
  ) {
    return NextResponse.json(
      {
        error: `File type "${file.type || 'unknown'}" isn't supported. PDF, Word, text, CSV, PNG, or JPEG only.`,
      },
      { status: 415 },
    );
  }

  const labelRaw = form.get('label');
  const label =
    typeof labelRaw === 'string' && labelRaw.trim()
      ? labelRaw.trim().slice(0, 200)
      : file.name.slice(0, 200);
  const bytes = Buffer.from(await file.arrayBuffer());

  try {
    const detail = await attachEvidenceFile({
      missionId,
      userId: auth.user.id,
      isAdmin: auth.isAdmin,
      filename: file.name.slice(0, 255),
      mimeType: file.type,
      sizeBytes: file.size,
      data: bytes,
      label,
    });
    return NextResponse.json(detail, { status: 201 });
  } catch (err) {
    return forgeErrorResponse(err);
  }
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireForgeAuth(req);
  if (auth instanceof Response) return auth;
  const { id } = await ctx.params;

  const contentType = req.headers.get('content-type') ?? '';
  if (contentType.includes('multipart/form-data')) {
    return postFile(req, id, auth);
  }

  const parsed = EvidenceCreate.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(fieldErrorBody(parsed.error), { status: 400 });
  }
  try {
    const detail = await attachEvidence({
      missionId: id,
      userId: auth.user.id,
      isAdmin: auth.isAdmin,
      kind: parsed.data.kind,
      ref: parsed.data.ref,
      label: parsed.data.label,
      attachedToStageHandoffId: parsed.data.attachedToStageHandoffId,
    });
    return NextResponse.json(detail, { status: 201 });
  } catch (err) {
    return forgeErrorResponse(err);
  }
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireForgeAuth(_req);
  if (auth instanceof Response) return auth;
  const { id } = await ctx.params;
  try {
    const detail = await getMissionDetail(id, auth.user.id, auth.isAdmin);
    if (!detail) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ items: detail.evidence }, { status: 200 });
  } catch (err) {
    return forgeErrorResponse(err);
  }
}
