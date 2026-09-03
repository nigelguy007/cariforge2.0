// @polsia:user-owned — /how-it-works. Holds the Oracles council, the
// seven-agent core, the five-stage pipeline, and the real brief-intake form
// — everything that used to live on the homepage below the hero, before the
// homepage became a single fixed-viewport hero (see src/app/(setup)/page.tsx
// and its own comment for why). Nothing here is new copy; it's the same
// sections, moved so the working BriefIntakeForm and the Oracles/Stages
// explanation aren't lost, not replaced.

import { ArrowRight } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { BriefIntakeForm } from '@/components/custom/brief-intake-form';
import { CoreAgentsSection } from '@/components/custom/core-agents-section';
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
    goal: 'Translate the submitted requirements into a testable problem statement.',
    gate: 'Approve · Return · Refuse',
  },
  {
    ordinal: 'II',
    name: 'Readiness Review',
    goal: 'Audit data, integrations, and the regulatory regime before code.',
    gate: 'Approve · Return · Refuse',
  },
  {
    ordinal: 'III',
    name: 'Workflow Design',
    goal: 'Map the human checkpoints, escalation paths, and rollback.',
    gate: 'Approve · Return · Refuse',
  },
  {
    ordinal: 'IV',
    name: 'Governance Check',
    goal: 'Confirm the logging, oversight, and stop-the-line controls hold.',
    gate: 'Approve · Return · Refuse',
  },
  {
    ordinal: 'V',
    // COPY ACCURACY (2026-09-03, rebuild-brief review, same evidence as the
    // homepage fix in the same commit range): this stage's real gate in
    // src/lib/contracts/forge.ts (GATE_DEFS[4]) is named 'Prototype spec
    // approved', and that file's own comment states its output is "a pair
    // of schema-versioned *specification* documents, not deployable code."
    // "Produce the runnable... software build" overclaimed against the
    // product's own contract. Described here as what it actually is.
    name: 'Software Build',
    goal: 'Produce the approved Blueprint and Runbook — the schema-versioned build spec Agent 5 (AI Build) hands off.',
    gate: 'Approve · Return · Refuse — final approve releases the spec.',
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
              <p className="text-small text-card-foreground/80">
                A regulated buyer&rsquo;s question is enough to start — write as much as the problem
                needs. The Oracles read it verbatim before any code is written; the Elder Oracle
                rules on what they disagree about.
              </p>
            </header>
            <BriefIntakeForm />
            <p className="mt-3 text-caption text-muted-foreground">
              A real human will reply — within 48 hours during working weeks.
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
      <section id="configurator" className="section relative overflow-hidden section-aurora">
        <div className="container-page grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
          <div className="flex flex-col gap-3">
            <GlassChip tone="brand" className="self-start">
              Try it first
            </GlassChip>
            <h2 className="font-display text-h3 tracking-tight text-foreground">
              Get an instant read before you apply.
            </h2>
            <p className="text-body text-muted-foreground">
              One minute, nothing saved. When you&rsquo;re ready, the form above is what a named
              human actually reads.
            </p>
          </div>
          <GlassCard tone="surface" padding="lg">
            <WorkflowConfigurator />
          </GlassCard>
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
            lede="The 21-Day Forge is bounded on purpose — a named problem, a working prototype, and an evidence-based decision, inside three weeks. What happens after a case clears the last gate is a separate, connected stage, not an implied extension of the same 21 days."
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

      {/* CORE AGENTS — the seven-agent core that operates the pipeline (distinct from The Oracles) */}
      <CoreAgentsSection />

      {/* STAGES — five-step pipeline with explicit human gates */}
      <section id="stages" className="section relative overflow-hidden section-aurora">
        <div className="container-page flex flex-col gap-10">
          <GlassSectionHeader
            eyebrow="The stages"
            title="Five stages. Five named approvals. No hidden steps."
            lede="Every stage advances only after a human authorises it by name, with a typed reason attached and recorded. Return is cheap; stopping is free. Nothing jumps a gate."
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

          {/* Explicit governance controls, named — turns "governed" into
              verifiable mechanisms instead of a single adjective. Every
              item here is something this system actually does (named gate
              approvals, typed reasons, the append-only audit trail and hash
              chain from the AI Build agent's own mandate), not aspirational. */}
          <GlassPanel tone="panel" padding="lg" className="section-aurora">
            <GlassChip tone="brand" className="self-start">
              What &ldquo;governed&rdquo; actually means here
            </GlassChip>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <p className="font-display text-h4 tracking-tight text-foreground">
                  Named approvers
                </p>
                <p className="text-small text-card-foreground/80">
                  Every gate names the human who approved, returned, or refused it &mdash; never an
                  anonymous system action.
                </p>
              </div>
              <div>
                <p className="font-display text-h4 tracking-tight text-foreground">Typed reasons</p>
                <p className="text-small text-card-foreground/80">
                  Approve, return, and refuse all require a written reason, recorded in the case
                  file at the moment of decision.
                </p>
              </div>
              <div>
                <p className="font-display text-h4 tracking-tight text-foreground">
                  Append-only audit trail
                </p>
                <p className="text-small text-card-foreground/80">
                  Every gate decision writes an immutable record &mdash; nothing in the case file
                  history can be edited after the fact.
                </p>
              </div>
              <div>
                <p className="font-display text-h4 tracking-tight text-foreground">Hash chain</p>
                <p className="text-small text-card-foreground/80">
                  The audit trail is chained by hash, so a tampered or reordered record would be
                  detectable, not just discouraged.
                </p>
              </div>
              <div>
                <p className="font-display text-h4 tracking-tight text-foreground">
                  No gate-skipping
                </p>
                <p className="text-small text-card-foreground/80">
                  Agents 1&ndash;5 cannot approve their own gate, and AI Build cannot ship without
                  the Software Build gate&rsquo;s final approval.
                </p>
              </div>
              <div>
                <p className="font-display text-h4 tracking-tight text-foreground">
                  Full gate history
                </p>
                <p className="text-small text-card-foreground/80">
                  Every prior gate&rsquo;s decision and reasoning stays attached to the case file
                  for the agents and humans that come after it.
                </p>
              </div>
            </div>
          </GlassPanel>
        </div>
      </section>

      {/* SYSTEMS OF RECORD — CARI Forge doesn't replace what a buyer already
          runs; grounded directly in the Readiness agent's real mandate
          (audits the buyer's actual data sources and regulatory regime,
          locks a data-minimisation clause) rather than naming specific
          third-party integrations (Salesforce, SAP, M365) this system
          doesn't actually connect to yet. */}
      <section id="systems-of-record" className="section relative overflow-hidden section-aurora">
        <div className="container-page grid gap-10 lg:grid-cols-[1fr_1fr] lg:items-center">
          <div className="flex flex-col gap-3">
            <GlassChip tone="brand" className="self-start">
              Systems of record
            </GlassChip>
            <h2 className="font-display text-h3 tracking-tight text-foreground">
              CARI Forge doesn&rsquo;t ask you to replace what you already run.
            </h2>
            {/* Trimmed 2026-09-03 (rebuild-brief review, "explain a fact once"):
                this paragraph was restating the same three facts the bullet
                list two lines below it already covers in full — audit, the
                build-vs-buy comparison, the data-minimisation clause. Kept
                the claim, dropped the duplicate detail; the specifics now
                live in exactly one place. */}
            <p className="text-body text-muted-foreground">
              Your systems stay authoritative &mdash; the pipeline works with what you already have,
              not instead of it.
            </p>
          </div>
          <GlassCard tone="highlight" padding="lg">
            <p className="font-display text-h4 tracking-tight text-foreground">
              What this means in practice
            </p>
            <ul className="mt-2 flex flex-col gap-2 text-small text-card-foreground/85">
              <li>&middot; The Readiness agent only sees data you explicitly supply or name</li>
              <li>
                &middot; A build-versus-buy comparison is written before a line of code exists
              </li>
              <li>
                &middot; The data-minimisation clause is locked in the case file, not a promise
              </li>
              <li>
                &middot; Deeper, connector-level integration into a specific system of record is
                scoped per engagement in Production Forge, not assumed by default
              </li>
            </ul>
          </GlassCard>
        </div>
      </section>

      {/* ARCHITECTURE — Priority-10 item from the handoff doc. Shows only
          layers this system actually has: no "identity and access (SSO/
          RBAC)" layer (not verified real), no named third-party
          integration layer (Salesforce/SAP/M365 — not built), no
          "Caribbean Intelligence Graph" (not a real component here). Five
          real layers, top to bottom: where a case starts, the pipeline +
          council that rules on it, the seven agents that run it, the
          assurance records every gate produces, and the two wraparound
          agents that hand a case to production. */}
      <section id="architecture" className="section relative overflow-hidden section-aurora">
        <div className="container-page flex flex-col gap-10">
          <GlassSectionHeader
            eyebrow="Technical architecture"
            title="What actually runs a case, layer by layer."
          />
          {/* Collapsed-by-default disclosure (rebuild-brief review: "move
              technical control details to... expandable disclosures" rather
              than leaving them in the default scroll). Radix's Accordion —
              already used on /faq — keeps the content in server-rendered
              HTML at all times (just visually/ARIA-hidden while closed), so
              this stays reachable to a11y tooling and to anyone who expands
              it; it just isn't forced on every visitor by default. */}
          <Accordion type="single" collapsible className="mx-auto w-full max-w-3xl">
            <AccordionItem value="architecture" className="border-none">
              <AccordionTrigger className="justify-center gap-2 rounded-full border border-border bg-secondary/60 px-5 py-2.5 text-small font-medium text-foreground hover:no-underline">
                Show the five-layer architecture
              </AccordionTrigger>
              <AccordionContent className="pt-6">
                <div className="mx-auto flex w-full max-w-3xl flex-col items-stretch">
                  {(
                    [
                      {
                        label: 'Where a case starts',
                        items: ['Front-door brief', 'Workflow configurator (indicative)'],
                      },
                      {
                        label: 'Council & orchestration',
                        items: [
                          'The Oracles (5 voices)',
                          'Elder Oracle ruling',
                          '5-stage gated pipeline',
                        ],
                      },
                      {
                        label: 'Agent layer',
                        items: [
                          'Discovery',
                          'Readiness',
                          'Workflow',
                          'Governance',
                          'AI Build',
                          'Partner',
                          'Impact',
                        ],
                      },
                      {
                        label: 'Assurance',
                        items: [
                          'Case file',
                          'Typed gate decisions',
                          'Append-only audit trail',
                          'Hash chain',
                        ],
                      },
                      {
                        label: 'Production handoff',
                        items: [
                          'Partner → buyer infrastructure',
                          'Impact → realised-value read-out',
                        ],
                      },
                    ] as const
                  ).map((layer, idx, arr) => (
                    <div key={layer.label} className="flex flex-col items-center">
                      <GlassPanel tone="surface" padding="md" className="w-full">
                        <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                          {layer.label}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {layer.items.map((item) => (
                            <GlassChip key={item} tone="outline" size="sm">
                              {item}
                            </GlassChip>
                          ))}
                        </div>
                      </GlassPanel>
                      {idx < arr.length - 1 && (
                        <div
                          className="h-6 w-px bg-gradient-to-b from-brand-700/40 to-brand-700/10"
                          aria-hidden="true"
                        />
                      )}
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
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
                <li>&middot; A full enterprise transformation, presented as a 21-day prototype</li>
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
