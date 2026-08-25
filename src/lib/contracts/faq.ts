// @polsia:user-owned — shared zod contract for the FAQ resource. Read-only
// registry of regulated-buyer questions surfaced on /faq. One source of truth
// shared between the GET /api/faq handler (server) and the <FaqAccordion/>
// island (client). Keep client-importable: zod only, no server-only imports.

import { z } from 'zod';

export const FaqItem = z.object({
  id: z.string(),
  ordinal: z.number().int().min(1),
  question: z.string().min(1),
  answer: z.string().min(1),
});

export const FaqList = z.object({
  items: z.array(FaqItem),
});

export type FaqItem = z.infer<typeof FaqItem>;
export type FaqList = z.infer<typeof FaqList>;
