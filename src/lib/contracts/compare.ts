// @polsia:user-owned — shared zod contract for the /compare resource. One
// source of truth shared between the GET /api/compare handler (server) and the
// <CompareMatrix/> island (client). Static catalog copy for the procurement
// evaluation page: six vendors (CARI Forge plus five AI-build platforms named
// in the brief) × five criteria the brief calls out (council of specialist
// advisors, named human approver gate, recorded dissent preserved, EU AI Act
// Articles 12/14 readiness, scaffold-not-product honesty claim), with
// research notes and a disclaimer. Keep client-importable: zod only, no
// server-only imports.

import { z } from 'zod';

export const Vendor = z.object({
  /** Stable id used to index cells/notes. Lowercase, kebab-friendly. */
  id: z.string().min(1),
  /** Short display label in the table row, e.g. 'CARI Forge'. */
  name: z.string().min(1),
  /** Full descriptor used for accessibility / hover, e.g. 'CARI Forge (subject)'. */
  fullName: z.string().min(1),
  /** Vendor URL (when known). Optional while research is still being captured. */
  url: z.string().url().optional(),
});

export const Criterion = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  /** What the criterion actually measures — surfaced verbatim under the matrix. */
  whatWeLookFor: z.string().min(1),
});

export const Rating = z.enum(['stronger', 'comparable', 'weaker', 'unknown']);

export const Cell = z.object({
  vendorId: z.string().min(1),
  criterionId: z.string().min(1),
  rating: Rating,
  /** Plain-language claim for this (vendor, criterion) cell. */
  statement: z.string().min(1),
  /** Optional nuance that does not fit on the chip line. */
  commentary: z.string().min(1).optional(),
  /** Source ids from the parent `sources[]` that back the cell's claim. */
  sourceIds: z.array(z.string().min(1)),
});

export const Source = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  href: z.string().url(),
  /** ISO date the source was consulted, optional. */
  accessedAt: z.string().min(1).optional(),
  /** What the source backs — e.g. cells, or one specific criterion id. */
  usedFor: z.array(z.string().min(1)).optional(),
});

export const Note = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  body: z.string().min(1),
  sourceIds: z.array(z.string().min(1)),
});

export const Compare = z.object({
  vendors: z.array(Vendor).length(6),
  criteria: z.array(Criterion).length(5),
  cells: z.array(Cell),
  sources: z.array(Source),
  notes: z.array(Note),
  /** Surfaced verbatim above the matrix so a procurement reader sees it first. */
  disclaimer: z.string().min(1),
});

export type Vendor = z.infer<typeof Vendor>;
export type Criterion = z.infer<typeof Criterion>;
export type Rating = z.infer<typeof Rating>;
export type Cell = z.infer<typeof Cell>;
export type Source = z.infer<typeof Source>;
export type Note = z.infer<typeof Note>;
export type Compare = z.infer<typeof Compare>;
