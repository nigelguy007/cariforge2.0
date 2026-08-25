// @polsia:user-owned — /why-this-is-a-scaffold. Server Component that exports
// metadata. A purely static honesty page for procurement and compliance
// reviewers: the disallowed list (what the deliverable is NOT) and the actual
// promise (what it IS), without invented guarantees. No data-fetch in the page
// body — server work is the static metadata export only. Mirrors /faq,
// /pricing, /how-the-council-works, and /sample-brief in shape and voice.

import type { Metadata } from 'next';
import Link from 'next/link';
import { GlassCard, GlassChip, GlassSectionHeader } from '@/components/custom/glass';
import { JsonLd } from '@/components/custom/json-ld';
import { SCAFFOLD_DISCLAIMER } from '@/lib/business/scaffold-disclaimer';
import { siteDescription, siteName, siteUrl } from '@/lib/site';

export const metadata: Metadata = {
  title: { absolute: `Why this is a scaffold, not a product — ${siteName}` },
  description:
    'What CARI Forge does not deliver — no production hosting, no uptime SLA, no 24/7 support, no automated customer-facing login, no liability for downstream deployment — and what it does: a governed five-stage pipeline, a typed five-agent council, a named human approver at every gate, and a runnable Next.js/TypeScript project worked end-to-end from the approved brief.',
  alternates: { canonical: '/why-this-is-a-scaffold' },
  openGraph: {
    title: `Why this is a scaffold, not a product — ${siteName}`,
    description:
      'What CARI Forge does not deliver — no production hosting, no uptime SLA, no 24/7 support, no automated customer-facing login, no liability for downstream deployment — and what it does: a governed five-stage pipeline, a typed five-agent council, a named human approver at every gate, and a runnable Next.js/TypeScript project worked end-to-end from the approved brief.',
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
    headline: 'A governed pipeline.',
    detail:
      'Five stages — Need Discovery → Readiness Review → Workflow Design → Governance Check → Software Build — each with a typed deliverable and a named human approval recorded before the next stage advances.',
  },
  {
    headline: 'A typed five-agent council.',
    detail:
      'Five advisor voices (Risk, Demand, Growth, Competition, Money) with opposing defaults, and a chairman who rules only after at least two opposing voices have weighed in on the same point. Dissent is written into the case file rather than averaged away, and unresolved objections are escalated to the named human, never silently dropped.',
  },
  {
    headline: 'A named human approver at every gate.',
    detail:
      'Each gate decision is recorded with a named human and a typed reason. Unresolved objections are escalated to the named human, not silently dropped — and the case file makes that trail visible to the buyer at hand-off.',
  },
  {
    headline: 'A runnable Next.js / TypeScript project worked end-to-end from the approved brief.',
    detail:
      'Type-safe, end-to-end, from the verbatim one-line brief in to a runnable Next.js + TypeScript Software Build out. Every line of source traced back to a named human approval at a stage gate, with the audit-trail bundle produced by the same run.',
  },
] as const;

export default function WhyThisIsAScaffoldPage() {
  return (
    <main className="flex flex-col">
      <JsonLd script={organization} />
      <section className="section-lg relative overflow-hidden hero-aurora">
        <div className="container-page flex flex-col gap-10">
          <GlassSectionHeader
            eyebrow="For procurement and compliance reviewers — what we do, and what we do not"
            title="Why this is a scaffold, not a product."
            lede="CARI Forge delivers a runnable, fully-typed Next.js Software Build from a one-line brief. Below is the explicit list of what that does not cover, and what it does. The wording is the system’s own, not marketing copy — it tracks the same promise spelled out at the FAQ’s scaffold-vs-product answer and at /pricing."
          />

          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-3">
              <GlassChip tone="brand" className="self-start">
                § 01 · What this deliverable does NOT cover
              </GlassChip>
              <h2 className="text-h2 font-display tracking-tight text-white">
                What this deliverable does NOT cover.
              </h2>
              <p className="max-w-3xl text-body text-white/85">
                These five exclusions are written to be read plainly by a compliance officer, not
                buried in a clause. If a need here matters for your engagement, that is the
                conversation to have up front — not the moment to discover it at hand-off.
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
                § 02 · What this deliverable DOES cover
              </GlassChip>
              <h2 className="text-h2 font-display tracking-tight text-white">
                What this deliverable DOES cover (the actual promise).
              </h2>
              <p className="max-w-3xl text-body text-white/85">
                These four inclusions are the shape of every run. They are produced by the system
                itself and recorded in the audit-trail bundle at hand-off, so the promise below is
                verifiable, not aspirational.
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

          <p className="text-small text-white/70">
            Read the same promise spelled out at the{' '}
            <Link href="/faq#scaffold-vs-product" className="link-brand">
              FAQ’s scaffold-vs-product answer
            </Link>
            , see how each tier scopes it at{' '}
            <Link href="/pricing" className="link-brand">
              /pricing
            </Link>
            , or{' '}
            <Link href="/#how-it-works" className="link-brand">
              leave a one-line brief
            </Link>{' '}
            to start a run the way a regulated buyer actually does.
          </p>
        </div>
      </section>
    </main>
  );
}
