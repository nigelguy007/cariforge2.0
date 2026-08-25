// @polsia:user-owned — shared zod contract for the /how-the-council-works
// resource. One source of truth shared between the GET /api/council handler
// (server) and the <CouncilDetail/> island (client). Static catalog copy for
// the depth page covering three mechanics: the five advisor roles, the
// chairman ruling logic, and the tie-back-to-human rule. Keep
// client-importable: zod only, no server-only imports.

import { z } from 'zod';

export const Advisor = z.object({
  id: z.string().min(1),
  ordinal: z.number().int().min(1).max(5),
  role: z.string().min(1),
  roleLong: z.string().min(1),
  argues: z.string().min(1),
  dissent: z.string().min(1),
  default: z.enum(['Objection', 'Supports', 'Qualifies']),
  quote: z.string().min(1),
});

export const Chairmanship = z.object({
  id: z.string().min(1),
  ordinal: z.number().int().min(1).max(3),
  verdict: z.enum(['Build', 'Test first', 'Walk away']),
  whatItMeans: z.string().min(1),
  dissentRecordedAs: z.string().min(1),
});

export const Tiebreak = z.object({
  id: z.string().min(1),
  ordinal: z.number().int().min(1),
  rule: z.string().min(1),
  mechanism: z.string().min(1),
  whoSigns: z.string().min(1),
  whatTheyAttach: z.string().min(1),
  appliesTo: z.string().min(1),
});

export const CouncilDetail = z.object({
  advisors: z.array(Advisor).length(5),
  chairmanship: z.array(Chairmanship).length(3),
  tiebreak: z.array(Tiebreak).min(3),
});

export type Advisor = z.infer<typeof Advisor>;
export type Chairmanship = z.infer<typeof Chairmanship>;
export type Tiebreak = z.infer<typeof Tiebreak>;
export type CouncilDetail = z.infer<typeof CouncilDetail>;
