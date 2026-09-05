// @polsia:user-owned — /how-it-works. Holds the Oracles council, the
// seven-agent core (brief summary only), and the real brief-intake form —
// everything that used to live on the homepage below the hero, before the
// homepage became a single fixed-viewport hero (see src/app/(setup)/page.tsx
// and its own comment for why).
//
// The five-stage gate breakdown, "what governed actually means here,"
// systems of record, and the technical architecture diagram used to live
// here too, until real user feedback (2026-09-04): "this is giving away the
// app functionality to everyone." That detail — plus the full agent
// operational-boundary breakdown (CoreAgentsSection) — moved to the
// signed-in-only /dashboard/pipeline; see that file for what actually moved.
// This page keeps CoreAgentsSummary (name + one-line mandate per agent, no
// boundary detail) so a visitor still learns what the seven agents are.

import { ArrowRight } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { BriefIntakeForm } from '@/components/custom/brief-intake-form';
import { CoreAgentsSummary } from '@/components/custom/core-agents-section';
import {
  GlassCard,
  GlassChip,
  GlassCta,
  GlassPanel,
  GlassSectionHeader,
} from '@/components/custom/glass';
import { WorkflowConfigurator } from '@/components/custom/workflow-configurator';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { siteName } from '@/lib/site';

