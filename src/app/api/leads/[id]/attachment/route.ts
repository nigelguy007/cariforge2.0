// @polsia:user-owned — POST /api/leads/[id]/attachment. Public (same trust
// boundary as POST /api/leads itself — no auth on the front-door funnel),
// multipart/form-data upload of one optional document for an existing lead.
// Stored directly in Postgres (LeadAttachment.data, bytea) — no separate
// file-storage provider needed at pilot scale. One attachment per lead,
// enforced here (not a DB constraint): a second upload for the same lead
// replaces the first rather than accumulating silently.

import 'server-only';
import { NextResponse } from 'next/server';
import {
  ALLOWED_ATTACHMENT_MIME_TYPES,
  LeadAttachmentMeta,
  MAX_ATTACHMENT_BYTES,
} from '@/lib/contracts/leads';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const lead = await prisma.lead.findUnique({ where: { id }, select: { id: true } });
  if (!lead) {
    return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
  }

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
      { error: `File is too large — cap is ${Math.floor(MAX_ATTACHMENT_BYTES / (1024 * 1024))} MB.` },
      { status: 413 },
    );
  }
  // Trust the browser's declared type for the allowlist check, but never the
  // filename — it's stored and echoed back for display only, never used to
  // build a path or executed.
  if (!ALLOWED_ATTACHMENT_MIME_TYPES.includes(file.type as (typeof ALLOWED_ATTACHMENT_MIME_TYPES)[number])) {
    return NextResponse.json(
      { error: `File type "${file.type || 'unknown'}" isn't supported. PDF, Word, text, CSV, PNG, or JPEG only.` },
      { status: 415 },
    );
  }

  const bytes = Buffer.from(await file.arrayBuffer());

  // Replace, don't accumulate: delete any existing attachment for this lead
  // first (one-per-lead is an app-level rule, not a DB constraint).
  const attachment = await prisma.$transaction(async (tx) => {
    await tx.leadAttachment.deleteMany({ where: { leadId: id } });
    return tx.leadAttachment.create({
      data: {
        leadId: id,
        filename: file.name.slice(0, 255),
        mimeType: file.type,
        sizeBytes: file.size,
        data: bytes,
      },
    });
  });

  return NextResponse.json(
    LeadAttachmentMeta.parse({
      id: attachment.id,
      filename: attachment.filename,
      mimeType: attachment.mimeType,
      sizeBytes: attachment.sizeBytes,
      createdAt: attachment.createdAt.toISOString(),
    }),
    { status: 201 },
  );
}
