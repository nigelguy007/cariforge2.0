// @polsia:user-owned — landing page served at /. Keep this a Server Component
// so its `metadata` export is preserved and the page can be statically
// rendered. The brief intake form is the only interactive surface — it is a
// 'use client' island imported here.

import { ArrowRight } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { BriefIntakeForm } from '@/components/custom/brief-intake-form';
import { CoreAgentsSection } from '@/components/custom/core-agents-section';
import {
  GlassCard,
  GlassChip,
  GlassCta,
  GlassHero,
  GlassPanel,
  GlassSectionHeader,
} from '@/components/custom/glass';
import { JsonLd } from '@/components/custom/json-ld';
import { organization, website } from '@/lib/jsonld';
import { siteDescription, siteName } from '@/lib/site';

export const metadata: Metadata = {
  title: { absolute: siteName },
  description: siteDescription,
  alternates: { canonical: '/' },
  openGraph: {
    title: siteName,
    description: siteDescription,
    images: ['/opengraph-image'],
  },
};

const COUNCIL: Array<{
  ordinal: string;
  role: string;
  roleLong: string;
  stance: string;
  badge: 'objection' | 'support' | 'qualify';
  caption: string;
}> = [
  {
    ordinal: '01',
    role: 'Risk',
    roleLong: 'Risk oracle',
    stance: 'What breaks if this fails in production?',
    badge: 'objection',
    caption: 'Surfaces compliance gaps, model risk, and breach exposure first.',
  },
  {
    ordinal: '02',
    role: 'Demand',
    roleLong: 'Demand oracle',
    stance: 'Is there a real user, not just a stakeholder?',
    badge: 'support',
    caption: 'Pressure-tests evidence for the problem against pilot data.',
  },
  {
    ordinal: '03',
    role: 'Growth',
    roleLong: 'Growth oracle',
    stance: 'Does solving this unlock anything downstream?',
    badge: 'qualify',
    caption: 'Separates one-off asks from durable capability.',
  },
  {
    ordinal: '04',
    role: 'Competition',
    roleLong: 'Competition oracle',
    stance: 'Could a credible off-the-shelf tool already do this?',
    badge: 'qualify',
    caption: 'Demands build versus buy be decided explicitly, by name.',
  },
  {
    ordinal: '05',
    role: 'Money',
    roleLong: 'Money oracle',
    stance: 'Is the unit economics honest at the scale we expect?',
    badge: 'objection',
    caption: 'Refuses numbers that depend on the AI behaving differently later.',
  },
];

const STAGES: Array<{
  ordinal: string;
  name: string;
  goal: string;
  gate: string;
  agentBadge?: string;
}> = [
  {
    ordinal: 'I',
    name: 'Need Discovery',
    goal: 'Translate the one-line brief into a testable problem statement.',
    gate: 'Approve, return, or refuse — with a typed reason recorded.',
  },
  {
    ordinal: 'II',
    name: 'Readiness Review',
    goal: 'Audit data, integrations, and the regulatory regime before code.',
    gate: 'Approve, return, or refuse — with a typed reason recorded.',
  },
  {
    ordinal: 'III',
    name: 'Workflow Design',
    goal: 'Map the human checkpoints, escalation paths, and rollback.',
    gate: 'Approve, return, or refuse — with a typed reason recorded.',
  },
  {
    ordinal: 'IV',
    name: 'Governance Check',
    goal: 'Confirm the logging, oversight, and stop-the-line controls hold.',
    gate: 'Approve, return, or refuse — with a typed reason recorded.',
  },
  {
    ordinal: 'V',
    name: 'Software Build',
    goal: 'Produce the runnable Next.js + TypeScript software build (operated by Agent 5 — AI Build).',
    gate: 'Approve, return, or refuse — with a typed reason recorded. Final approve releases the Software Build stage.',
    agentBadge: 'Agent 5 · AI Build',
  },
];

