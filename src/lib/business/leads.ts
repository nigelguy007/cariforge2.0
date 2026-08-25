// @polsia:user-owned — server-side reads/csv for the admin leads dashboard.
// Called from /api/admin/leads and /api/admin/leads/export — never from a page
// or client component. `import 'server-only'` is enforced by the file's import
// below; callers in the public (client) layer would otherwise break the build.

import 'server-only';
import {
  type LeadList,
  type LeadListItem,
  LeadListItem as LeadListItemSchema,
  type LeadsFilter,
  type RunStatus,
  type Verdict,
} from '@/lib/contracts/leads';
import { prisma } from '@/lib/db';

// Source-string normalisation shared by the read + export paths. The DB stores
// an open-ended TEXT column (legacy callers wrote free-form); the contract pins
// it to a 3-value enum. Anything else is normalised to 'home'.
function normaliseSource(raw: string | null | undefined): 'home' | 'walkthrough' | 'newsletter' {
  if (raw === 'walkthrough') return 'walkthrough';
  if (raw === 'newsletter') return 'newsletter';
  return 'home';
}

// Two-step read per nextjs-prisma: Lead and CouncilRun are both user-owned
// models, so we cannot use Prisma's @relation between them. Read Leads first,
// then a single findMany against CouncilRun grouped by leadId, then map them
// by leadId in JS. CouncilRun.leadId has an index already.
//
// `filter` narrows the result set — type maps cleanly to a `source` value,
// but segment is parsed out of the JSON `payload` (Prisma has no type-safe
// JSON path filter here, so a JS pass keeps the WHERE simple and the
// implementation obviously correct at ≤thousands of rows; revisit — e.g.
// denormalise segment into a typed column — if volume grows past that line).
export async function listLeadsForAdmin(
  filter: LeadsFilter = { type: 'all', segment: 'all' },
): Promise<LeadList> {
  const where: { source?: 'home' | 'walkthrough' | 'newsletter' } = {};
  if (filter.type !== 'all') {
    where.source = filter.type;
  }
  const leads = await prisma.lead.findMany({
    where: Object.keys(where).length > 0 ? where : undefined,
    orderBy: { createdAt: 'desc' },
  });
  if (leads.length === 0) {
    return { items: [] };
  }

  // Segment filter is applied in JS: parse the payload (when present) and
  // drop rows whose `segment` doesn't match. Only walkthrough rows carry
  // segment in their payload, so for the home + newsletter rows this is a
  // no-op (their parsed segment is undefined then filtered out anyway).
  const filtered =
    filter.segment === 'all'
      ? leads
      : leads.filter((lead) => parseSegment(lead.payload) === filter.segment);

  if (filtered.length === 0) {
    return { items: [] };
  }

  const leadIds = filtered.map((l) => l.id);
  const runs = await prisma.councilRun.findMany({
    where: { leadId: { in: leadIds } },
    orderBy: { startedAt: 'desc' },
  });

  // Map the latest run per leadId. Runs arrive newest-first from the query
  // above so the FIRST hit per key wins via Map insertion order.
  const latestByLead = new Map<string, { status: RunStatus; verdict: Verdict | null }>();
  for (const run of runs) {
    if (latestByLead.has(run.leadId)) continue;
    latestByLead.set(run.leadId, {
      status: run.status as RunStatus,
      verdict: run.verdict as Verdict | null,
    });
  }

  const items: LeadListItem[] = filtered.map((lead) => {
    const latest = latestByLead.get(lead.id);
    const source = normaliseSource(lead.source);
    return {
      id: lead.id,
      brief: lead.brief,
      email: lead.email,
      createdAt: lead.createdAt.toISOString(),
      notified: lead.notifiedAt !== null,
      source,
      payload: lead.payload ?? null,
      notes: lead.notes ?? null,
      councilRunStatus: latest?.status ?? null,
      councilRunVerdict: latest?.verdict ?? null,
    };
  });

  return { items };
}

// Read the `segment` field out of the JSON payload — strict and forgiving
// enough that one bad row never breaks the whole read. Returns undefined
// when the row isn't a walkthrough.
function parseSegment(payload: string | null | undefined): string | undefined {
  if (!payload) return undefined;
  try {
    const parsed = JSON.parse(payload) as unknown;
    if (parsed && typeof parsed === 'object') {
      const segment = (parsed as Record<string, unknown>).segment;
      if (typeof segment === 'string') return segment;
    }
  } catch {
    // fall through to undefined — malformed payload is treated as no segment
  }
  return undefined;
}

