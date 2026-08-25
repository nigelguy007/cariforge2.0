// @polsia:user-owned — /compare. Server Component that exports metadata.
// The procurement evaluation matrix lives in a single client island
// (<CompareMatrix/>) that GETs /api/compare and renders the disclaimer banner,
// the six-vendor × five-criterion matrix, the criterion explainers, and the
// research notes. No data-fetch in the page body — server work is the static
// metadata export only. Procurement-grade voice throughout this page: written
// for a compliance officer, not a marketing audience.

import type { Metadata } from 'next';
import Link from 'next/link';
import { CompareMatrix } from '@/components/custom/compare-matrix';
import { GlassPanel, GlassSectionHeader } from '@/components/custom/glass';
import { JsonLd } from '@/components/custom/json-ld';
import { siteDescription, siteName, siteUrl } from '@/lib/site';

export const metadata: Metadata = {
  title: { absolute: `Compare to alternatives — ${siteName}` },
  description:
    'A procurement evaluation matrix: six AI-build platforms (CARI Forge plus FORGE, ARCHFORGE, Opsera Forge, iTmethods Forge, and EC-Council ADG) scored on five criteria — council of specialist advisors, named human approver gate, recorded dissent preserved, EU AI Act Articles 12/14 readiness, and scaffold-not-product honesty. Each cell carries a source. The matrix is a CARI Forge-side view, not a third-party audit.',
  alternates: { canonical: '/compare' },
  openGraph: {
    title: `Compare to alternatives — ${siteName}`,
    description:
      'A procurement evaluation matrix: six AI-build platforms (CARI Forge plus FORGE, ARCHFORGE, Opsera Forge, iTmethods Forge, and EC-Council ADG) scored on five criteria — council of specialist advisors, named human approver gate, recorded dissent preserved, EU AI Act Articles 12/14 readiness, and scaffold-not-product honesty. Each cell carries a source.',
    images: ['/opengraph-image'],
  },
};

const organization = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: siteName,
  url: siteUrl,
  description: siteDescription,
  logo: `${siteUrl}/icon.svg`,
  sameAs: [],
} as const;

const breadcrumb = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: siteName, item: `${siteUrl}/` },
    {
      '@type': 'ListItem',
      position: 2,
      name: 'Compare to alternatives',
      item: `${siteUrl}/compare`,
    },
  ],
} as const;

export default function ComparePage() {
  return (
    <main className="flex flex-col">
      <JsonLd script={organization} />
      <JsonLd script={breadcrumb} />
      <section className="section-lg relative overflow-hidden hero-aurora">
        <div className="container-page flex flex-col gap-10">
          <GlassSectionHeader
            eyebrow="Procurement verification · For compliance officers"
            title="An honest evaluation matrix — vs. five AI-build platforms."
            lede="The matrix below scores CARI Forge against FORGE, ARCHFORGE, Opsera Forge, iTmethods Forge, and EC-Council ADG on five procurement-relevant criteria: a council of specialist advisors, a named human approver gate at every stage, recorded dissent preserved on the case file, EU AI Act Articles 12 / 14 readiness, and a scaffold-not-product honesty claim. Each cell carries a plain-language statement and a source link. Where a row 'unknown' appears, the row is deliberately empty — the gap is the verdict."
          />

          <CompareMatrix />

          <GlassPanel tone="surface" padding="md" backdrop="soft">
            <p className="text-small text-muted-foreground">
              How is each tier scoped against the matrix above?{' '}
              <Link href="/pricing" className="link-brand">
                Read the engagement tiers
              </Link>{' '}
              — every tier maps the same council, the same five-stage pipeline, and the same
              evidence package. What the matrix rows above mean for what is and isn’t delivered is
              spelled out at{' '}
              <Link href="/why-this-is-a-scaffold" className="link-brand">
                /why-this-is-a-scaffold
              </Link>
              .
            </p>
          </GlassPanel>
        </div>
      </section>
    </main>
  );
}
