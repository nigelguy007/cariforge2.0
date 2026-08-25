// @polsia:user-owned — GET /api/compare. Static catalog copy for the
// /compare procurement evaluation page: six vendors (CARI Forge plus five
// AI-build platforms named in the brief) × five criteria named in the
// brief. Served from an in-process `as const` constant with no DB read and
// no auth gate — the page is public procurement content, not per-user.
// The route still parses through the shared Compare contract so the page
// can rely on the same shape on both ends of the wire.
//
// Honest framing: only the CARI Forge (subject) row carries a populated
// `rating` and citation — its claims are drawn from cariforge.com's own
// published pages. All competitor cells intentionally render `rating:
// "unknown"` and a verbatim "research not yet captured" statement until
// third-party sources are reviewed and added; the plan explicitly bans
// fabricated ratings.

import 'server-only';
import { NextResponse } from 'next/server';
import { Compare } from '@/lib/contracts/compare';

export const dynamic = 'force-dynamic';

const VENDORS = [
  {
    id: 'cari',
    name: 'CARI Forge',
    fullName: 'CARI Forge (subject)',
    url: 'https://cari-forge.com',
  },
  {
    id: 'forge',
    name: 'FORGE',
    fullName: 'FORGE (AI-build platform)',
  },
  {
    id: 'archforge',
    name: 'ARCHFORGE',
    fullName: 'ARCHFORGE',
  },
  {
    id: 'opseraforge',
    name: 'Opsera Forge',
    fullName: 'Opsera Forge',
    url: 'https://www.opsera.io',
  },
  {
    id: 'itmethodsforge',
    name: 'iTmethods Forge',
    fullName: 'iTmethods Forge',
    url: 'https://www.itmethods.com',
  },
  {
    id: 'eccouncil-adg',
    name: 'EC-Council ADG',
    fullName: 'EC-Council AI Defence & Governance (ADG)',
    url: 'https://www.eccouncil.org',
  },
] as const;

const CRITERIA = [
  {
    id: 'council-of-specialist-advisors',
    label: 'Council of specialist advisors',
    whatWeLookFor:
      'A typed multi-agent council with opposing defaults, where each advisor is bound to a fixed remit (e.g. risk, demand, growth, competition, money) and opens dissent first rather than rubber-stamping the brief.',
  },
  {
    id: 'named-human-approver-gate',
    label: 'Named human approver gate',
    whatWeLookFor:
      'Every stage advance — not just the chair tiebreak — requires a named human (not a generic "approver" role) to attach a typed reason before the run moves forward.',
  },
  {
    id: 'recorded-dissent-preserved',
    label: 'Recorded dissent preserved',
    whatWeLookFor:
      'Unresolved objections are appended verbatim into the case file with dissenting voice named by role and timestamp attached, rather than averaged away or silently dropped at the next gate.',
  },
  {
    id: 'eu-ai-act-1214-readiness',
    label: 'EU AI Act Articles 12/14 readiness',
    whatWeLookFor:
      'The record-keeping (Article 12) and effective human oversight (Article 14) expectations are produced as a by-product of the work, with timestamped approval records per stage rather than as a separate post-hoc logging layer.',
  },
  {
    id: 'scaffold-not-product-honesty',
    label: 'Scaffold-not-product honesty claim',
    whatWeLookFor:
      'The vendor publishes a plain list of what the deliverable does NOT cover (no production hosting, no uptime SLA, no 24/7 support, no automated customer-facing login) and tracks that exact wording across pricing and FAQ pages.',
  },
] as const;

const NOT_CAPTURED_STMT =
  'Research not yet captured — no public source verified for this cell in this run. The criterion is listed so the matrix is complete; the cell intentionally renders a flat "unknown" rather than a guessed rating.';

