// @polsia:user-owned — /pricing. Server Component that exports metadata.
// The three inquiry-only tiers live in a single client island
// (<PricingTiers/>) that GETs /api/pricing and renders three styled cards.
// No data-fetch in the page body — server work is the static metadata
// export only. Each card's CTA anchors to the home page's brief intake
// form (`#how-it-works`) — there is no payment flow on this route.

import type { Metadata } from 'next';
import Link from 'next/link';
import { GlassCard, GlassPanel, GlassSectionHeader } from '@/components/custom/glass';
import { JsonLd } from '@/components/custom/json-ld';
import { PricingTiers } from '@/components/custom/pricing-tiers';
import { RoiCalculator } from '@/components/custom/roi-calculator';
import { organization } from '@/lib/jsonld';
import { siteName, siteUrl } from '@/lib/site';

export const metadata: Metadata = {
  title: { absolute: `Pricing — ${siteName}` },
  description:
    'Three inquiry-only engagement tiers: Pilot (one brief, one council, one Software Build), Procurement (a programme of briefs, one evidence package), and Public Sector (longer timelines, supplementary evidentiary artefacts). Each inquiry begins at the brief intake form.',
  alternates: { canonical: '/pricing' },
  openGraph: {
    title: `Pricing — ${siteName}`,
    description:
      'Three inquiry-only engagement tiers: Pilot (one brief, one council, one Software Build), Procurement (a programme of briefs, one evidence package), and Public Sector (longer timelines, supplementary evidentiary artefacts). Each inquiry begins at the brief intake form.',
    images: ['/opengraph-image'],
  },
};

const product = {
  '@context': 'https://schema.org',
  '@type': 'Product',
  name: 'CARI Forge Pilot',
  description:
    'One brief. One council. One Software Build. A single, contained engagement: one one-line brief, one council ruling, one runnable Next.js + TypeScript Software Build, with a five-stage pipeline (Need Discovery → Readiness Review → Workflow Design → Governance Check → Software Build) and a named human approval at every gate.',
  provider: { '@type': 'Organization', name: siteName, url: siteUrl },
  offers: [
    {
      '@type': 'Offer',
      name: 'Pilot',
      description:
        'One one-line brief, one council ruling, one runnable Software Build. Includes the audit-trail bundle per run, persisted as a SHA-256 hash chain, and a 90-day retention minimum on every artefact.',
      category: 'Engagement tier',
      availability: 'https://schema.org/PreOrder',
      eligibleCustomerType: 'https://schema.org/BusinessEntity',
      url: `${siteUrl}/pricing`,
    },
    {
      '@type': 'Offer',
      name: 'Procurement',
      description:
        'A programme of briefs with a consolidated evidence package at handover: a cross-case audit-trail bundle with a per-case hash chain, and a reporting cadence tailored to the procurement timeline.',
      category: 'Engagement tier',
      availability: 'https://schema.org/PreOrder',
      eligibleCustomerType: 'https://schema.org/BusinessEntity',
      url: `${siteUrl}/pricing`,
    },
    {
      '@type': 'Offer',
      name: 'Public Sector',
      description:
        'Extended-timeline posture with an explicit EU AI Act Articles 12 & 14 readiness memo, a typed reasons log per gate decision, and supplementary evidentiary artefacts produced to the buyer specification.',
      category: 'Engagement tier',
      availability: 'https://schema.org/PreOrder',
      eligibleCustomerType: 'https://schema.org/GovernmentOrganization',
      url: `${siteUrl}/pricing`,
    },
  ],
} as const;

export default function PricingPage() {
  return (
    <main id="main-content" className="flex flex-col">
      <JsonLd script={organization} />
      <JsonLd script={product} />
      <section className="section-lg relative overflow-hidden hero-aurora">
        <div className="container-page flex flex-col gap-10">
          <GlassSectionHeader
            eyebrow="Inquiry only — no payment flow at this stage"
            title="Three ways to commission a CARI Forge run."
            lede="Every tier is the same council, the same five-stage pipeline, and the same audit-trail evidence. What changes is the scope — one brief, a procurement programme, or a timeline that spans quarters. Each card below lists what is included; each inquiry begins at the same one-line brief form on the home page."
          />

          <PricingTiers />

          {/* ROI/feasibility calculator — Priority-12 item from the Aug
              2026 handoff doc. Pure arithmetic on visitor-supplied
              numbers, no AI call, nothing to fabricate — see
              src/lib/business/roi-calculator.ts. */}
          <GlassCard tone="panel" padding="lg" className="section-aurora">
            <GlassSectionHeader
              eyebrow="Before you commit"
              title="What's this worth, roughly, to the team doing it today?"
              lede="A quick, honest estimate — every number below comes directly from what you enter, not an industry benchmark CARI Forge has no basis to claim."
            />
            <div className="mt-6">
              <RoiCalculator />
            </div>
          </GlassCard>

          <div className="h-px w-full bg-gradient-to-r from-transparent via-brand-700/30 to-transparent" />

          <GlassPanel tone="surface" padding="lg" backdrop="soft">
            <p className="text-small">
              Every tier above begins as an inquiry, not a transaction. There is no payment flow on
              this page yet — the pilot is closed and run by hand, and a real human from CARI Forge
              will reply within 48 hours during working weeks.{' '}
              <Link href="/how-it-works#front-door" className="link-brand">
                Tell us what you want to build
              </Link>{' '}
              or read{' '}
              <Link href="/faq" className="link-brand">
                the FAQ
              </Link>{' '}
              for what a regulated buyer asks first. See the procurement verification matrix at{' '}
              <Link href="/compare" className="link-brand">
                /compare
              </Link>{' '}
              for an honest, source-cited comparison with five other AI-build platforms, and what
              approved buyers from regulated sectors say about the deliverables at{' '}
              <Link href="/testimonials" className="link-brand">
                /testimonials
              </Link>
              . See the full pipeline on a real case file at{' '}
              <Link href="/sample-brief" className="link-brand">
                the /sample-brief worked example
              </Link>{' '}
              — one buyer brief, five agents, one named human approver at every gate.
            </p>
          </GlassPanel>
        </div>
      </section>
    </main>
  );
}
