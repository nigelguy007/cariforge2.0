// @polsia:user-owned — shared zod contract for the /compare resource. One
// source of truth shared between the GET /api/compare handler (server) and the
// <CompareMatrix/> island (client). Static catalog copy: the categories of
// alternative a Caribbean buyer actually weighs (global consultancies, AI
// governance platforms, agent builders, general AI assistants), named
// examples of each, and where each falls short, plus the CariForge row.
// Positions are CariForge's own assessment. Keep client-importable: zod only,
// no server-only imports.

import { z } from 'zod';

export const Alternative = z.object({
  /** Stable id, lowercase, kebab-friendly. */
  id: z.string().min(1),
  /** Category of alternative, e.g. 'AI governance platforms'. */
  category: z.string().min(1),
  /** Named examples of the category, as one display line. */
  examples: z.string().min(1),
  /** Where the category falls short for a Caribbean buyer (or, for the
   *  subject row, what CariForge offers instead). */
  position: z.string().min(1),
  /** True only for the CariForge row. */
  isSubject: z.boolean(),
});

export const Compare = z.object({
  rows: z.array(Alternative).min(2),
  /** Surfaced verbatim with the table so a reader sees it first. */
  disclaimer: z.string().min(1),
});

export type Alternative = z.infer<typeof Alternative>;
export type Compare = z.infer<typeof Compare>;