const CELLS = [
  // CARI Forge (subject) — first-party claims drawn from cariforge.com.
  {
    vendorId: 'cari',
    criterionId: 'council-of-specialist-advisors',
    rating: 'comparable',
    statement:
      'Five typed advisors (Risk, Demand, Growth, Competition, Money) with opposing defaults — Objection / Supports / Qualifies. The chairman rules only after at least two opposing voices have weighed in on the same point.',
    commentary:
      'Drawn from cariforge.com’s /how-the-council-works page, which names the five-agent council and the chairman’s three-ruling logic by role.',
    sourceIds: ['cari:how-the-council-works', 'cari:sample-brief'],
  },
  {
    vendorId: 'cari',
    criterionId: 'named-human-approver-gate',
    rating: 'comparable',
    statement:
      'A single named human approver is attached to the case file from intake, and signs every stage gate — Approve, Return, or Refuse — with a typed reason recorded verbatim before any next stage begins.',
    commentary:
      'The rule applies to all five stages (Need Discovery → Readiness Review → Workflow Design → Governance Check → Software Build), not only the chair’s tiebreak.',
    sourceIds: ['cari:how-the-council-works', 'cari:sample-brief'],
  },
  {
    vendorId: 'cari',
    criterionId: 'recorded-dissent-preserved',
    rating: 'comparable',
    statement:
      'Any dissenting advisor’s written objection is appended verbatim into the case file as a timestamped dissent record — dissenting voice named by role — before the forge advances the case to the next stage.',
    commentary:
      'Unresolved objections are appended at every stage advance, not dropped. The chairman never averages a contested point; averaging is structurally unavailable as a ruling shape.',
    sourceIds: ['cari:how-the-council-works', 'cari:faq'],
  },
  {
    vendorId: 'cari',
    criterionId: 'eu-ai-act-1214-readiness',
    rating: 'comparable',
    statement:
      'Articles 12 (record-keeping) and 14 (effective human oversight) reach high-risk systems from 2 August 2026. CARI Forge’s pipeline is shaped for them — every stage emits a timestamped, named-human approval record by design.',
    commentary:
      'The Public Sector tier at /pricing adds an Articles 12 & 14 readiness memo and supplementary evidentiary artefacts to the procurement evidence package.',
    sourceIds: ['cari:faq', 'cari:pricing'],
  },
  {
    vendorId: 'cari',
    criterionId: 'scaffold-not-product-honesty',
    rating: 'comparable',
    statement:
      'CARI Forge publishes an explicit list of what is NOT covered (no production hosting, no uptime SLA, no 24/7 support, no automated customer-facing login, no liability for downstream deployment) at /why-this-is-a-scaffold, and tracks that exact wording at /pricing and the FAQ.',
    sourceIds: ['cari:why-this-is-a-scaffold', 'cari:pricing', 'cari:faq'],
  },

  // FORGE — research not yet captured
  {
    vendorId: 'forge',
    criterionId: 'council-of-specialist-advisors',
    rating: 'unknown',
    statement: NOT_CAPTURED_STMT,
    sourceIds: [],
  },
  {
    vendorId: 'forge',
    criterionId: 'named-human-approver-gate',
    rating: 'unknown',
    statement: NOT_CAPTURED_STMT,
    sourceIds: [],
  },
  {
    vendorId: 'forge',
    criterionId: 'recorded-dissent-preserved',
    rating: 'unknown',
    statement: NOT_CAPTURED_STMT,
    sourceIds: [],
  },
  {
    vendorId: 'forge',
    criterionId: 'eu-ai-act-1214-readiness',
    rating: 'unknown',
    statement: NOT_CAPTURED_STMT,
    sourceIds: [],
  },
  {
    vendorId: 'forge',
    criterionId: 'scaffold-not-product-honesty',
    rating: 'unknown',
    statement: NOT_CAPTURED_STMT,
    sourceIds: [],
  },

  // ARCHFORGE — research not yet captured
  {
    vendorId: 'archforge',
    criterionId: 'council-of-specialist-advisors',
    rating: 'unknown',
    statement: NOT_CAPTURED_STMT,
    sourceIds: [],
  },
  {
    vendorId: 'archforge',
    criterionId: 'named-human-approver-gate',
    rating: 'unknown',
    statement: NOT_CAPTURED_STMT,
    sourceIds: [],
  },
  {
    vendorId: 'archforge',
    criterionId: 'recorded-dissent-preserved',
    rating: 'unknown',
    statement: NOT_CAPTURED_STMT,
    sourceIds: [],
  },
  {
    vendorId: 'archforge',
    criterionId: 'eu-ai-act-1214-readiness',
    rating: 'unknown',
    statement: NOT_CAPTURED_STMT,
    sourceIds: [],
  },
  {
    vendorId: 'archforge',
    criterionId: 'scaffold-not-product-honesty',
    rating: 'unknown',
    statement: NOT_CAPTURED_STMT,
    sourceIds: [],
  },

  // Opsera Forge — research not yet captured
  {
    vendorId: 'opseraforge',
    criterionId: 'council-of-specialist-advisors',
    rating: 'unknown',
    statement: NOT_CAPTURED_STMT,
    sourceIds: [],
  },
  {
    vendorId: 'opseraforge',
    criterionId: 'named-human-approver-gate',
    rating: 'unknown',
    statement: NOT_CAPTURED_STMT,
    sourceIds: [],
  },
  {
    vendorId: 'opseraforge',
    criterionId: 'recorded-dissent-preserved',
    rating: 'unknown',
    statement: NOT_CAPTURED_STMT,
    sourceIds: [],
  },
  {
    vendorId: 'opseraforge',
    criterionId: 'eu-ai-act-1214-readiness',
    rating: 'unknown',
    statement: NOT_CAPTURED_STMT,
    sourceIds: [],
  },
  {
    vendorId: 'opseraforge',
    criterionId: 'scaffold-not-product-honesty',
    rating: 'unknown',
    statement: NOT_CAPTURED_STMT,
    sourceIds: [],
  },

  // iTmethods Forge — research not yet captured
  {
    vendorId: 'itmethodsforge',
    criterionId: 'council-of-specialist-advisors',
    rating: 'unknown',
    statement: NOT_CAPTURED_STMT,
    sourceIds: [],
  },
  {
    vendorId: 'itmethodsforge',
    criterionId: 'named-human-approver-gate',
    rating: 'unknown',
    statement: NOT_CAPTURED_STMT,
    sourceIds: [],
  },
  {
    vendorId: 'itmethodsforge',
    criterionId: 'recorded-dissent-preserved',
    rating: 'unknown',
    statement: NOT_CAPTURED_STMT,
    sourceIds: [],
  },
  {
    vendorId: 'itmethodsforge',
    criterionId: 'eu-ai-act-1214-readiness',
    rating: 'unknown',
    statement: NOT_CAPTURED_STMT,
    sourceIds: [],
  },
  {
    vendorId: 'itmethodsforge',
    criterionId: 'scaffold-not-product-honesty',
    rating: 'unknown',
    statement: NOT_CAPTURED_STMT,
    sourceIds: [],
  },

  // EC-Council ADG — research not yet captured
  {
    vendorId: 'eccouncil-adg',
    criterionId: 'council-of-specialist-advisors',
    rating: 'unknown',
    statement: NOT_CAPTURED_STMT,
    sourceIds: [],
  },
  {
    vendorId: 'eccouncil-adg',
    criterionId: 'named-human-approver-gate',
    rating: 'unknown',
    statement: NOT_CAPTURED_STMT,
    sourceIds: [],
  },
  {
    vendorId: 'eccouncil-adg',
    criterionId: 'recorded-dissent-preserved',
    rating: 'unknown',
    statement: NOT_CAPTURED_STMT,
    sourceIds: [],
  },
  {
    vendorId: 'eccouncil-adg',
    criterionId: 'eu-ai-act-1214-readiness',
    rating: 'unknown',
    statement: NOT_CAPTURED_STMT,
    sourceIds: [],
  },
  {
    vendorId: 'eccouncil-adg',
    criterionId: 'scaffold-not-product-honesty',
    rating: 'unknown',
    statement: NOT_CAPTURED_STMT,
    sourceIds: [],
  },
] as const;

