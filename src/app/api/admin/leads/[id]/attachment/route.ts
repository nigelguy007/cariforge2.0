// @polsia:user-owned — GET /api/admin/leads/[id]/attachment. Admin-only
// download of a lead's attached document (LeadAttachment.data, stored
// directly in Postgres). Same auth gate as /api/admin/leads: 401 signed-out,
// 403 non-admin. Streams the file back with its real content-type and a
// Content-Disposition attachment header carrying the original filename.

import 'server-only';
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const attachment = await prisma.leadAttachment.findFirst({ where: { leadId: id } });
  if (!attachment) {
    return NextResponse.json({ error: 'No attachment for this lead' }, { status: 404 });
  }

  // Quote-escape the filename per RFC 6266; fall back to a generic name if
  // it somehow contains a double quote (never trust stored user input in a
  // header verbatim).
  const safeName = attachment.filename.includes('"')
    ? 'attachment'
    : attachment.filename || 'attachment';

  return new NextResponse(new Uint8Array(attachment.data), {
    status: 200,
    headers: {
      'Content-Type': attachment.mimeType || 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${safeName}"`,
      'Content-Length': String(attachment.sizeBytes),
      'Cache-Control': 'private, no-store',
    },
  });
}
