// @polsia:user-owned — client island. Loads the seven-agent core model
// (1 Discovery, 2 Readiness, 3 Workflow, 4 Governance, 5 AI Build, 6 Partner,
// 7 Impact) from /api/agents through apiFetch + the shared CoreAgents
// contract, then renders it as a 4-3 grid (or 7-grid on lg) of <GlassCard>
// cells. Distinct from The Oracles — The Oracles are a five-voice governance
// council that audits the inbound brief; the seven-agent core is the runtime
// that operates the 21-day delivery pipeline (Agents 1..5) plus wraparound
// (Agents 6..7). Loading / empty / error guards mirror CouncilSections and
// FaqAccordion.
//
// Two exports since 2026-09-04 (real user feedback: "mention the types of
// agents, brief explanation, but not all this criteria ie operational
// boundaries — that should be visible only when you log into the
// platform"). CoreAgentsSection (full, with the boundary toggle) now lives
// only on the signed-in /dashboard/pipeline page. CoreAgentsSummary (name +
// one-line mandate, no toggle) is what the public /how-it-works page shows.
// GET /api/agents itself is session-gated (route.ts) — an anonymous request
// gets `boundary: undefined` on every item regardless of which component
// renders it, so AgentCard's toggle guards for that and simply doesn't
// render when there's nothing to show.

'use client';

import { ChevronDown } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { GlassCard, GlassChip, GlassPanel, GlassSectionHeader } from '@/components/custom/glass';
import { apiFetch } from '@/lib/api-client';
import {
  CoreAgents as CoreAgentsSchema,
  type CoreAgents as CoreAgentsType,
} from '@/lib/contracts/agents';

type Agent = CoreAgentsType['items'][number];

function ordinalPill(ordinal: number): string {
  return `№ ${String(ordinal).padStart(2, '0')}`;
}

function stagePill(agent: Agent): { label: string; tone: 'brand' | 'outline' | 'muted' } {
  if (agent.relatesToStage === 'Wraparound') {
    return { label: 'Wraps delivery', tone: 'outline' };
  }
  // Agent 5 (AI Build) operates the stage whose name is "Software Build".
  // Keep the stage name on the pill so the seven-agent core and the five-stage
  // pipeline stay unambiguously distinct.
  return { label: `Runs stage · ${agent.relatesToStage}`, tone: 'brand' };
}

