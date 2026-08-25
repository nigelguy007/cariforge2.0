// @polsia:user-owned — shared zod contract for the Lead resource. One source
// of truth shared between the POST /api/leads handler (server) and the
// <BriefIntakeForm/> island (client). Keep this module client-importable:
// zod only, no server-only imports.

import { z } from 'zod';

export const LeadCreate = z.object({
  brief: z
    .string()
    .trim()
    .min(20, 'Brief is too short — give us at least one sentence.')
    .max(500, 'Brief is too long — please cap at 500 characters.'),
  email: z
    .union([z.string().email('That email looks off.'), z.literal('')])
    .optional()
    .transform((v) => (v ? v : undefined)),
});

export const LeadItem = LeadCreate.extend({
  id: z.string(),
  createdAt: z.string(), // ISO-8601 from the server; client parses as a string
  notified: z.boolean(), // true iff owner-email send succeeded
});

export type LeadCreate = z.infer<typeof LeadCreate>;
export type LeadItem = z.infer<typeof LeadItem>;

// ────────────────────────────────────────────────────────────────────────────
// Admin leads dashboard — read-only view used by /admin/leads (server route +
// client island). Same single-source-of-truth rule: this contract is the
// boundary both sides parse against. Status values come from the RunStatus
// enum in prisma/schema/council-runs.prisma. `null` means no row exists for
// the lead yet (kicks not wired up).

export const RunStatusValues = ['Pending', 'Running', 'Succeeded', 'Failed', 'WalkedAway'] as const;
export const VerdictValues = ['Build', 'TestFirst', 'WalkAway'] as const;

export type RunStatus = (typeof RunStatusValues)[number];
export type Verdict = (typeof VerdictValues)[number];

export const LeadListItem = z.object({
  id: z.string(),
  brief: z.string(),
  email: z.string().nullable(),
  createdAt: z.string(),
  notified: z.boolean(),
  // Funnel discriminator ('home' = front-door brief, 'walkthrough' =
  // procurement-grade form, 'newsletter' = blog email-capture waitlist).
  // Nullable because legacy rows pre-dating the column were 'home' in spirit.
  source: z.enum(['home', 'walkthrough', 'newsletter']).nullable(),
  // JSON-encoded structured fields for non-brief flows (e.g. walkthrough carries
  // { fullName, organisation, role, segment }). The admin table parses this
  // out for the payload-derived sub-line; the CSV export flattens it into
  // dedicated columns. Front-door briefs leave this null.
  payload: z.string().nullable(),
  // Free-text operator note (admin-owned). New column on Lead — null when the
  // operator hasn't filled it in yet. PATCH /api/admin/leads/notes writes this.
  notes: z.string().nullable(),
  // Latest council-run status for this lead (null = no kick yet). When present
  // the row also carries that run's verdict (Build / TestFirst / WalkAway) so
  // the admin can see the council's ruling without paging into a separate run.
  councilRunStatus: z.enum(RunStatusValues).nullable(),
  councilRunVerdict: z.enum(VerdictValues).nullable(),
});

export const LeadList = z.object({
  items: z.array(LeadListItem),
});

export type LeadListItem = z.infer<typeof LeadListItem>;
export type LeadList = z.infer<typeof LeadList>;

// ────────────────────────────────────────────────────────────────────────────
// Filter contract for /admin/leads (server applies it on read + CSV export;
// client island serialises it into the URL). 'all' is the default; the server
// ignores it for the SQL query and the CSV exporter strips it so the default
// filename stays clean.

export const LEAD_TYPE_VALUES = ['all', 'home', 'walkthrough', 'newsletter'] as const;
export const LEAD_SEGMENT_VALUES = [
  'all',
  'Financial services',
  'Insurance',
  'Public sector',
  'Health',
  'Other',
] as const;

export const LeadsFilter = z.object({
  type: z.enum(LEAD_TYPE_VALUES).default('all'),
  segment: z.enum(LEAD_SEGMENT_VALUES).default('all'),
});

export type LeadsFilter = z.infer<typeof LeadsFilter>;
export type LeadTypeFilter = z.infer<typeof LeadsFilter>['type'];
export type LeadSegmentFilter = z.infer<typeof LeadsFilter>['segment'];

// Build a `?type=…&segment=…` query string from the parsed filter. Drops
// 'all' entries so the default URL is empty and the default CSV filename
// stays "leads-YYYY-MM-DD.csv" (no churn from knob state).
export function leadsFilterToQuery(filter: LeadsFilter): string {
  const parts: string[] = [];
  if (filter.type !== 'all') parts.push(`type=${encodeURIComponent(filter.type)}`);
  if (filter.segment !== 'all') parts.push(`segment=${encodeURIComponent(filter.segment)}`);
  return parts.length > 0 ? `?${parts.join('&')}` : '';
}

// PATCH /api/admin/leads/notes body — operator-edits a single row's free-text
// note. Empty string normalises to null so blanking a note kills the row,
// not the visible dashed placeholder.
export const LeadNotesUpdate = z.object({
  id: z.string().min(1),
  notes: z
    .string()
    .max(2000, 'Note is too long — please cap at 2000 characters.')
    .transform((v) => (v.trim().length === 0 ? null : v)),
});

export type LeadNotesUpdate = z.infer<typeof LeadNotesUpdate>;

// Response envelope for the notes PATCH.
export const LeadNotesUpdateResponse = z.object({
  ok: z.literal(true),
  item: LeadListItem,
});

export type LeadNotesUpdateResponse = z.infer<typeof LeadNotesUpdateResponse>;

// Human-readable segment label — mirrors the values emitted by
// `WalkthroughSegment` in src/lib/contracts/walkthrough.ts so admin copy and
// procurement-grade form copy can't drift. The keys match what walkthrough
// rows store in Lead.payload.segment verbatim.
export const LEAD_SEGMENT_LABELS = LEAD_SEGMENT_VALUES;
