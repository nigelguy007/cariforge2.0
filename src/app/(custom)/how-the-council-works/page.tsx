// @polsia:user-owned — /how-the-council-works. Server Component that exports
// metadata. The three mechanics live in a single client island
// (<CouncilSections/>) that GETs /api/council. No data-fetch in the page body —
// server work is the static metadata export only. Mirrors /faq and /pricing.

import type { Metadata } from 'next';
import Link from 'next/link';
import { CouncilSections } from '@/components/custom/council-detail';
import { GlassPanel, GlassSectionHeader } from '@/components/custom/glass';
import { JsonLd } from '@/components/custom/json-ld';
import { siteDescription, siteName, siteUrl } from '@/lib/site';

export const metadata: Metadata = {
  title: { absolute: `How the council works — ${siteName}` },
  description:
    "CARI Forge's three governance mechanics at depth: the five agents (Risk, Demand, Growth, Competition, Money) and what each argues, the chairman's three rulings (Build, Test first, Walk away) and how dissent is written into the case file, and the rule that ties the run back to the named human with a typed reason attached.",
  alternates: { canonical: '/how-the-council-works' },
  openGraph: {
    title: `How the council works — ${siteName}`,
    description:
      "CARI Forge's three governance mechanics at depth: the five agents (Risk, Demand, Growth, Competition, Money) and what each argues, the chairman's three rulings (Build, Test first, Walk away) and how dissent is written into the case file, and the rule that ties the run back to the named human with a typed reason attached.",
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

export default function HowTheCouncilWorksPage() {
  return (
    <main id="main-content" className="flex flex-col">
      <JsonLd script={organization} />
      <section className="section-lg relative overflow-hidden hero-aurora">
        <div className="container-page flex flex-col gap-10">
          <GlassSectionHeader
            eyebrow="Governance · Depth page — for buyers who want the mechanics spelled out"
            title="How the council works."
            lede="The landing page previews the council and the chairman ruling. Below is the depth version: the five agents and what each argues, the three rulings the chair can issue and what happens to dissent on each, and the rule that ties the run back to you — the named human on the case file — with a typed reason attached before any stage advance."
          />

          <CouncilSections />

          <GlassPanel tone="surface" padding="md" backdrop="soft">
            <p className="text-small text-muted-foreground">
              Want to see the whole pipeline on a real case file? Read the{' '}
              <Link href="/sample-brief" className="link-brand">
                sample brief
              </Link>{' '}
              — a worked example with five named human approvers, from the verbatim intake to the
              Software Build receipt.
            </p>
            <p className="mt-4 text-small text-muted-foreground">
              Still want the shape in the words of a regulated buyer?{' '}
              <Link href="/faq" className="link-brand">
                Read the FAQ
              </Link>{' '}
              or{' '}
              <Link href="/#how-it-works" className="link-brand">
                leave a one-line brief
              </Link>{' '}
              to start a run the way a regulated buyer actually does.
            </p>
            <p className="mt-4 text-small text-muted-foreground">
              Ready to brief a real council?{' '}
              <Link href="/request-walkthrough" className="link-brand">
                Request a council walkthrough
              </Link>{' '}
              — an at-depth form for regulated buyers who are past the front-door brief and want a
              pre-procurement engagement routed by an actual human.
            </p>
          </GlassPanel>
        </div>
      </section>
    </main>
  );
}
