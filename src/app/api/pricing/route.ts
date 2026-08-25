// @polsia:user-owned — GET /api/pricing. Static catalog of inquiry-only
// engagement tiers, served from an in-process constant. The page goes
// through this handler anyway because the project rule bans data-fetch in
// Server Components, and a client `apiFetch('/api/pricing')` keeps the
// contract shape consistent with every other resource.

import 'server-only';
import { NextResponse } from 'next/server';
import { PricingTiers } from '@/lib/contracts/pricing';

const PRICING = [
  {
    id: 'pilot',
    ordinal: 1,
    name: 'Pilot',
    tagline: 'One brief. One council. One Software Build.',
    summary:
      'A single, contained engagement: one one-line brief, one council ruling, one runnable Software Build.',
    inclusions: [
      'One one-line brief, captured verbatim into the case file before any code is written.',
      'One full council reading — five advisor voices, opposing defaults, and a chairman ruling.',
      'The five-stage pipeline (Need Discovery → Readiness Review → Workflow Design → Governance Check → Software Build) with one named human approval per stage.',
      'The audit-trail bundle per run: verbatim brief, debate transcript, chairman ruling, named human gate decision, Software Build receipt — persisted as a SHA-256 hash chain.',
      'A runnable Next.js + TypeScript Software Build you can ship from a fresh repo.',
      'A 90-day retention minimum on every artefact, exportable on request as a single signed JSON.',
    ],
  },
  {
    id: 'procurement',
    ordinal: 2,
    name: 'Procurement',
    tagline: 'A programme of briefs, one evidence package.',
    summary:
      'For a procurement programme with multiple briefs and a single, consolidated evidence package at the end.',
    inclusions: [
      'Everything in Pilot, applied per brief within the programme.',
      'A consolidated evidence package across briefs: a cross-case audit-trail bundle with a case-by-case hash chain, so the programme is one signed artefact at handover.',
      'Per-stage human approvals across the whole programme, each named and recorded with a typed reason — so a single officer can re-trace any decision without paging the team.',
      'A reporting cadence tailored to the procurement timeline, so the evidence is ready when the buyer is, not weeks after.',
      'A handover note naming the named humans who would own the next phase beyond Software Build receipt.',
    ],
  },
  {
    id: 'public-sector',
    ordinal: 3,
    name: 'Public Sector',
    tagline: 'For timelines that span quarters, not weeks.',
    summary:
      'For longer procurement timelines and additional evidentiary artefacts a compliance officer expects but the council does not produce by default.',
    inclusions: [
      'Everything in Procurement.',
      "An extended-timeline posture: a longer pre-build review cycle, and return-and-revise at each gate without a fee penalty — so the work proceeds at the buyer's pace, not ours.",
      'An explicit Articles 12 & 14 readiness memo attached at the readiness stage, written in the same shape the audit officer will compare it against.',
      'A typed reasons log per gate decision, distinct from the audit trail, so the rationale for each approve / return / refuse is reviewable separately from the artefact chain.',
      "Supplementary evidentiary artefacts the council would not produce otherwise — produced to the buyer's specification rather than our default.",
      'A handover note that names the named humans for the next phase, written for a public-sector handover rather than a private-sector one.',
    ],
  },
] as const;

export async function GET() {
  return NextResponse.json(PricingTiers.parse({ items: PRICING }));
}
