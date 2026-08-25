// @polsia:user-owned — GET /api/testimonials. Public read of approved
// testimonials only. Filter is enforced server-side in
// listPublishedTestimonials() — the UI is NOT the gate. The response parses
// against the shared TestimonialList contract so client + server can't drift
// apart. force-dynamic because approvals flip in the admin surface and we
// want visitors to see the change without a cache window.

import 'server-only';
import { NextResponse } from 'next/server';
import { listPublishedTestimonials } from '@/lib/business/testimonials';
import { TestimonialList } from '@/lib/contracts/testimonials';

export const dynamic = 'force-dynamic';

export async function GET() {
  const payload = TestimonialList.parse(await listPublishedTestimonials());
  return NextResponse.json(payload, { status: 200 });
}
