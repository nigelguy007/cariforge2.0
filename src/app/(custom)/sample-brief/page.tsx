// @polsia:user-owned — /sample-brief. Server Component that exports metadata.
// The five-section worked-example live in a single client island
// (<SampleBriefDetail/>) that GETs /api/sample-brief and renders the buyer
// brief, the council debate, the chairman's reconciled ruling, the
// five-agent pipeline, Agent 5's working solution, and the supervisor sign-off
// footer. No data-fetch in the page body — server work is the static metadata
// export only. Mirrors /faq, /pricing, and /how-the-council-works exactly.

import type { Metadata } from 'next';
import Link from 'next/link';
import { DownloadAuditTrailButton } from '@/components/custom/download-audit-trail-button';
import { GlassPanel, GlassSectionHeader } from '@/components/custom/glass';
import { JsonLd } from '@/components/custom/json-ld';
import { SampleBriefDetail } from '@/components/custom/sample-brief-detail';
import { siteDescription, siteName, siteUrl } from '@/lib/site';

export const metadata: Metadata = {
  title: { absolute: `Sample brief — ${siteName}` },
  description:
    'One concrete worked example: a regulated EU insurer’s 14-person claims-department asks CARI Forge to triage 3,200 monthly property claims faster without lowering the fraud-detection rate. Read the verbatim brief, the Oracles’ five objections, the Elder Oracle’s reconciled ruling, the five-agent pipeline of stage handoffs, and Agent 5’s working solution — every stage named human approver and typed reason attached.',
  alternates: { canonical: '/sample-brief' },
  openGraph: {
    title: `Sample brief — ${siteName}`,
    description:
      'One concrete worked example: a regulated EU insurer’s 14-person claims-department asks CARI Forge to triage 3,200 monthly property claims faster without lowering the fraud-detection rate. Read the verbatim brief, the Oracles’ five objections, the Elder Oracle’s reconciled ruling, the five-agent pipeline of stage handoffs, and Agent 5’s working solution — every stage named human approver and typed reason attached.',
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

export default function SampleBriefPage() {
  return (
    <main className="flex flex-col">
      <JsonLd script={organization} />
      <section className="section-lg relative overflow-hidden hero-aurora">
        <div className="container-page flex flex-col gap-10">
          <GlassSectionHeader
            eyebrow="Worked example — a regulated EU insurer, three months, 14 named approvers"
            title="One brief. The Oracles. One named human approver at every gate."
            lede="Below is a verbatim run through the pipeline. Every stage names a human approver and shows the typed reason they wrote before they released the next stage. No averaging, no silent drop. The case file at the bottom is the receipt."
          />

          <GlassPanel tone="surface" padding="sm" backdrop="soft">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-col gap-1">
                <p className="text-eyebrow text-brand-700">Audit trail · one-page export</p>
                <p className="text-small text-muted-foreground">
                  Download this worked example as a single-page PDF for your compliance officer —
                  brief, council, ruling, sign-off, and the scaffold disclaimer in one sheet.
                </p>
              </div>
              <DownloadAuditTrailButton />
            </div>
          </GlassPanel>

          <SampleBriefDetail />

          <GlassPanel tone="surface" padding="md" backdrop="soft">
            <p className="text-small text-muted-foreground">
              Want the mechanics spelled out first? Read{' '}
              <Link href="/how-the-council-works" className="link-brand">
                how THE Oracles work
              </Link>{' '}
              for the five oracle remits, the three verdicts, and the Elder Oracle's
              tie-back-to-human rule. Or{' '}
              <Link href="/#how-it-works" className="link-brand">
                leave a one-line brief
              </Link>{' '}
              to start a run on your own case file.
            </p>
          </GlassPanel>
        </div>
      </section>
    </main>
  );
}
