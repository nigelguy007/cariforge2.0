// @polsia:user-owned — /blog. Server Component that exports metadata. The
// editor-cards live in a single client island (<BlogIndex/>) that GETs
// /api/blog and renders a responsive grid of topic-tagged posts. Below the
// index sits a second section hosting <NewsletterSignupForm/>, a low-friction
// email-capture island that POSTs to /api/newsletter so organic readers can
// leave their address before they're ready to submit a full brief. No
// data-fetch in the page body — server work is the static metadata export
// only.

import type { Metadata } from 'next';
import { BlogIndex } from '@/components/custom/blog-index';
import { NewsletterSignupForm } from '@/components/custom/blog-newsletter-form';
import { GlassPanel, GlassSectionHeader } from '@/components/custom/glass';
import { JsonLd } from '@/components/custom/json-ld';
import { organization } from '@/lib/jsonld';
import { siteName, siteUrl } from '@/lib/site';

export const metadata: Metadata = {
  title: { absolute: `Blog — ${siteName}` },
  description:
    'Editor notes for regulated buyers — how the council is shaped to the EU AI Act Articles 12 & 14 timeline, the SHA-256 hash-chained audit-trail bundle, and the consolidated evidence packs that survive a procurement review.',
  alternates: { canonical: '/blog' },
  openGraph: {
    title: `Blog — ${siteName}`,
    description:
      'Editor notes for regulated buyers — how the council is shaped to the EU AI Act Articles 12 & 14 timeline, the SHA-256 hash-chained audit-trail bundle, and the consolidated evidence packs that survive a procurement review.',
    images: ['/opengraph-image'],
  },
};

const blog = {
  '@context': 'https://schema.org',
  '@type': 'Blog',
  name: `Blog — ${siteName}`,
  url: `${siteUrl}/blog`,
  description:
    'Editor notes for regulated buyers — how the council is shaped to the EU AI Act Articles 12 & 14 timeline, the SHA-256 hash-chained audit-trail bundle, and the consolidated evidence packs that survive a procurement review.',
  publisher: organization,
} as const;

export default function BlogPage() {
  return (
    <main className="flex flex-col">
      <JsonLd script={blog} />
      <section className="section-lg relative overflow-hidden hero-aurora">
        <div className="container-page flex flex-col gap-10">
          <GlassSectionHeader
            eyebrow="Insight for regulated buyers"
            title="Notes from the council — for the people who need to say yes."
            lede="Short editor notes on the work the council does: how the audit-trail precedent holds up, how the procurement timeline maps to the evidence pack, and where the EU AI Act Articles 12 & 14 readiness memo lands in the pipeline. Each post is short, named, and produced by the team that runs the runs."
          />

          <BlogIndex />
        </div>
      </section>
      <section className="section relative overflow-hidden section-aurora">
        <div className="container-page flex max-w-2xl flex-col gap-5">
          <GlassSectionHeader
            eyebrow="Editor notes — by email"
            title="Not ready for a council yet? Stay in the loop."
            lede="Leave a work email and we&rsquo;ll send the editor notes, EU AI Act readiness updates, and the council&rsquo;s read of the latest regulatory backlog — roughly once a month, no promotions. Skip ahead to a procurement-grade walkthrough whenever procurement moves."
          />
          <GlassPanel tone="surface" padding="lg" backdrop="soft">
            <NewsletterSignupForm />
          </GlassPanel>
        </div>
      </section>
    </main>
  );
}
