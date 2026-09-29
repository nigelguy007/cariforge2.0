// @polsia:user-owned — /why-this-is-a-scaffold (route path kept for existing
// links). Server Component that exports metadata. Static pilot-scope page for
// procurement and compliance reviewers: "What a 21-day pilot delivers, and
// what it doesn't", without invented guarantees. No data-fetch in the page
// body — server work is the static metadata export only. Mirrors /faq,
// /pricing, /how-the-council-works, and /sample-brief in shape and voice.

import type { Metadata } from 'next';
import Link from 'next/link';
import { GlassCard, GlassChip, GlassSectionHeader } from '@/components/custom/glass';
import { JsonLd } from '@/components/custom/json-ld';
import { SCAFFOLD_DISCLAIMER } from '@/lib/business/scaffold-disclaimer';
import { siteDescription, siteName, siteUrl } from '@/lib/site';

const pageTitle = 'What a 21-day pilot delivers, and what it doesn’t';
const pageDescription =
  'A CariForge pilot runs 21 days and ends in a Decision Pack the client owns: problem brief, readiness score, workflow map, governance review, working prototype (a runnable codebase) and full audit trail. It does not include production hosting, an uptime SLA, 24/7 support or liability for downstream deployment.';

export const metadata: Metadata = {
  title: { absolute: `${pageTitle} | ${siteName}` },
  description: pageDescription,
  alternates: { canonical: '/why-this-is-a-scaffold' },
  openGraph: {
    title: `${pageTitle} | ${siteName}`,
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

const covered = [
  {
    headline: 'A Decision Pack the client owns.',
    detail:
      'Every pilot ends in one Decision Pack: problem brief, readiness score, workflow map, governance review, working prototype and full audit trail. The client keeps all of it.',
  },
  {
    headline: 'A working prototype you can run.',
    detail:
      'The prototype is delivered as a runnable Next.js and TypeScript codebase built from the approved brief. The client owns the code and operates it. Every change traces back to a named human approval at a stage gate.',
  },
  {
    headline: 'Seven specialist agents, five gated stages.',
    detail:
      'Seven specialist agents (Discovery, Readiness, Workflow, Governance and Prototype, plus Partner and Impact on demand) move the brief through five stages: Need Discovery, Readiness Review, Workflow Design, Governance Check and Prototype build. Each stage closes only when a named human approves it with a written reason.',
  },
  {
    headline: 'A five-voice review council before every gate.',
    detail:
      'Inside the engine, a five-voice review council (Risk, Demand, Growth, Competition and Money, known as the Oracles) argues each gate before the named human signs. Dissent is written into the case file, and unresolved objections go to the approver.',
  },
] as const;

export default function PilotScopePage() {
  return (
    <main className="flex flex-col">
      <JsonLd script={organization} />
      <section className="section-lg relative overflow-hidden hero-aurora">
        <div className="container-page flex flex-col gap-10">
          <GlassSectionHeader
            eyebrow="Pilot scope for procurement and compliance reviewers"
            title="What a 21-day pilot delivers, and what it doesn’t."
            lede="A CariForge pilot runs for 21 days and ends in a Decision Pack the client owns, including a working prototype delivered as a runnable codebase. This page lists what the pilot covers and where its scope stops. The same scope appears in the FAQ and on /pricing."
          />

          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-3">
              <GlassChip tone="brand" className="self-start">
                § 01 · What the pilot does not cover
              </GlassChip>
              <h2 className="text-h2 font-display tracking-tight text-foreground">
                What the pilot does not cover.
              </h2>
              <p className="max-w-3xl text-body text-foreground/85">
                These four limits are stated plainly so a compliance officer can check them. If any
                of them matters for your engagement, raise it before the pilot starts.
              </p>
            </div>
            <ul className="flex flex-col gap-3">
              {SCAFFOLD_DISCLAIMER.map((row) => (
                <li key={row.headline}>
                  <GlassCard tone="surface" padding="md" interactive>
                    <p className="font-display text-body font-semibold leading-snug text-foreground">
                      {row.headline}
                    </p>
                    <p className="text-small leading-relaxed text-card-foreground/85">
                      {row.detail}
                    </p>
                  </GlassCard>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-3">
              <GlassChip tone="brand" className="self-start">
                § 02 · What the pilot delivers
              </GlassChip>
              <h2 className="text-h2 font-display tracking-tight text-foreground">
                What the pilot delivers.
              </h2>
              <p className="max-w-3xl text-body text-foreground/85">
                Every pilot produces the items below. Each one is recorded in the audit trail handed
                over with the Decision Pack, so the client can check it.
              </p>
            </div>
            <ul className="flex flex-col gap-3">
              {covered.map((row) => (
                <li key={row.headline}>
                  <GlassCard tone="surface" padding="md" interactive>
                    <p className="font-display text-body font-semibold leading-snug text-foreground">
                      {row.headline}
                    </p>
                    <p className="text-small leading-relaxed text-card-foreground/85">
                      {row.detail}
                    </p>
                  </GlassCard>
                </li>
              ))}
            </ul>
          </div>

          <p className="text-small text-muted-foreground">
            Read the same scope in the{' '}
            <Link href="/faq#scaffold-vs-product" className="link-brand">
              FAQ answer on what a pilot delivers
            </Link>
            , see how each tier scopes it at{' '}
            <Link href="/pricing" className="link-brand">
              /pricing
            </Link>
            , or{' '}
            <Link href="/#how-it-works" className="link-brand">
              leave a one-line brief
            </Link>{' '}
            to start a pilot.
          </p>
        </div>
      </section>
    </main>
  );
}