// One labeled list inside the expanded boundary detail — reused for each of
// the seven boundary fields so they render identically.
function BoundaryList({ label, items }: { label: string; items: readonly string[] }) {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
        {label}
      </p>
      <ul className="flex flex-col gap-0.5">
        {items.map((item) => (
          <li key={item} className="text-small text-card-foreground/85">
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

/* Operational-boundary detail — per the "seven-agent control specification":
   every agent publishes its inputs, tools, outputs, prohibited actions,
   human-approval requirement, evidence produced, and success measures, so
   an agent reads as a bounded component with named limits rather than an
   opaque black box. Collapsed by default (seven cards' worth of this all
   expanded at once would overwhelm the page) — expands per-card on click. */
function AgentCard({ agent }: { agent: Agent }) {
  const [open, setOpen] = useState(false);
  const pill = stagePill(agent);
  const detailId = `agent-boundary-${agent.id}`;
  return (
    <GlassCard tone="surface" padding="md" className="h-full">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <span className="font-display text-caption font-semibold tracking-[0.1em] text-brand-700">
          {ordinalPill(agent.ordinal)}
        </span>
        <GlassChip tone={pill.tone} size="sm">
          {pill.label}
        </GlassChip>
      </div>
      <h3 className="font-display text-h4 tracking-tight text-foreground">{agent.role}</h3>
      <p className="text-small text-card-foreground/80">
        <span className="font-semibold">{agent.roleLong}.</span> {agent.mandate}
      </p>

      {/* boundary is undefined for an unauthenticated caller (route.ts) —
          this component is only ever mounted post-login now, but guarding
          here too means it degrades safely rather than crashing if that
          ever changes. */}
      {agent.boundary && (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls={detailId}
          className="mt-3 flex items-center gap-1.5 self-start text-caption font-semibold text-brand-700 hover:text-brand-800"
        >
          {open ? 'Hide operational boundaries' : 'Show operational boundaries'}
          <ChevronDown
            className={`size-3.5 transition-transform ${open ? 'rotate-180' : ''}`}
            aria-hidden="true"
          />
        </button>
      )}

      {open && agent.boundary && (
        <div id={detailId} className="mt-3 flex flex-col gap-3 border-t border-border pt-3">
          <BoundaryList label="Inputs" items={agent.boundary.inputs} />
          <BoundaryList label="Tools" items={agent.boundary.tools} />
          <BoundaryList label="Outputs" items={agent.boundary.outputs} />
          <BoundaryList label="Prohibited actions" items={agent.boundary.prohibited} />
          <div className="flex flex-col gap-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
              Human approval
            </p>
            <p className="text-small text-card-foreground/85">{agent.boundary.humanApproval}</p>
          </div>
          <BoundaryList label="Evidence produced" items={agent.boundary.evidence} />
          <BoundaryList label="Success measures" items={agent.boundary.successMeasures} />
        </div>
      )}
    </GlassCard>
  );
}

function AgentSkeleton({ ordinal }: { ordinal: string }) {
  return (
    <div className="glass-card flex h-full flex-col gap-3 rounded-2xl p-5 text-card-foreground">
      <div className="flex items-baseline justify-between">
        <span className="font-display text-caption font-semibold tracking-[0.1em] text-brand-700">
          № {ordinal}
        </span>
        <span className="h-4 w-24 animate-pulse rounded bg-muted" />
      </div>
      <div className="h-6 w-3/5 animate-pulse rounded bg-muted" />
      <div className="space-y-2">
        <div className="h-3 w-full animate-pulse rounded bg-muted" />
        <div className="h-3 w-11/12 animate-pulse rounded bg-muted" />
        <div className="h-3 w-4/6 animate-pulse rounded bg-muted" />
      </div>
    </div>
  );
}

function SectionLede() {
  return (
    <>
      The Oracles are the five-voice governance council that audits the brief before code. The
      seven-agent core is the runtime that actually operates the 21-day delivery pipeline:{' '}
      <span className="font-semibold text-foreground">
        Discovery, Readiness, Workflow, Governance, AI Build
      </span>{' '}
      run the five pipeline stages (stage 5 is itself called{' '}
      <span className="font-semibold text-foreground">Software Build</span>, operated by the AI
      Build agent). <span className="font-semibold text-foreground">Partner and Impact</span> wrap
      around delivery — Partner lands the runnable build on the buyer&rsquo;s infrastructure; Impact
      measures the change in the world it was meant to make.
    </>
  );
}

function FooterNote() {
  return (
    <p className="text-small text-card-foreground/85">
      <span className="font-semibold text-foreground">
        How this maps back to the rest of CARI Forge.
      </span>{' '}
      The seven-agent core is what actually runs a case. The Oracles are the five voices (Risk,
      Demand, Growth, Competition, Money) that read the case file and rule before the pipeline
      starts. The Elder Oracle is the chair that ties the rule back to a named human. Three distinct
      governance concepts — one delivery runtime.
    </p>
  );
}

export function CoreAgentsSection() {
  const [data, setData] = useState<CoreAgentsType | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    apiFetch('/api/agents', { schema: CoreAgentsSchema })
      .then((payload) => {
        if (active) setData(payload);
      })
      .catch(() => {
        if (active) setLoadError('Could not load the seven-agent core.');
      });
    return () => {
      active = false;
    };
  }, []);

  const items = data?.items ?? [];
  const isLoading = data === null;

  return (
    <section
      id="core-agents"
      className="section relative overflow-hidden section-aurora"
      aria-labelledby="core-agents-heading"
    >
      <div className="container-page flex flex-col gap-10">
        <GlassSectionHeader
          eyebrow="Core agents"
          title="Seven specialised agents operate the pipeline — distinct from The Oracles."
          lede={<SectionLede />}
        />

        {loadError && (
          <GlassPanel tone="surface" padding="md">
            <p className="text-small text-destructive">{loadError}</p>
          </GlassPanel>
        )}

        {/* 7-card grid: 2 cols on sm, 3 on md, 4 cols on lg with the last card wrapping to row 2. */}
        <ol className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {isLoading
            ? ['01', '02', '03', '04', '05', '06', '07'].map((o) => (
                <li key={o} className="h-full">
                  <AgentSkeleton ordinal={o} />
                </li>
              ))
            : items.map((agent) => (
                <li key={agent.id} className="h-full">
                  <AgentCard agent={agent} />
                </li>
              ))}
        </ol>

        <GlassPanel tone="panel" padding="lg" backdrop="soft">
          <FooterNote />
        </GlassPanel>
      </div>
    </section>
  );
}

// Public-page card: name, stage pill, and the one-line mandate — no
// operational-boundary toggle. `agent.boundary` is undefined here anyway
// (the API strips it for anonymous requests), so this simply never renders
// what it never receives.
function AgentSummaryCard({ agent }: { agent: Agent }) {
  const pill = stagePill(agent);
  return (
    <GlassCard tone="surface" padding="md" className="h-full">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <span className="font-display text-caption font-semibold tracking-[0.1em] text-brand-700">
          {ordinalPill(agent.ordinal)}
        </span>
        <GlassChip tone={pill.tone} size="sm">
          {pill.label}
        </GlassChip>
      </div>
      <h3 className="font-display text-h4 tracking-tight text-foreground">{agent.role}</h3>
      <p className="text-small text-card-foreground/80">
        <span className="font-semibold">{agent.roleLong}.</span> {agent.mandate}
      </p>
    </GlassCard>
  );
}

// Public /how-it-works version of the seven-agent grid: what each agent is
// and does, nothing about how it's actually bounded and evidenced — that's
// signed-in-only, on /dashboard/pipeline (see the file header comment for
// why). Same data source, same loading/error handling as CoreAgentsSection.
export function CoreAgentsSummary() {
  const [data, setData] = useState<CoreAgentsType | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    apiFetch('/api/agents', { schema: CoreAgentsSchema })
      .then((payload) => {
        if (active) setData(payload);
      })
      .catch(() => {
        if (active) setLoadError('Could not load the seven-agent core.');
      });
    return () => {
      active = false;
    };
  }, []);

  const items = data?.items ?? [];
  const isLoading = data === null;

  return (
    <section
      id="core-agents"
      className="section relative overflow-hidden section-aurora"
      aria-labelledby="core-agents-heading"
    >
      <div className="container-page flex flex-col gap-10">
        <GlassSectionHeader
          eyebrow="Core agents"
          title="Seven specialised agents operate the pipeline — distinct from The Oracles."
          lede={<SectionLede />}
        />

        {loadError && (
          <GlassPanel tone="surface" padding="md">
            <p className="text-small text-destructive">{loadError}</p>
          </GlassPanel>
        )}

        <ol className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {isLoading
            ? ['01', '02', '03', '04', '05', '06', '07'].map((o) => (
                <li key={o} className="h-full">
                  <AgentSkeleton ordinal={o} />
                </li>
              ))
            : items.map((agent) => (
                <li key={agent.id} className="h-full">
                  <AgentSummaryCard agent={agent} />
                </li>
              ))}
        </ol>

        <GlassPanel tone="panel" padding="lg" backdrop="soft" className="flex flex-col gap-3">
          <FooterNote />
          {/* Real user feedback (2026-09-04): full operational detail (what
              each agent can read, what it's forbidden from doing, what
              evidence it produces) moved behind login rather than sitting
              open on the public page. */}
          <p className="text-small text-card-foreground/80">
            Each agent&rsquo;s full operational boundaries — inputs, tools, outputs, prohibited
            actions, and success measures — along with the five-stage gate detail and technical
            architecture, are visible once you&rsquo;re signed in, on the{' '}
            <Link href="/dashboard/pipeline" className="link-brand">
              pipeline detail page
            </Link>
            .
          </p>
        </GlassPanel>
      </div>
    </section>
  );
}