export const metadata: Metadata = {
  title: 'How it works',
  description:
    'The Oracles who argue every brief, the seven-agent core that operates the pipeline, and the five named human gates a mission passes through.',
  alternates: { canonical: '/how-it-works' },
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

function StanceBadge({ tone }: { tone: 'objection' | 'support' | 'qualify' }) {
  const label = tone === 'objection' ? 'Objection' : tone === 'support' ? 'Supports' : 'Qualifies';
  return (
    <GlassChip tone="brand" size="sm">
      {label}
    </GlassChip>
  );
}

export default function HowItWorksPage() {
  return (
    <main id="main-content" className="flex flex-col">
      <section id="front-door" className="section relative overflow-hidden section-aurora">
        <div className="container-page grid gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-start">
          <div className="flex flex-col gap-4">
            <GlassChip tone="brand" size="lg" className="self-start">
              How it works
            </GlassChip>
            <h1 className="font-display text-h1 tracking-tight text-foreground">
              The Oracles argue it. Five named humans gate it.
            </h1>
            <p className="max-w-xl text-body-lg text-muted-foreground">
              {siteName} turns your requirements into an approved build spec — and never releases it
              without a named human approving every stage. Read how below, or tell us what you want
              to build on the right and see it start.
            </p>
            <GlassCta asChild tone="outline" size="md" className="self-start">
              <Link href="#council">
                Meet The Oracles
                <ArrowRight className="size-4" />
              </Link>
            </GlassCta>
          </div>

          <GlassCard tone="highlight" padding="lg" className="self-start">
            <header className="mb-4 flex flex-col gap-2">
              <GlassChip tone="brand">Front door</GlassChip>
              <h2 className="font-display text-h3 tracking-tight text-foreground">
                What do you want to build using AI?
              </h2>
              {/* Real user feedback (2026-09-04): "change this language to
                  make sense / human." Same facts, plainer sentence
                  structure — no change in meaning. */}
              <p className="text-small text-card-foreground/80">
                A regulated buyer&rsquo;s question is all it takes to get started — write as much
                detail as the problem needs. The Oracles read every submission in full before any
                code is written, and the Elder Oracle settles anything they can&rsquo;t agree on.
              </p>
            </header>
            <BriefIntakeForm />
            <p className="mt-3 text-caption text-muted-foreground">
              A real human will reply — within 48 hours during the working week.
            </p>
          </GlassCard>
        </div>
      </section>

      {/* CONFIGURATOR — moved up next to the front door (was buried after
          6 explanatory sections, behind a near-duplicate "what do you want
          to build" prompt). This is the low-commitment hook: instant,
          nothing saved. The real form above it is the actual front door.
          Priority-11 item from the handoff doc: an actual, AI-backed
          indicative read, not a mock. Genuinely calls Claude via
          /api/configurator (src/lib/business/configurator.ts), gracefully
          degrading to a plain nudge toward the real form if
          ANTHROPIC_API_KEY isn't configured or the call fails. */}
      {/* Real user feedback (2026-09-04): "i gave a brief but dont know
          what is the difference with what do you want to build?" — this
          section used to sit open, right below the real front-door form,
          as a second full-size "describe your idea" box. Someone who had
          just submitted the real form scrolled straight into what looked
          like the same question again. Collapsed behind an explicit,
          differently-worded trigger so nothing competes with the real form
          by default — this only appears if you deliberately ask for it. */}
      <section id="configurator" className="section relative overflow-hidden section-aurora">
        <div className="container-page">
          <Accordion type="single" collapsible className="mx-auto w-full max-w-2xl">
            <AccordionItem value="configurator" className="border-none">
              <AccordionTrigger className="justify-center gap-2 rounded-full border border-border bg-secondary/60 px-5 py-2.5 text-small font-medium text-foreground hover:no-underline">
                Not ready to submit? Get a private, no-commitment gut-check first
              </AccordionTrigger>
              <AccordionContent className="pt-6">
                <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
                  <div className="flex flex-col gap-3">
                    <GlassChip tone="brand" className="self-start">
                      Try it first
                    </GlassChip>
                    <h2 className="font-display text-h3 tracking-tight text-foreground">
                      Get an instant read before you apply.
                    </h2>
                    <p className="text-body text-muted-foreground">
                      One minute, nothing saved, no account needed. This is a sandbox — it never
                      becomes a real submission. When you&rsquo;re ready for that, use the form
                      above instead; that&rsquo;s the one a named human actually reads.
                    </p>
                  </div>
                  <GlassCard tone="surface" padding="lg">
                    <WorkflowConfigurator />
                  </GlassCard>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </section>

      {/* PATHWAY — the 21-Day Forge proves the case; Production Forge (the
          Partner + Impact agents' real wraparound work) hands it to the
          buyer's own infrastructure and tracks whether it kept its
          promises. Kept deliberately modest: only claims what Partner and
          Impact's actual mandates cover (deployment handoff, realised-value
          tracking) — not integration/security-assurance/monitoring
          deliverables this system doesn't actually produce yet. */}
      <section id="pathway" className="section relative overflow-hidden section-aurora">
        <div className="container-page flex flex-col gap-10">
          <GlassSectionHeader
            eyebrow="From proof to production"
            title="A 21-day proof and a production handoff are two different promises."
            lede="The 21-Day Forge is bounded on purpose — a named problem, a finished, ready-to-use solution, and an evidence-based decision, inside three weeks. What happens after a case clears the last gate is a separate, connected stage, not an implied extension of the same 21 days."
          />
          <div className="grid gap-4 lg:grid-cols-2">
            <GlassCard tone="surface" padding="lg" className="h-full">
              <GlassChip tone="brand" className="self-start">
                Stage one
              </GlassChip>
              <h3 className="mt-3 font-display text-h4 tracking-tight text-foreground">
                The 21-Day Forge
              </h3>
              <p className="text-small text-card-foreground/80">
                Turns one named need into a governed, working proof and a decision you can act on.
                Agents 1&ndash;5 run it, gated by a named human at every stage.
              </p>
              <ul className="mt-2 flex flex-col gap-1 text-small text-card-foreground/85">
                <li>&middot; A testable problem statement, with named must-not-happen clauses</li>
                <li>&middot; A readiness audit and a build-versus-buy comparison</li>
                <li>&middot; A workflow design with human checkpoints and escalation paths</li>
                <li>&middot; A governance spec confirming the controls hold</li>
                <li>
                  &middot; An approved Blueprint and Runbook, with an audit trail and a hash chain
                </li>
              </ul>
            </GlassCard>
            <GlassCard tone="surface" padding="lg" className="h-full">
              <GlassChip tone="outline" className="self-start">
                Stage two
              </GlassChip>
              <h3 className="mt-3 font-display text-h4 tracking-tight text-foreground">
                Production Forge
              </h3>
              <p className="text-small text-card-foreground/80">
                Starts only once a case has cleared the Software Build gate. Run by the two
                wraparound agents — Partner and Impact — not part of the 21-day clock.
              </p>
              <ul className="mt-2 flex flex-col gap-1 text-small text-card-foreground/85">
                <li>
                  &middot; <span className="font-semibold text-foreground">Partner</span> hands the
                  approved build to your own infrastructure, with your integrator or cloud partner,
                  so your own people run it &mdash; not us
                </li>
                <li>
                  &middot; <span className="font-semibold text-foreground">Impact</span> reads back
                  whether the named must-not-happen clauses held once the build was live, and
                  whether the case's own economics showed up in production
                </li>
              </ul>
              <p className="mt-3 text-caption text-muted-foreground">
                Deeper integration work, formal security review, and ongoing operations are scoped
                per engagement once a case reaches this stage &mdash; they are not a default
                inclusion of the 21-day proof.
              </p>
            </GlassCard>
          </div>
        </div>
      </section>

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

      {/* CORE AGENTS — brief summary only (name + one-line mandate); full
          operational-boundary detail is signed-in-only, see the teaser
          section right below. */}
      <CoreAgentsSummary />

      {/* GATED-DETAIL TEASER — replaces the old public STAGES /
          SYSTEMS-OF-RECORD / ARCHITECTURE sections. Real user feedback
          (2026-09-04): "this is giving away the app functionality to
          everyone." That detail didn't disappear — it moved to
          /dashboard/pipeline, signed-in only. This section tells a visitor
          it exists and where, rather than silently vanishing. */}
      <section className="section relative overflow-hidden section-aurora">
        <div className="container-page">
          <GlassPanel tone="panel" padding="lg" className="section-aurora">
            <GlassChip tone="brand" className="self-start">
              Sign in for the full detail
            </GlassChip>
            <h2 className="mt-3 font-display text-h3 tracking-tight text-foreground">
              The five-stage gate breakdown, systems of record, and technical architecture live
              inside the platform.
            </h2>
            <p className="mt-2 max-w-2xl text-body text-card-foreground/85">
              What each of the five gates checks, how the audit trail and hash chain work, what CARI
              Forge does and doesn&rsquo;t touch in your own systems, and the five-layer
              architecture diagram &mdash; all visible once you&rsquo;re signed in, not published
              for anyone who visits.
            </p>
            <GlassCta asChild tone="brand" size="md" className="mt-4 self-start">
              <Link href="/dashboard/pipeline">
                Sign in to see the pipeline detail
                <ArrowRight className="size-4" />
              </Link>
            </GlassCta>
          </GlassPanel>
        </div>
      </section>

      {/* FIT — good-fit/poor-fit criteria, placed deliberately right before
          the closing CTA: lets a prospect self-qualify before they submit,
          rather than after. */}
      <section id="fit" className="section relative overflow-hidden section-aurora">
        <div className="container-page flex flex-col gap-10">
          <GlassSectionHeader
            eyebrow="Before you apply"
            title="What actually fits inside a 21-day proof — and what doesn't."
            lede="A bounded proof needs a bounded case. Checking fit before applying saves everyone a returned Discovery gate."
          />
          <div className="grid gap-4 lg:grid-cols-2">
            <GlassCard tone="highlight" padding="lg" className="h-full">
              <p className="font-display text-h4 tracking-tight text-foreground">Good fit</p>
              <ul className="mt-2 flex flex-col gap-2 text-small text-card-foreground/85">
                <li>&middot; A real workflow or service need with a named owner</li>
                <li>&middot; Accessible sample data or representative documents to test against</li>
                <li>&middot; A decision that can stay human-controlled where it needs to</li>
                <li>&middot; A measurable operational or customer outcome</li>
                <li>&middot; A case bounded enough to evaluate inside 21 days</li>
              </ul>
            </GlassCard>
            <GlassCard tone="surface" padding="lg" className="h-full">
              <p className="font-display text-h4 tracking-tight text-foreground">Not a good fit</p>
              <ul className="mt-2 flex flex-col gap-2 text-small text-card-foreground/85">
                <li>&middot; A generic chatbot with no defined workflow or named owner</li>
                <li>&middot; A speculative model comparison with no business outcome attached</li>
                <li>&middot; A request for uncontrolled, fully autonomous decisions</li>
                <li>&middot; A use case with no lawful or approved access to the data it needs</li>
                <li>&middot; A full enterprise transformation, presented as a 21-day solution</li>
              </ul>
            </GlassCard>
          </div>
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
              Read the council, scroll the stages, then come back up and submit. The form is the
              only call to action on this page &mdash; everything else is explanation.
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
