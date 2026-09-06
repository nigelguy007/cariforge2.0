// @polsia:user-owned — /updates. A real, dated changelog of shipped product
// changes — not a marketing "coming soon" page. Every entry below is a
// genuine summary of work that has actually landed (cross-checked against
// git history), written in plain language for a visitor, not the internal
// debugging narration those commits actually carry. New entries get added
// to CHANGELOG below as real work ships; nothing here is a projection.
//
// Added as part of the Framer "Span" template pass (2026-09-06, user
// request: "use the template but no careers or waitlist - thats not
// relevant"): Span's own page set includes an Updates page. CariForge's
// homepage already independently converged on Span's landing-page grammar
// from an earlier redesign, so the genuinely missing piece was this page
// type — Careers and Waitlist were explicitly excluded as not relevant to
// CariForge's stage.

import type { Metadata } from 'next';
import {
  GlassCard,
  GlassCardBody,
  GlassCardHeader,
  GlassCardTitle,
} from '@/components/custom/glass/glass-card';
import { GlassSectionHeader } from '@/components/custom/glass/glass-section-header';
import { JsonLd } from '@/components/custom/json-ld';
import { siteDescription, siteName, siteUrl } from '@/lib/site';

export const metadata: Metadata = {
  title: { absolute: `Updates — ${siteName}` },
  description: 'What has actually shipped in CARI Forge, most recent first.',
  alternates: { canonical: '/updates' },
  openGraph: {
    title: `Updates — ${siteName}`,
    description: 'What has actually shipped in CARI Forge, most recent first.',
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

interface ChangelogEntry {
  readonly date: string;
  readonly title: string;
  readonly items: readonly string[];
}

// Most recent first. Each entry is a real, verifiable summary of shipped
// work — see this file's header comment.
const CHANGELOG: readonly ChangelogEntry[] = [
  {
    date: '6 September 2026',
    title: 'The Software Build stage now runs as a background job',
    items: [
      'A large build no longer times out mid-run — it now advances in small, resumable steps instead of one long request.',
      'Every reference to "prototype" is gone from the product’s language: the Software Build stage produces an MVP, described as exactly that throughout.',
    ],
  },
  {
    date: '5 September 2026',
    title: 'A live Office view, and a real generated build',
    items: [
      'Added the Office view: watch your project’s agents work through each stage in real time, not just a static progress bar.',
      'The Software Build stage now generates real, runnable code files plus a full technical spec — not just a written plan.',
      '"Draft with AI" now works through every stage it can clear on its own, stopping only when a stage genuinely needs your judgment.',
      'Refreshed the app’s visual design: a thinner navigation shell and a new aurora background.',
    ],
  },
  {
    date: '5 September 2026',
    title: 'A real auto-advance policy, reviewed by AI Oracles',
    items: [
      'Every stage is now reviewed by an AI Oracle before it can auto-advance, with objections recorded and resolved rather than skipped.',
      'Fixed a real governance gap where drafting could jump past an undecided gate.',
    ],
  },
  {
    date: '4 September 2026',
    title: 'A simplified workspace: one project view, one Approvals queue',
    items: [
      'Consolidated the workspace into a single project view, a unified Approvals inbox, and an Evidence page — replacing several separate, harder-to-find screens.',
      'Gated internal governance and testing views to admins only, and fixed several places where raw internal status codes were shown instead of plain language.',
    ],
  },
];

export default function UpdatesPage() {
  return (
    <main className="flex flex-col">
      <JsonLd script={organization} />
      <section className="section-lg relative overflow-hidden hero-aurora">
        <div className="container-page flex flex-col gap-10">
          <GlassSectionHeader
            eyebrow="Updates"
            title="What has actually shipped."
            lede="A real, dated record of product changes — most recent first. Every line below is something that has actually landed, not a roadmap item."
          />

          <ol className="flex flex-col gap-5">
            {CHANGELOG.map((entry) => (
              <li key={`${entry.date}-${entry.title}`}>
                <GlassCard tone="surface" padding="lg">
                  <GlassCardHeader>
                    <p className="text-eyebrow text-brand-700">{entry.date}</p>
                    <GlassCardTitle>{entry.title}</GlassCardTitle>
                  </GlassCardHeader>
                  <GlassCardBody>
                    <ul className="flex flex-col gap-2">
                      {entry.items.map((item) => (
                        <li key={item} className="flex gap-2 text-body text-card-foreground/85">
                          <span aria-hidden="true" className="text-brand-700">
                            &bull;
                          </span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </GlassCardBody>
                </GlassCard>
              </li>
            ))}
          </ol>

          <p className="text-small text-muted-foreground">
            Questions about a specific change?{' '}
            <a
              href="mailto:cari-forge@polsia.app?subject=CARI%20Forge%20update%20question"
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
