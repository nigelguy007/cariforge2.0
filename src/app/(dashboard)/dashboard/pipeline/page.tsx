// @polsia:user-owned — /dashboard/pipeline. Signed-in-only detail view.
//
// Real user feedback (2026-09-04): "this type of information should only be
// visible if you create a profile... this is giving away the app
// functionality to everyone." This page holds exactly what was removed from
// the public /how-it-works page: the five-stage gate breakdown, "what
// governed actually means here," systems of record, the five-layer
// technical architecture, and the full seven-agent operational-boundary
// detail (CoreAgentsSection, not the public CoreAgentsSummary). Nothing here
// is new copy — it's the same sections that used to sit on the public page,
// moved, not rewritten. Reachable only signed in: this route lives under the
// (dashboard) route group, so DashboardShell's own session check redirects
// an unauthenticated visitor to /login before this content ever renders.

import type { Metadata } from 'next';
import { CoreAgentsSection } from '@/components/custom/core-agents-section';
import { GlassCard, GlassChip, GlassPanel, GlassSectionHeader } from '@/components/custom/glass';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

export const metadata: Metadata = {
  title: 'Pipeline detail',
  description:
    'The five-stage gate breakdown, systems of record, technical architecture, and full agent operational boundaries.',
};

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
    name: 'Software Build',
    goal: 'Produce the approved Blueprint and Runbook — the schema-versioned build spec Agent 5 (AI Build) hands off.',
    gate: 'Approve · Return · Refuse — final approve releases the spec.',
    agentBadge: 'Agent 5 · AI Build',
  },
];

export default function PipelineDetailPage() {
  return (
    <div className="flex flex-col gap-12">
      <header className="flex flex-col gap-2">
        <GlassChip tone="brand" size="lg" className="self-start">
          Pipeline detail
        </GlassChip>
        <h1 className="font-display text-h2 tracking-tight text-foreground">
          The full stage, agent, and architecture detail.
        </h1>
        <p className="max-w-2xl text-body text-muted-foreground">
          This is the detail that used to sit on the public how-it-works page — moved here so it's
          visible to people building on CARI Forge, not to anyone who happens to visit.
        </p>
      </header>

      {/* CORE AGENTS — full detail, with the operational-boundary toggle. */}
      <CoreAgentsSection />

      {/* STAGES — five-step pipeline with explicit human gates */}
      <section id="stages" className="flex flex-col gap-10">
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

        <GlassPanel tone="panel" padding="lg" className="section-aurora">
          <GlassChip tone="brand" className="self-start">
            What &ldquo;governed&rdquo; actually means here
          </GlassChip>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <p className="font-display text-h4 tracking-tight text-foreground">Named approvers</p>
              <p className="text-small text-card-foreground/80">
                Every gate names the human who approved, returned, or refused it &mdash; never an
                anonymous system action.
              </p>
            </div>
            <div>
              <p className="font-display text-h4 tracking-tight text-foreground">Typed reasons</p>
              <p className="text-small text-card-foreground/80">
                Approve, return, and refuse all require a written reason, recorded in the case file
                at the moment of decision.
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
                Agents 1&ndash;5 cannot approve their own gate, and AI Build cannot ship without the
                Software Build gate&rsquo;s final approval.
              </p>
            </div>
            <div>
              <p className="font-display text-h4 tracking-tight text-foreground">
                Full gate history
              </p>
              <p className="text-small text-card-foreground/80">
                Every prior gate&rsquo;s decision and reasoning stays attached to the case file for
                the agents and humans that come after it.
              </p>
            </div>
          </div>
        </GlassPanel>
      </section>

      {/* SYSTEMS OF RECORD */}
      <section id="systems-of-record" className="flex flex-col gap-6">
        <GlassChip tone="brand" className="self-start">
          Systems of record
        </GlassChip>
        <h2 className="font-display text-h3 tracking-tight text-foreground">
          CARI Forge doesn&rsquo;t ask you to replace what you already run.
        </h2>
        <p className="text-body text-muted-foreground">
          Your systems stay authoritative &mdash; the pipeline works with what you already have, not
          instead of it.
        </p>
        <GlassCard tone="highlight" padding="lg">
          <p className="font-display text-h4 tracking-tight text-foreground">
            What this means in practice
          </p>
          <ul className="mt-2 flex flex-col gap-2 text-small text-card-foreground/85">
            <li>&middot; The Readiness agent only sees data you explicitly supply or name</li>
            <li>&middot; A build-versus-buy comparison is written before a line of code exists</li>
            <li>&middot; The data-minimisation clause is locked in the case file, not a promise</li>
            <li>
              &middot; Deeper, connector-level integration into a specific system of record is
              scoped per engagement in Production Forge, not assumed by default
            </li>
          </ul>
        </GlassCard>
      </section>

      {/* TECHNICAL ARCHITECTURE */}
      <section id="architecture" className="flex flex-col gap-10">
        <GlassSectionHeader
          eyebrow="Technical architecture"
          title="What actually runs a case, layer by layer."
        />
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
                      items: ['Partner → buyer infrastructure', 'Impact → realised-value read-out'],
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
      </section>
    </div>
  );
}