// Persist an operator note on a single Lead row. Returns the canonical
// LeadListItem shape so the response stays one-source-of-truth. Throws
// Prisma P2025 when no row matches — the route handler maps that to a 404.
// Empty string has already been normalised to null by the contract.
export async function setLeadNotes(id: string, notes: string | null): Promise<LeadListItem> {
  const row = await prisma.lead.update({
    where: { id },
    data: { notes },
  });

  // Re-fetch the latest council run for the row so the returned item matches
  // the LeadList contract verbatim (admin table reconciles on this field).
  const latestRun = await prisma.councilRun.findFirst({
    where: { leadId: row.id },
    orderBy: { startedAt: 'desc' },
  });

  return LeadListItemSchema.parse({
    id: row.id,
    brief: row.brief,
    email: row.email,
    createdAt: row.createdAt.toISOString(),
    notified: row.notifiedAt !== null,
    source: normaliseSource(row.source),
    payload: row.payload ?? null,
    notes: row.notes ?? null,
    councilRunStatus: (latestRun?.status as RunStatus | undefined) ?? null,
    councilRunVerdict: (latestRun?.verdict as Verdict | null | undefined) ?? null,
  });
}

// CSV export. RFC 4180: wrap any field containing ", , \n, or \r in double
// quotes and double-up internal ". \r\n line endings (Excel-friendly). Spreadsheet
// apps and `cat` both parse this cleanly. Header row is human-readable, value
// rows preserve the rendered status (Notified · Succeeded (Build), Pending, …)
// so the CSV reads like the table.
//
// Column order is the original "table reads like the export" sequence — Notes
// is APPENDED LAST so existing spreadsheet templates that import by header
// keep binding correctly. Don't reorder the prefix.
export const LEADS_CSV_HEADERS = [
  'Submission date',
  'Type',
  'Full name',
  'Organisation',
  'Role',
  'Segment',
  'Brief',
  'Contact email',
  'Notified',
  'Council run status',
  'Verdict',
  'Notes',
] as const;

function escapeCsvField(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

interface WalkthroughFields {
  fullName?: string;
  organisation?: string;
  role?: string;
  segment?: string;
}

function parsePayload(item: LeadListItem): WalkthroughFields {
  if (!item.payload) return {};
  try {
    const parsed = JSON.parse(item.payload) as unknown;
    if (parsed && typeof parsed === 'object') {
      const out: WalkthroughFields = {};
      const p = parsed as Record<string, unknown>;
      if (typeof p.fullName === 'string') out.fullName = p.fullName;
      if (typeof p.organisation === 'string') out.organisation = p.organisation;
      if (typeof p.role === 'string') out.role = p.role;
      if (typeof p.segment === 'string') out.segment = p.segment;
      return out;
    }
  } catch {
    // ignore JSON parse errors — leave walkthrough columns blank for that row
  }
  return {};
}

export function leadToCsvRow(item: LeadListItem): string {
  const shortBrief = item.brief.length > 280 ? `${item.brief.slice(0, 277)}...` : item.brief;
  const councilCols = councilRunRender(item);
  const wf = item.source === 'walkthrough' ? parsePayload(item) : {};
  return [
    item.createdAt,
    item.source ?? 'home',
    wf.fullName ?? '',
    wf.organisation ?? '',
    wf.role ?? '',
    wf.segment ?? '',
    shortBrief,
    item.email ?? '',
    item.notified ? 'yes' : 'no',
    councilCols.status,
    councilCols.verdict,
    item.notes ?? '',
  ]
    .map(escapeCsvField)
    .join(',');
}

export function leadsToCsv(items: ReadonlyArray<LeadListItem>): string {
  const header = LEADS_CSV_HEADERS.join(',');
  const rows = items.map(leadToCsvRow).join('\r\n');
  return rows.length > 0 ? `${header}\r\n${rows}\r\n` : `${header}\r\n`;
}

// Render logic for the status column — reused by table + CSV so the export
// reads like the UI. Shown row text:
//
//   not notified:            "Not notified"
//   notified, no kick yet:   "Notified · Pending"
//   notified, mid-run:       "Notified · {Succeeded|Failed|...} ({Verdict?})"
//
// Verdict is appended in parens only when it is SET (Succeeded runs always
// rec on a verdict; Failed/WalkedAway may or may not).
function councilRunRender(item: LeadListItem): { status: string; verdict: string } {
  if (!item.councilRunStatus) {
    return { status: item.notified ? 'Notified · Pending' : 'Not notified', verdict: '' };
  }
  const status = item.councilRunStatus;
  const verdict = item.councilRunVerdict ? ` (${item.councilRunVerdict})` : '';
  return {
    status: `${item.notified ? 'Notified' : 'Submitted'} · ${status}${verdict}`,
    verdict: item.councilRunVerdict ?? '',
  };
}
