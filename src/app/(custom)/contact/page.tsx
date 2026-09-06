// @polsia:user-owned — /contact. A dedicated contact page — Span's template
// (see /updates' header comment for the full context) includes one; CariForge
// didn't have a standalone page for it, only a mailto link buried on
// /how-it-works. Reuses the same real contact email and reply-time
// commitment already published there — nothing new is claimed here.

import type { Metadata } from 'next';
import Link from 'next/link';
import { GlassCard, GlassCardBody } from '@/components/custom/glass/glass-card';
import { GlassSectionHeader } from '@/components/custom/glass/glass-section-header';
import { JsonLd } from '@/components/custom/json-ld';
import { siteDescription, siteName, siteUrl } from '@/lib/site';

export const metadata: Metadata = {
  title: { absolute: `Contact — ${siteName}` },
  description: 'Reach a named human at CARI Forge, or submit a brief to start a project.',
  alternates: { canonical: '/contact' },
  openGraph: {
    title: `Contact — ${siteName}`,
    description: 'Reach a named human at CARI Forge, or submit a brief to start a project.',
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

export default function ContactPage() {
  return (
    <main className="flex flex-col">
      <JsonLd script={organization} />
      <section className="section-lg relative overflow-hidden hero-aurora">
        <div className="container-page flex flex-col gap-8">
          <GlassSectionHeader
            eyebrow="Contact"
            title="Talk to a named human."
            lede="Every reply comes from a real person, not an autoresponder — and every brief gets read in full before any code is written."
          />

          <div className="grid gap-5 sm:grid-cols-2">
            <GlassCard tone="highlight" padding="lg">
              <GlassCardBody>
                <h3 className="font-display text-h3 tracking-tight text-foreground">
                  Have a project in mind?
                </h3>
                <p className="text-body text-card-foreground/85">
                  Submit a one-line brief and CARI Forge's council will start reading it — the
                  fastest path to an actual answer.
                </p>
                <Link href="/how-it-works#front-door" className="link-brand w-fit font-medium">
                  Submit a brief &rarr;
                </Link>
              </GlassCardBody>
            </GlassCard>

            <GlassCard tone="surface" padding="lg">
              <GlassCardBody>
                <h3 className="font-display text-h3 tracking-tight text-foreground">
                  Prefer to reach a person first?
                </h3>
                <p className="text-body text-card-foreground/85">
                  Email us directly. A real human replies — within 48 hours during the working week.
                </p>
                <a
                  href="mailto:cari-forge@polsia.app?subject=CARI%20Forge%20enquiry"
                  className="link-brand w-fit font-medium"
                >
                  cari-forge@polsia.app
                </a>
              </GlassCardBody>
            </GlassCard>
          </div>

          <p className="text-small text-muted-foreground">
            Not sure a 21-day proof fits your case yet?{' '}
            <Link href="/faq" className="link-brand">
              Read the FAQ
            </Link>{' '}
            or{' '}
            <Link href="/how-it-works" className="link-brand">
              check what fits before you apply
            </Link>
            .
          </p>
        </div>
      </section>
    </main>
  );
}
