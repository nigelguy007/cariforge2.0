// @polsia:user-owned — /faq. Server Component that exports metadata. The five
// Q&A live in a single client island (<FaqAccordion/>) that GETs /api/faq and
// renders a Radix accordion. No data-fetch in the page body — server work is
// the static metadata export only.

import type { Metadata } from 'next';
import { FaqAccordion } from '@/components/custom/faq-accordion';
import { GlassSectionHeader } from '@/components/custom/glass';
import { JsonLd } from '@/components/custom/json-ld';
import { siteDescription, siteName, siteUrl } from '@/lib/site';

export const metadata: Metadata = {
  title: { absolute: `FAQ — ${siteName}` },
  description:
    'Five questions a regulated buyer asks first: the EU AI Act Articles 12 & 14 timeline, the shape of the audit trail, hallucination control, what CARI Forge does and does not deliver, and why a council is needed at all.',
  alternates: { canonical: '/faq' },
  openGraph: {
    title: `FAQ — ${siteName}`,
    description:
      'Five questions a regulated buyer asks first: the EU AI Act Articles 12 & 14 timeline, the shape of the audit trail, hallucination control, what CARI Forge does and does not deliver, and why a council is needed at all.',
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

export default function FaqPage() {
  return (
    <main className="flex flex-col">
      <JsonLd script={organization} />
      <section className="section-lg relative overflow-hidden hero-aurora">
        <div className="container-page flex flex-col gap-8">
          <GlassSectionHeader
            eyebrow="Frequently asked — by the people who need to say yes"
            title="The five questions a regulated buyer asks first."
            lede="CARI Forge is shaped for compliance officers. Below are the objections that come up in every regulated-buyer conversation, answered in the order they tend to be raised. Every claim here is produced by the system itself, not marketing copy."
          />

          <FaqAccordion />

          <p className="text-small text-muted-foreground">
            Still want to talk to a named human before submitting?{' '}
            <a
              href="mailto:cari-forge@polsia.app?subject=CARI%20Forge%20pilot%20enquiry"
              className="link-brand"
            >
              cari-forge@polsia.app
            </a>
          </p>
        </div>
      </section>
    </main>
  );
}
