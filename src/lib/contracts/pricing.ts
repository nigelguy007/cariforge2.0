// @polsia:user-owned — shared zod contract for the pricing resource. One
// source of truth shared between the GET /api/pricing handler (server) and
// the <PricingTiers/> island (client). Keep client-importable: zod only,
// no server-only imports.

import { z } from 'zod';

export const PricingTier = z.object({
  id: z.string(),
  ordinal: z.number().int().min(1),
  name: z.string().min(1),
  tagline: z.string().min(1),
  summary: z.string().min(1),
  inclusions: z.array(z.string().min(1)).min(1),
});

export const PricingTiers = z.object({
  items: z.array(PricingTier),
});

export type PricingTier = z.infer<typeof PricingTier>;
export type PricingTiers = z.infer<typeof PricingTiers>;
