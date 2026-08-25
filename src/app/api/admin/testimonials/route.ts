// @polsia:user-owned — admin moderation gate for /testimonials.
//   GET   — list every testimonial (published + unpublished), newest queue
//           entry first, so the admin can flip switches from one place.
//   PATCH — toggle the published flag on a single testimonial by id.
//
// Gates the request by role-`admin` at the top of both handlers and returns
// 401 (unauthenticated) / 403 (signed-in but not admin) as JSON so the
// client island's error state gets a parseable response instead of a
// next-redirect 307 (the page itself uses requireAdminOnPage() which
// redirects, but the fetch on the client must surface an error).

import 'server-only';
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import type { z } from 'zod';
import { auth } from '@/lib/auth';
import { listAllTestimonialsForAdmin, setTestimonialPublished } from '@/lib/business/testimonials';
import { AdminTestimonialList, TestimonialPublishUpdate } from '@/lib/contracts/testimonials';

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

export async function GET() {
  const gate = await ensureAdmin();
  if (!gate.ok) return NextResponse.json(gate.body, { status: gate.status });

  const items = await listAllTestimonialsForAdmin();
  return NextResponse.json(AdminTestimonialList.parse({ items }), { status: 200 });
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

  const parsed = TestimonialPublishUpdate.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(fieldErrorBody(parsed.error), { status: 400 });
  }

  try {
    const updated = await setTestimonialPublished(parsed.data.id, parsed.data.published);
    return NextResponse.json(
      { ok: true, published: updated.published, item: updated },
      { status: 200 },
    );
  } catch (err) {
    // P2025 from Prisma when the row id doesn't exist.
    if (
      err &&
      typeof err === 'object' &&
      'code' in err &&
      (err as { code?: string }).code === 'P2025'
    ) {
      return NextResponse.json({ error: 'Testimonial not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
