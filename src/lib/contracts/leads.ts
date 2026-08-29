// @polsia:user-owned — shared zod contract for the Lead resource. One source
// of truth shared between the POST /api/leads handler (server) and the
// <BriefIntakeForm/> island (client). Keep this module client-importable:
// zod only, no server-only imports.

import { z } from 'zod';

export const LeadCreate = z.object({
  // Was capped at 500 chars when this field was framed as a literal
  // "one-line brief" — it's the actual requirements-capture area (what do
  // you want to build using AI?), so it needs room for a real paragraph or
  // two, not a single sentence. 20 chars stays the floor (still rules out
  // empty/junk submissions); 4000 is generous enough for a genuine
  // requirements writeup without inviting a full document dump — see
  // brief-intake-form.tsx for the (pending) file-attachment path for
  // anything longer than that.
  brief: z
    .string()
    .trim()
    .min(20, 'Tell us a bit more — at least one full sentence.')
    .max(
      4000,
      'That’s a lot of detail — please cap it at 4000 characters, or attach it as a document instead.',
    ),
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
// Lead attachment — one optional document per brief, stored directly in
// Postgres (LeadAttachment.data, bytea) rather than a separate file-storage
// provider. No new infrastructure needed at pilot scale.

// Hard cap, enforced both client-side (fail fast, no wasted upload) and
// server-side (the only cap that actually matters). 4 MiB stays safely under
// Vercel's serverless function request-body limit (4.5 MB) with headroom for
// multipart overhead and the rest of the form fields.
export const MAX_ATTACHMENT_BYTES = 4 * 1024 * 1024;

// Deliberately narrow: document formats a regulated buyer would plausibly
// attach to a requirements brief. No executables, no archives (a zip could
// smuggle anything past this check), no raw HTML/SVG (XSS if ever rendered
// inline). Extend this list deliberately, not by widening it to '*/*'.
export const ALLOWED_ATTACHMENT_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  'text/plain',
  'text/csv',
  'image/png',
  'image/jpeg',
] as const;

export const LeadAttachmentMeta = z.object({
  id: z.string(),
  filename: z.string(),
  mimeType: z.string(),
  sizeBytes: z.number().int(),
  createdAt: z.string(),
});

export type LeadAttachmentMeta = z.infer<typeof LeadAttachmentMeta>;

// Cosmetic, buyer-facing reference derived from the lead's cuid — the raw id
// (e.g. "cmtc51g2u0001js04r455be7k") is a database primary key, not something
// a regulated buyer should have to read back over email. This is
// deterministic (same id -> same code every time) and NOT a separate stored
// value, so no migration is needed and support can always recompute it from
// the id in the leads table. Not cryptographically unique on its own — for
// pilot volumes an 8-char slice of a cuid is plenty; revisit if collisions
// ever matter (e.g. add a dedicated indexed column) at higher volume.
export function friendlyLeadReference(id: string): string {
  const clean = id.replace(/[^a-z0-9]/gi, '').toUpperCase();
  const tail = clean.length >= 8 ? clean.slice(-8) : clean.padStart(8, '0');
  return `CF-${tail.slice(0, 4)}-${tail.slice(4, 8)}`;
}

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
  // True iff a document was attached via POST /api/leads/[id]/attachment —
  // existence only, never the bytes. GET /api/admin/leads/[id]/attachment
  // downloads it.
  hasAttachment: z.boolean(),
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

// === Open briefs (UX review C1, wireframe v2) ===============================
// A signed-in user's own submitted briefs that haven't been converted into a
// mission yet — matched by the session email server-side, surfaced on the
// dashboard as a conversion card so the CF reference finally goes somewhere.

export const OpenBriefItem = z.object({
  id: z.string(),
  reference: z.string(), // friendlyLeadReference(id) — the CF-XXXX-XXXX shown at submission
  brief: z.string(),
  createdAt: z.string(),
  hasAttachment: z.boolean(),
});
export type OpenBriefItem = z.infer<typeof OpenBriefItem>;

export const OpenBriefList = z.object({ items: z.array(OpenBriefItem) });
export type OpenBriefList = z.infer<typeof OpenBriefList>;