const SOURCES = [
  {
    id: 'cari:how-the-council-works',
    label: 'CARI Forge — How the council works',
    href: 'https://cari-forge.com/how-the-council-works',
    accessedAt: '2026-08-23',
    usedFor: ['cari:council-of-specialist-advisors', 'cari:named-human-approver-gate'],
  },
  {
    id: 'cari:sample-brief',
    label: 'CARI Forge — Sample brief (worked case file)',
    href: 'https://cari-forge.com/sample-brief',
    accessedAt: '2026-08-23',
    usedFor: ['cari:council-of-specialist-advisors', 'cari:named-human-approver-gate'],
  },
  {
    id: 'cari:why-this-is-a-scaffold',
    label: 'CARI Forge — Why this is a scaffold, not a product',
    href: 'https://cari-forge.com/why-this-is-a-scaffold',
    accessedAt: '2026-08-23',
    usedFor: ['cari:scaffold-not-product-honesty'],
  },
  {
    id: 'cari:pricing',
    label: 'CARI Forge — Three engagement tiers',
    href: 'https://cari-forge.com/pricing',
    accessedAt: '2026-08-23',
    usedFor: ['cari:eu-ai-act-1214-readiness', 'cari:scaffold-not-product-honesty'],
  },
  {
    id: 'cari:faq',
    label: 'CARI Forge — FAQ (Articles 12 & 14; scaffold-vs-product)',
    href: 'https://cari-forge.com/faq',
    accessedAt: '2026-08-23',
    usedFor: [
      'cari:recorded-dissent-preserved',
      'cari:eu-ai-act-1214-readiness',
      'cari:scaffold-not-product-honesty',
    ],
  },
] as const;

const NOTES = [
  {
    id: 'scope-of-this-run',
    title: 'Scope of this matrix in the current run.',
    body: 'The brief expected a five-criteria × six-vendors evaluation matrix populated from completed comparative research. In this run only the CARI Forge row carries a populated cell: its claims are drawn from cariforge.com\'s own published pages, and the citations point at those pages. Every competitor cell intentionally renders the rating "unknown" with a "research not yet captured" line rather than a guessed rating — fabrication would make the page a procurement liability, not an asset. Where a competitor is genuinely stronger on a row in a future run, this matrix will say so with a link. Each empty Cell is a labelled gap to fill, not a silent assumption.',
    sourceIds: [],
  },
] as const;

const DISCLAIMER =
  'This matrix is a CARI Forge-side view, not a third-party audit. Sources cited inline. Where a competitor is genuinely stronger on a row, the row says so with a link. Where research is not yet captured, the cell reads "unknown" rather than a guessed rating.';

export async function GET() {
  return NextResponse.json(
    Compare.parse({
      vendors: VENDORS,
      criteria: CRITERIA,
      cells: CELLS,
      sources: SOURCES,
      notes: NOTES,
      disclaimer: DISCLAIMER,
    }),
  );
}
