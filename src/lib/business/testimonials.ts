// @polsia:user-owned — server-side reads/writes for the Testimonial resource.
// Called from /api/testimonials (public GET, published-only) and
// /api/admin/testimonials (admin GET + PATCH publish toggle). Never imported
// from a page or client component. `import 'server-only'` is enforced here so
// any accidental client-side import breaks the build rather than silently
// landing a Prisma client in a client bundle.

import 'server-only';
import { z } from 'zod';
import {
  AdminTestimonialItem,
  type AdminTestimonialItem as AdminTestimonialItemType,
  TestimonialList,
  type TestimonialList as TestimonialListType,
} from '@/lib/contracts/testimonials';
import { prisma } from '@/lib/db';

// Public read: only `published = true` rows, newest quote first. The /api
// handler ALSO filters server-side (defence in depth — the UI is not the gate).
export async function listPublishedTestimonials(): Promise<TestimonialListType> {
  const rows = await prisma.testimonial.findMany({
    where: { published: true },
    orderBy: { quoteDate: 'desc' },
  });
  const items = rows.map((row) => ({
    id: row.id,
    sector: row.sector,
    quote: row.quote,
    attributedRole: row.attributedRole,
    organisation: row.organisation,
    contact: row.contact ?? null,
    quoteDate: row.quoteDate.toISOString(),
  }));
  return TestimonialList.parse({ items });
}

// Admin read: every row (published or not), newest moderation-queue entry
// first, so the admin table can flip unpublished quotes live.
export async function listAllTestimonialsForAdmin(): Promise<AdminTestimonialItemType[]> {
  const rows = await prisma.testimonial.findMany({
    orderBy: { createdAt: 'desc' },
  });
  return z.array(AdminTestimonialItem).parse(
    rows.map((row) => ({
      id: row.id,
      sector: row.sector,
      quote: row.quote,
      attributedRole: row.attributedRole,
      organisation: row.organisation,
      contact: row.contact ?? null,
      quoteDate: row.quoteDate.toISOString(),
      published: row.published,
      createdAt: row.createdAt.toISOString(),
    })),
  );
}

// Admin write: flip the published flag on an existing testimonial. Throws
// when no row matches (Prisma P2025) — the handler maps that to a 404.
export async function setTestimonialPublished(
  id: string,
  published: boolean,
): Promise<AdminTestimonialItemType> {
  const row = await prisma.testimonial.update({
    where: { id },
    data: { published },
  });
  return AdminTestimonialItem.parse({
    id: row.id,
    sector: row.sector,
    quote: row.quote,
    attributedRole: row.attributedRole,
    organisation: row.organisation,
    contact: row.contact ?? null,
    quoteDate: row.quoteDate.toISOString(),
    published: row.published,
    createdAt: row.createdAt.toISOString(),
  });
}
