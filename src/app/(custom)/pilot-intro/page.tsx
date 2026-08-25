// @polsia:user-owned — /pilot-intro. Server Component that exports metadata. A
// static positioning page for the TAG Caribbean pilot initiative: who the
// audience is (regulatory, partner, internal sponsor), what the pilot covers
// in region / buyer / scope / timebox, and the explicit GO/NO-GO claims a
// procurement reviewer can read deterministically. No data-fetch in the page
// body — server work is the static metadata export only. Mirrors
// /why-this-is-a-scaffold and /how-the-council-works in shape.
//
// Draft prose flag: the copy below (sections, headlines, rows) is placeholder
// shaped by the planning brief "TAG Caribbean pilot initiative" wording
// alone. The page sets the brand voice regulators and partners will read,
// so the customer must confirm the buyer profile, the tier / stage-gate
// envelope, and the GO/NO-GO list before this page is published.

import type { Metadata } from 'next';
import Link from 'next/link';
import { GlassCard, GlassChip, GlassSectionHeader } from '@/components/custom/glass';
import { JsonLd } from '@/components/custom/json-ld';
import { siteDescription, siteName, siteUrl } from '@/lib/site';

export const metadata: Metadata = {
  title: { absolute: `TAG Caribbean pilot — ${siteName}` },
  description:
    'A positioning page for the TAG Caribbean pilot initiative: the region, the named regulated buyer profile, the scope envelope (which stage gates and which tier), the timebox, and the explicit GO/NO-GO claims a procurement reviewer can read deterministically.',
  alternates: { canonical: '/pilot-intro' },
  openGraph: {
    title: `TAG Caribbean pilot — ${siteName}`,
    description:
      'A positioning page for the TAG Caribbean pilot initiative: the region, the named regulated buyer profile, the scope envelope (which stage gates and which tier), the timebox, and the explicit GO/NO-GO claims a procurement reviewer can read deterministically.',
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

const whatItIs = [
  {
    headline: 'Region — Caribbean (jurisdiction to be confirmed with the buyer).',
    detail:
      'The pilot is sequenced inside the Caribbean regulatory perimeter. The specific country / regulator set is named in the case file at the Readiness Review gate, not in marketing prose here — that is the place a procurement reviewer should look to confirm jurisdiction.',
  },
  {
    headline:
      'Buyer profile — one named regulated entity, one named human approver on the case file.',
    detail:
      'A single regulated buyer carries the engagement end-to-end, with a named human approver at every stage gate (Need Discovery → Readiness Review → Workflow Design → Governance Check → Software Build). The pilot is not a multi-tenant smear — it is one pilot, one buyer, one typed approver chain.',
  },
  {
    headline: 'Scope envelope — one tier, one stage-gate sweep.',
    detail:
      'The pilot exercises a single CARI Forge tier across all five stage gates on a single brief. The brief itself is chosen so the workflow has a real regulator-shaped problem to argue about, not a synthetic demo. The tier to be exercised is to be confirmed with the buyer before pilot kick-off.',
  },
  {
    headline: 'Timebox — bounded run, measured at hand-off.',
    detail:
      'A fixed start and a fixed end. The pilot is measured at the hand-off of the runnable Software Build plus the named-human audit-trail bundle, not at any earlier "demo" milestone. The specific dates and the hand-off deliverable list are confirmed at Readiness Review, not invented here.',
  },
] as const;

const whyCaribbean = [
  {
    headline:
      'A regulator-shaped market that is small enough to govern and large enough to learn from.',
    detail:
      'The Caribbean regulators operate at a scale where a single named-human engagement produces a clean audit signal — the kind that teaches the council about jurisdiction-specific objection handling without the noise of a multi-tenant rollout. The market context goes into the case file at Need Discovery, not on a marketing page.',
  },
  {
    headline:
      'A regulatory environment where procurement reviewers expect written, deterministic claims.',
    detail:
      'Caribbean procurement reviewers tend to read positioning pages the way they read contracts — line by line, GO/NO-GO claims only. The pilot is shaped so every claim on this page is verifiable against the case file at hand-off, or it does not appear here.',
  },
  {
    headline: 'A sequencing argument the council can defend in writing.',
    detail:
      'The pilot is sequenced before other regions because the Caribbean perimeter produces the cleanest first audit trail — small enough to keep the human-approver chain legible, regulator-shaped enough to keep the governance mechanics honest. The reason is recorded at the Readiness Review gate, not invented on this page.',
  },
] as const;

const doesProve = [
  {
    headline: 'The five-stage pipeline runs end-to-end on a regulator-shaped brief.',
    detail:
      'Need Discovery → Readiness Review → Workflow Design → Governance Check → Software Build, all five gates cleared, with the named-human audit trail produced by the same run. Verifiable against the case file at hand-off.',
  },
  {
    headline: 'The five-agent council argues in writing, with dissent preserved on the case file.',
    detail:
      'Risk / Demand / Growth / Competition / Money each argued, at least two opposing voices ruled on by the chairman, and unresolved objections escalated to the named human rather than silently dropped. Verifiable against the case file at hand-off.',
  },
  {
    headline: 'The named human approver chain holds at every stage gate.',
    detail:
      'A single named human, a typed reason attached at each gate, an audit-trail bundle delivered alongside the Software Build. No anonymous approvals, no auto-advancing, no gate run without a signed reason on file.',
  },
] as const;

const doesNotProve = [
  {
    headline: 'Production hosting, uptime SLA, or 24/7 support.',
    detail:
      'The pilot delivers a runnable Software Build and a named-human audit-trail bundle. It does not deliver production hosting, an uptime SLA, or 24/7 support — those are outside the scaffold and are the buyer’s to operate downstream.',
  },
  {
    headline: 'Multi-tenant rollout to additional Caribbean buyers.',
    detail:
      'The pilot is bounded to one named buyer and one tier. A multi-tenant rollout across additional Caribbean buyers is a separate, post-pilot decision, taken at prerogative of the regulated buyer — not implied by this pilot.',
  },
  {
    headline: 'A regulatory approval, certification, or accreditation.',
    detail:
      'The pilot produces an audit trail a regulator can read. It is not itself a regulatory approval, certification, or accreditation — those remain the regulator’s to issue, on their own schedule, on their own terms.',
  },
] as const;

const howItMoves = [
  {
    stage: 'Gate 0 — Need Discovery',
    oracle: 'Need Oracle, signed by the named Elder Oracle',
    detail:
      'A plain-English need enters as a mission Draft. The Need Oracle and the named Elder Oracle sign gate 0; the Elder’s signature is the only one that can close a Need Discovery decision.',
  },
  {
    stage: 'Gate 1 — Readiness Review',
    oracle: 'Readiness Oracle, with at least one specialist attester',
    detail:
      'Stakeholders, constraints, and intake evidence are collected across the Readiness handoff. The Readiness Oracle signs gate 1 once the typed specialist voice (Risk / Demand / Growth / Competition / Money) has signed the handoff.',
  },
  {
    stage: 'Gate 2 — Workflow Design',
    oracle: 'Workflow Oracle, with at least one specialist attester',
    detail:
      'The chosen workflow, owners, and acceptance criteria are committed. The Workflow Oracle signs gate 2 against the typed specialist voice on the handoff.',
  },
  {
    stage: 'Gate 3 — Governance Check',
    oracle: 'Governance Oracle, with at least one specialist attester',
    detail:
      'Compliance, procurement, and audit obligations are checked. The Governance Oracle signs gate 3, again with a typed specialist attester on the handoff being decided.',
  },
  {
    stage: 'Gate 4 — Software Build',
    oracle: 'Build Oracle, signed by the named Elder Oracle',
    detail:
      'The runnable Software Build is matched against the acceptance criteria. Gate 4 closes only with the named Elder Oracle’s signature — same human who signed gate 0, by design.',
  },
] as const;

export default function PilotIntroPage() {
  return (
    <main className="flex flex-col">
      <JsonLd script={organization} />
      <section className="section-lg relative overflow-hidden hero-aurora">
        <div className="container-page flex flex-col gap-10">
          <GlassSectionHeader
            eyebrow="Pilot initiative · /pilot-intro is a positioning page for procurement and partners"
            title="The TAG Caribbean pilot, in plain language."
            lede="Page for the regulated buyer, the partner, and the internal sponsor reading the same document. Three audiences, one prose posture. The page lays out what the pilot is in region / buyer / scope / timebox, why Caribbean comes first and not later, and the explicit GO/NO-GO list a procurement reviewer can read deterministically. The same promises made here are verifiable against the case file at hand-off, or they do not appear here."
            as="h1"
          />

          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-3">
              <GlassChip tone="brand" className="self-start">
                § 01 · What this pilot is, in plain language
              </GlassChip>
              <h2 className="text-h2 font-display tracking-tight text-white">
                What this pilot is, in plain language.
              </h2>
              <p className="max-w-3xl text-body text-white/85">
                Four lines cover the shape of the engagement. The named buyer, the region, the scope
                envelope, and the timebox each get a row — so a procurement reviewer reads the pilot
                as four bounded claims, not four marketing adjectives. The specifics are recorded in
                the case file at the Readiness Review gate.
              </p>
            </div>
            <ul className="flex flex-col gap-3">
              {whatItIs.map((row) => (
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
                § 02 · Why Caribbean, why now
              </GlassChip>
              <h2 className="text-h2 font-display tracking-tight text-white">
                Why Caribbean, why now.
              </h2>
              <p className="max-w-3xl text-body text-white/85">
                Three arguments the council can defend in writing. The market context, the
                regulatory posture, and the sequencing reason — each named, each sourced to the case
                file rather than to a marketing slide. A partner or sponsor reading this section
                should be able to weight the same arguments before the pilot kicks off.
              </p>
            </div>
            <ul className="flex flex-col gap-3">
              {whyCaribbean.map((row) => (
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
                § 03 · What this pilot proves (and what it does not)
              </GlassChip>
              <h2 className="text-h2 font-display tracking-tight text-white">
                What this pilot proves, and what it does not.
              </h2>
              <p className="max-w-3xl text-body text-white/85">
                Two columns. The GO list — claims a procurement reviewer can verify against the case
                file at hand-off. The NO-GO list — claims this page explicitly disclaims so that a
                reader does not have to infer the boundary from prose. Each row is written to be
                read plainly by a compliance officer, not buried in a clause.
              </p>
            </div>
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="flex flex-col gap-3">
                <GlassChip tone="brand" className="self-start">
                  Is
                </GlassChip>
                <ul className="flex flex-col gap-3">
                  {doesProve.map((row) => (
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
              <div className="flex flex-col gap-3">
                <GlassChip tone="outline" className="self-start">
                  Is not
                </GlassChip>
                <ul className="flex flex-col gap-3">
                  {doesNotProve.map((row) => (
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
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-3">
              <GlassChip tone="brand" className="self-start">
                § 04 · How a TAG pilot moves through the five gates
              </GlassChip>
              <h2 className="text-h2 font-display tracking-tight text-white">
                How a TAG pilot moves through the five gates.
              </h2>
              <p className="max-w-3xl text-body text-white/85">
                Five named human gates — The Oracles. Each gate has a named specialist approver, and
                the two bookends (Need Discovery and Software Build) can only be signed by the
                single named Elder Oracle. Every gate also requires at least one specialist attester
                on the handoff being decided. No specialist or model can move the mission past a
                gate without the named human in the right chair.
              </p>
            </div>
            <ol className="flex flex-col gap-3">
              {howItMoves.map((row) => (
                <li key={row.stage}>
                  <GlassCard tone="surface" padding="md" interactive>
                    <p className="font-display text-body font-semibold leading-snug text-foreground">
                      {row.stage}
                    </p>
                    <p className="text-small font-semibold text-brand-700">{row.oracle}</p>
                    <p className="text-small leading-relaxed text-card-foreground/85">
                      {row.detail}
                    </p>
                  </GlassCard>
                </li>
              ))}
            </ol>
          </div>

          <p className="text-small text-white/70">
            Want to brief a real council on an actual pilot engagement?{' '}
            <Link href="/request-walkthrough" className="link-brand">
              Request a walkthrough
            </Link>{' '}
            — an at-depth form for regulated buyers past the front-door brief. To see how the tier
            envelope scopes each pilot,{' '}
            <Link href="/pricing" className="link-brand">
              read the pricing page
            </Link>
            . For the front of the site,{' '}
            <Link href="/" className="link-brand">
              return to the home page
            </Link>
            .
          </p>
        </div>
      </section>
    </main>
  );
}