function StanceBadge({ tone }: { tone: 'objection' | 'support' | 'qualify' }) {
  const label = tone === 'objection' ? 'Objection' : tone === 'support' ? 'Supports' : 'Qualifies';
  return (
    <GlassChip tone="brand" size="sm">
      {label}
    </GlassChip>
  );
}

export default function Home() {
  return (
    <main className="flex flex-col">
      <JsonLd script={organization} />
      <JsonLd script={website} />
      {/* HERO — editorial split: pronouncement + brief intake form */}
      <GlassHero
        eyebrow={<>EU AI Act · Article 12 &amp; 14 ready · Built for regulated procurement</>}
        title="Software the AI"
        accent="can’t sign off on."
        lede={`${siteName} turns a one-line business brief into a runnable Next.js + TypeScript software build &mdash; and then refuses to release it without a named human approving every stage. The Oracles of CARI Forge argue the brief first; the Elder Oracle rules; if they cannot settle, you decide.`}
        ctas={
          <GlassCta asChild tone="outline" size="md">
            <Link href="#council">
              Meet The Oracles
              <ArrowRight className="size-4" />
            </Link>
          </GlassCta>
        }
        meta={
          <dl className="mt-2 grid max-w-xl grid-cols-3 gap-4 border-t border-white/20 pt-6 text-small">
            <div className="flex flex-col gap-1">
              <dt className="text-white/70">Five-step pipeline</dt>
              <dd className="font-semibold text-white">Need &rarr; Build</dd>
            </div>
            <div className="flex flex-col gap-1">
              <dt className="text-white/70">Per-stage gate</dt>
              <dd className="font-semibold text-white">Named human</dd>
            </div>
            <div className="flex flex-col gap-1">
              <dt className="text-white/70">Output</dt>
              <dd className="font-semibold text-white">Runnable repo</dd>
            </div>
          </dl>
        }
        sideEyebrow="Front door"
        sideTitle="Leave a one-line brief."
        sideLede={
          <>
            A regulated buyer&rsquo;s question is enough to start. The Oracles read it verbatim
            before any code is written; the Elder Oracle rules on what they disagree about.
          </>
        }
        side={
          <>
            <BriefIntakeForm />
            <p className="mt-3 text-caption text-muted-foreground">
              The pilot is closed and run by hand. A real human will reply — within 48 hours during
              working weeks.
            </p>
            <p className="mt-3 text-small text-card-foreground/80">
              Want the depth? Read{' '}
              <Link href="/how-the-council-works" className="link-brand">
                how The Oracles work
              </Link>{' '}
              for the five advisor remits, the Elder Oracle&rsquo;s ruling logic, and the rule that
              ties back to you.
            </p>
          </>
        }
        id="how-it-works"
      />

      {/* COUNCIL — five voices (The Oracles), then the chairman (Elder Oracle) */}
      <section id="council" className="section relative overflow-hidden section-aurora">
        <div className="container-page flex flex-col gap-10">
          <GlassSectionHeader
            eyebrow="The Oracles"
            title="The Oracles of CARI Forge — five voices, fixed remits, opposing defaults."
            lede="The Oracles each argue from a single angle. They open objections by default, not by exception. If The Oracles cannot settle the case after one round of debate, the Elder Oracle stops the run and asks you, the human."
          />

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {COUNCIL.map((voice) => (
              <GlassCard
                key={voice.ordinal}
                tone="surface"
                padding="md"
                interactive
                className="h-full"
              >
                <div className="mb-2 flex items-baseline justify-between gap-2">
                  <span className="font-display text-caption font-semibold tracking-[0.1em] text-brand-700">
                    № {voice.ordinal}
                  </span>
                  <StanceBadge tone={voice.badge} />
                </div>
                <h3 className="font-display text-h4 tracking-tight text-foreground">
                  {voice.role}
                </h3>
                <p className="text-small text-card-foreground/80">
                  <span className="font-semibold">{voice.roleLong}.</span> Default stance:{' '}
                  {voice.caption}
                </p>
                <blockquote className="mt-auto border-l-2 border-brand-600/60 pl-3 text-small italic text-foreground">
                  &ldquo;{voice.stance}&rdquo;
                </blockquote>
              </GlassCard>
            ))}
          </div>

          <GlassPanel
            tone="panel"
            padding="lg"
            className="section-aurora lg:grid lg:grid-cols-[auto_1fr] lg:items-center lg:gap-10"
          >
            <div className="flex flex-col items-start gap-2">
              <GlassChip tone="brand">Elder Oracle ruling</GlassChip>
              <p className="font-display text-h4 tracking-tight text-foreground">
                Build &middot; Test first &middot; Walk away
              </p>
            </div>
            <p className="mt-4 text-body-lg text-card-foreground/85 lg:mt-0">
              The Elder Oracle never overrides an unresolved objection. When The Oracles give three
              verdicts &mdash;{' '}
              <span className="font-semibold text-foreground">build it, test it first,</span> or{' '}
              <span className="font-semibold text-foreground">walk away</span> &mdash; and one of
              them is contested, the human is the tiebreaker. The Elder Oracle&rsquo;s decision and
              its rationale are written into the case file before the forge moves on.
            </p>
          </GlassPanel>
        </div>
      </section>

      {/* CORE AGENTS — the seven-agent core that operates the pipeline (distinct from The Oracles) */}
      <CoreAgentsSection />

      {/* STAGES — five-step pipeline with explicit human gates */}
      <section id="stages" className="section relative overflow-hidden section-aurora">
        <div className="container-page flex flex-col gap-10">
          <GlassSectionHeader
            eyebrow="The stages"
            title="Five agents. Five named approvals. No hidden steps."
            lede="Every agent advances only after a human authorises it by name, with a typed reason attached and recorded. Return is cheap; stopping is free. Nothing jumps a gate."
          />

          <ol className="grid gap-4 md:grid-cols-5">
            {STAGES.map((stage, idx) => (
              <li key={stage.ordinal} className="h-full">
                <GlassCard tone="surface" padding="md" interactive className="h-full">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="font-display text-caption font-semibold tracking-[0.1em] text-brand-700">
                      {stage.agentBadge ?? `Stage ${stage.ordinal}`}
                    </span>
                    <span className="font-display text-caption text-muted-foreground">
                      {String(idx + 1).padStart(2, '0')}/05
                    </span>
                  </div>
                  <h3 className="font-display text-h4 tracking-tight text-foreground">
                    {stage.name}
                  </h3>
                  <p className="text-small text-card-foreground/80">{stage.goal}</p>
                  <div className="my-1 h-px w-full bg-gradient-to-r from-transparent via-brand-700/30 to-transparent" />
                  <div className="flex flex-col gap-1">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                      Human gate
                    </p>
                    <p className="text-small text-card-foreground">{stage.gate}</p>
                  </div>
                </GlassCard>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* FRONT-DOOR REMINDER — anchors the back of the page to the only CTA */}
      <section className="section relative overflow-hidden section-aurora">
        <div className="container-page">
          <GlassCard tone="panel" padding="lg" className="section-aurora">
            <GlassChip tone="brand" className="self-start">
              One CTA, on this page
            </GlassChip>
            <h2 className="mt-3 font-display text-h3 tracking-tight text-foreground">
              Open the file. Leave a brief.
            </h2>
            <p className="mt-2 max-w-3xl text-body text-card-foreground/85">
              Read the council, scroll the stages, then come back and submit. The form is the only
              call to action on the page &mdash; everything else is explanation.
            </p>
            <p className="mt-4 text-small text-muted-foreground">
              Need to reach a named human before submitting?{' '}
              <a
                href="mailto:cari-forge@polsia.app?subject=CARI%20Forge%20pilot%20enquiry"
                className="link-brand"
              >
                cari-forge@polsia.app
              </a>{' '}
              or read{' '}
              <Link href="/faq" className="link-brand">
                the FAQ
              </Link>{' '}
              for what a regulated buyer asks first.
            </p>
          </GlassCard>
        </div>
      </section>
    </main>
  );
}
