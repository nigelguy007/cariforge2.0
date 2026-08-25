// @polsia:user-owned — shared zod contract for the Testimonial resource. One
// source of truth shared between the public GET /api/testimonials handler, the
// admin GET/PATCH /api/admin/testimonials handler, the public
// <TestimonialsList/> island, and the admin <AdminTestimonialsTable/> island.
// Keep client-importable: zod only, no `server-only` here. Dates are typed as
// ISO-8601 strings end-to-end (server emits toISOString(), client parses as a
// string) so the wire shape stays a string after JSON round-trip.

import { z } from 'zod';

export const TestimonialSectorValues = [
  'FinancialServices',
  'Insurance',
  'PublicSector',
  'Healthcare',
] as const;

export const TestimonialSectorSchema = z.enum(TestimonialSectorValues);

export type TestimonialSector = (typeof TestimonialSectorValues)[number];

// Public-facing shape: what visitors on /testimonials see. Excludes the
// internal `published` flag and the moderation timestamps — those are the
// admin concern.
export const TestimonialItem = z.object({
  id: z.string(),
  sector: TestimonialSectorSchema,
  quote: z.string().min(20).max(2000),
  attributedRole: z.string().min(1),
  organisation: z.string().min(1),
  contact: z.string().nullable(),
  quoteDate: z.string(), // ISO-8601
});

export const TestimonialList = z.object({
  items: z.array(TestimonialItem),
});

// Admin-facing shape: extends the public item with the moderation state so the
// admin table can flip switches.
export const AdminTestimonialItem = TestimonialItem.extend({
  published: z.boolean(),
  createdAt: z.string(), // ISO-8601 (moderation queue entry time)
});

export const AdminTestimonialList = z.object({
  items: z.array(AdminTestimonialItem),
});

// PATCH input for the admin publish-toggle.
export const TestimonialPublishUpdate = z.object({
  id: z.string().min(1),
  published: z.boolean(),
});

export type TestimonialItem = z.infer<typeof TestimonialItem>;
export type TestimonialList = z.infer<typeof TestimonialList>;
export type AdminTestimonialItem = z.infer<typeof AdminTestimonialItem>;
export type AdminTestimonialList = z.infer<typeof AdminTestimonialList>;
export type TestimonialPublishUpdate = z.infer<typeof TestimonialPublishUpdate>;

// Human-readable sector label shared by the public list and the admin table;
// keeps the copy identical so the two views can't drift apart.
export const sectorLabel = (sector: TestimonialSector): string => {
  switch (sector) {
    case 'FinancialServices':
      return 'Financial Services';
    case 'Insurance':
      return 'Insurance';
    case 'PublicSector':
      return 'Public Sector';
    case 'Healthcare':
      return 'Healthcare';
  }
};
