// @polsia:user-owned — /testimonials. Server Component that exports per-page
// metadata (title, description, canonical, OG), emits Organization +
// BreadcrumbList JSON-LD via <JsonLd/>, and mounts a single client island
// (<TestimonialsList/>) that GETs /api/testimonials and renders the approved
// quote cards grouped by sector. No data-fetch in the page body — server
// work is the metadata export only. Procurement-grade voice matches the
// existing /pricing / compare / faq pages: written for a compliance officer,
// with the honest no-quotes-yet state surfaced by the island.

import type { Metadata } from 'next';
import Link from 'next/link';
import { GlassPanel, GlassSectionHeader } from '@/components/custom/glass';
import { JsonLd } from '@/components/custom/json-ld';
import { TestimonialsList } from '@/components/custom/testimonials-list';
import { siteDescription, siteName, siteUrl } from '@/lib/site';

export const metadata: Metadata = {
  title: { absolute: `Testimonials — ${siteName}` },
  description:
    'Approved buyer narratives from regulated procurement teams in Financial Services, Insurance, Public Sector, and Healthcare. Every quote is reviewed by a human moderator before it appears here.',
  alternates: { canonical: '/testimonials' },
  openGraph: {
    title: `Testimonials — ${siteName}`,
    description:
      'Approved buyer narratives from regulated procurement teams in Financial Services, Insurance, Public Sector, and Healthcare. Quotes are reviewed by a human moderator before they appear here.',
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
      name: 'Testimonials',
      item: `${siteUrl}/testimonials`,
    },
  ],
} as const;

export default function TestimonialsPage() {
  return (
    <main id="main-content" className="flex flex-col">
      <JsonLd script={organization} />
      <JsonLd script={breadcrumb} />
      <section className="section-lg relative overflow-hidden hero-aurora">
        <div className="container-page flex flex-col gap-10">
          <GlassSectionHeader
            eyebrow="Buyer narratives · For compliance officers"
            title="What regulated buyers say about the deliverables."
            lede="Approved project narratives from procurement teams in Financial Services, Insurance, Public Sector, and Healthcare. Every quote is reviewed by a human moderator before it appears here, and the moderation queue is empty until a buyer opts in. If our quote list reads thin right now, it is — that is the honest state of the dataset, not a marketing impression."
          />

          <TestimonialsList />

          <GlassPanel tone="surface" padding="md" backdrop="soft">
            <p className="text-small text-muted-foreground">
              Want to read the engagement model before submitting?{' '}
              <Link href="/pricing" className="link-brand">
                /pricing
              </Link>{' '}
              maps the same council, the same five-stage pipeline, and the same evidence package
              across three tiers. The full disclosure of what is and is not delivered by the
              Software Build sits at{' '}
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
