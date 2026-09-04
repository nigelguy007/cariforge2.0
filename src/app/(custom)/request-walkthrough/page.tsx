// @polsia:user-owned — /request-walkthrough. Deeper-intent form for
// procurement-grade buyers who have moved past the front-door one-line
// brief and want a pre-procurement engagement. Server Component that
// exports metadata only; the <WalkthroughForm/> client island lives just
// below. No data-fetch in the page body — server work here is the static
// metadata + the JSON-LD structured-data block only.

import type { Metadata } from 'next';
import Link from 'next/link';
import { GlassChip, GlassPanel, GlassSectionHeader } from '@/components/custom/glass';
import { JsonLd } from '@/components/custom/json-ld';
import { WalkthroughForm } from '@/components/custom/walkthrough-form';
import { siteDescription, siteName, siteUrl } from '@/lib/site';

export const metadata: Metadata = {
  title: { absolute: `Request a council walkthrough — ${siteName}` },
  description:
    'A deeper-intent form for procurement-grade buyers — regulated sectors (financial services, insurance, public sector, health), named role, organisation, and a 2–3 sentence problem statement. Each request fires an email to the CARI Forge operator and lands a row in the leads dashboard.',
  alternates: { canonical: '/request-walkthrough' },
  openGraph: {
    title: `Request a council walkthrough — ${siteName}`,
    description:
      'A deeper-intent form for procurement-grade buyers — regulated sectors, named role, organisation, and a 2–3 sentence problem statement.',
    images: ['/opengraph-image'],
  },
  robots: { index: true, follow: true },
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

export default function RequestWalkthroughPage() {
  return (
    <main className="flex flex-col">
      <JsonLd script={organization} />
      <section className="section-lg relative overflow-hidden hero-aurora">
        <div className="container-page flex flex-col gap-10">
          <GlassSectionHeader
            eyebrow="Procurement-grade — for buyers who have moved past the front door"
            title="Request a council walkthrough."
            lede="The one-line brief on the home page is the front door — about what you would tell the chairman before the council kicked off. This form is for buyers who are past that and ready to start a real procurement engagement: a segment choice from the four pre-approved engagement tracks, a named role, an organisation, and a 2–3 sentence problem statement. Each submission lands on the leads dashboard and fires a notification email to a CARI Forge operator; a named human replies within 48 hours during the working week."
          />

          <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr]">
            <GlassPanel tone="surface" padding="lg" backdrop="soft">
              <WalkthroughForm />
            </GlassPanel>

            <GlassPanel tone="panel" padding="lg" backdrop="soft">
              <GlassChip tone="brand" className="self-start">
                What happens after you submit
              </GlassChip>
              <ol className="mt-4 flex flex-col gap-4 text-small text-card-foreground">
                <li className="flex gap-3">
                  <span
                    aria-hidden
                    className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border border-brand-700/40 text-caption font-semibold text-brand-700"
                  >
                    1
                  </span>
                  <span>
                    A row lands in the leads dashboard with <code>source: walkthrough</code> and the
                    segment you chose, so a CARI Forge operator can route it without paging.
                  </span>
                </li>
                <li className="flex gap-3">
                  <span
                    aria-hidden
                    className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border border-brand-700/40 text-caption font-semibold text-brand-700"
                  >
                    2
                  </span>
                  <span>
                    An email fires through the Polsia email proxy to the operator with the full
                    payload — full name, work email, organisation, role, segment, and your
                    two-or-three-sentence problem statement.
                  </span>
                </li>
                <li className="flex gap-3">
                  <span
                    aria-hidden
                    className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border border-brand-700/40 text-caption font-semibold text-brand-700"
                  >
                    3
                  </span>
                  <span>
                    A named human replies within 48 hours during the working week with the next
                    concrete step — usually a 30-minute read-out, a sample brief, or a kick
                    candidate.
                  </span>
                </li>
              </ol>
              <div className="my-4 h-px w-full bg-gradient-to-r from-transparent via-brand-700/30 to-transparent" />
              <p className="text-small text-muted-foreground">
                For the lighter one-line intake that appears on the home page,{' '}
                <Link href="/#how-it-works" className="link-brand">
                  leave a brief
                </Link>{' '}
                instead. Cross-link also: every pricing tier carries this CTA below its primary
                &ldquo;Inquire&rdquo; button on{' '}
                <Link href="/pricing" className="link-brand">
                  /pricing
                </Link>
                .
              </p>
            </GlassPanel>
          </div>
        </div>
      </section>
    </main>
  );
}
