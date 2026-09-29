// @polsia:user-owned — /compare. Server Component that exports metadata.
// The alternatives table lives in a single client island
// (<CompareMatrix/>) that GETs /api/compare and renders the alternatives
// table (category, examples, where each falls short) and the assessment note.
// No data-fetch in the page body; server work is the static metadata export.

import type { Metadata } from 'next';
import Link from 'next/link';
import { CompareMatrix } from '@/components/custom/compare-matrix';
import { GlassPanel, GlassSectionHeader } from '@/components/custom/glass';
import { JsonLd } from '@/components/custom/json-ld';
import { siteDescription, siteName, siteUrl } from '@/lib/site';

const pageDescription =
  "How CariForge compares with the alternatives a Caribbean buyer weighs: global consultancies (Big Four Caribbean practices), AI governance platforms (Credo AI, Holistic AI, IBM watsonx.governance, OneTrust), agent builders (Microsoft Copilot Studio, UiPath) and general AI assistants (ChatGPT, Gemini, Copilot). Positions are CariForge's own assessment.";

export const metadata: Metadata = {
  title: { absolute: `Compare to alternatives | ${siteName}` },
  description: pageDescription,
  alternates: { canonical: '/compare' },
  openGraph: {
    title: `Compare to alternatives | ${siteName}`,
    description: pageDescription,
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
            eyebrow="Compare · For buyers and procurement teams"
            title="Fast like a tool, accountable like a consultancy, local by design."
            lede="Buyers in the Caribbean usually weigh four kinds of alternative: global consultancies, AI governance platforms, agent builders and general AI assistants. CariForge combines governed agents, a named human approver at every gate and local delivery, and ends each 21-day pilot with a working prototype the client owns."
          />

          <CompareMatrix />

          <GlassPanel tone="surface" padding="md" backdrop="soft">
            <p className="text-small text-muted-foreground">
              <Link href="/pricing" className="link-brand">
                Read the engagement tiers
              </Link>
              . Every tier uses the same council, the same five-stage pipeline and the same evidence
              package. The scope of each pilot is set out in{' '}
              <Link href="/why-this-is-a-scaffold" className="link-brand">
                what a 21-day pilot delivers, and what it doesn’t
              </Link>
              .
            </p>
          </GlassPanel>
        </div>
      </section>
    </main>
  );
}
