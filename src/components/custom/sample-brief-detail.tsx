// @polsia:user-owned — /sample-brief client island. Loads one concrete
// worked-example run (a regulated EU insurance claims-triage case) from
// /api/sample-brief through apiFetch + the shared SampleBrief contract, then
// renders it in six vertical sections: the brief as submitted, the council
// debate, the chairman's reconciled ruling, the five-stage pipeline of stage
// handoffs (operated by the seven-agent core; Agent 5 = AI Build, which
// operates Stage 5 = Software Build), Agent 5's working solution, and the
// supervisor sign-off footer. Loading / empty / error guards mirror the
// CouncilSections and FaqAccordion patterns.

'use client';

import { useEffect, useState } from 'react';
import { GlassCard, GlassChip, GlassPanel, GlassSectionHeader } from '@/components/custom/glass';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { apiFetch } from '@/lib/api-client';
import {
  SampleBrief as SampleBriefSchema,
  type SampleBrief as SampleBriefType,
} from '@/lib/contracts/sample-brief';

type Brief = SampleBriefType['brief'];
type Objection = SampleBriefType['council'][number];
type Ruling = SampleBriefType['ruling'];
type Stage = SampleBriefType['stages'][number];
type Solution = SampleBriefType['solution'];

const STANCE_LABEL: Record<Objection['stance'], string> = {
  Objection: 'Objection',
  Supports: 'Supports',
  Qualifies: 'Qualifies',
};

const ROLE_LONG_OVERRIDE: Record<Objection['role'], string> = {
  Risk: 'Risk oracle',
  Demand: 'Demand oracle',
  Growth: 'Growth oracle',
  Competition: 'Competition oracle',
  Money: 'Money oracle',
};

const DECISION_LABEL: Record<Stage['supervisor']['decision'], string> = {
  Approve: 'Approve',
  Return: 'Return',
  Refuse: 'Refuse',
};

function StanceBadge({ stance }: { stance: Objection['stance'] }) {
  return (
    <GlassChip tone="brand" size="sm">
      {STANCE_LABEL[stance]}
    </GlassChip>
  );
}

function VerdictBadge({ verdict }: { verdict: Ruling['verdict'] }) {
  return (
    <GlassChip tone="brand" size="sm">
      Verdict · {verdict}
    </GlassChip>
  );
}

function DecisionBadge({ decision }: { decision: Stage['supervisor']['decision'] }) {
  return (
    <GlassChip tone="brand" size="sm">
      {DECISION_LABEL[decision]}
    </GlassChip>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
        {label}
      </p>
      <p className="text-small text-card-foreground">{value}</p>
    </div>
  );
}

function BriefCard({
  brief,
  submittedOn,
  buyerOrg,
}: {
  brief: Brief;
  submittedOn: string;
  buyerOrg: string;
}) {
  return (
    <GlassCard tone="surface" padding="lg">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-eyebrow">Submitted brief · verbatim</p>
        <p className="font-mono text-caption text-muted-foreground">{submittedOn}</p>
      </div>
      <h3 className="mt-3 font-display text-h3 tracking-tight text-foreground">{buyerOrg}</h3>
      <p className="text-small text-muted-foreground">{brief.industry}</p>
      <div className="mt-6 flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
            Problem statement
          </p>
          <p className="text-body leading-relaxed text-card-foreground">{brief.problemStatement}</p>
        </div>
        <Separator />
        <div className="flex flex-col gap-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
            Proposed approach
          </p>
          <p className="text-body leading-relaxed text-card-foreground">{brief.proposedApproach}</p>
        </div>
        <Separator />
        <div className="flex flex-col gap-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
            Evidence submitted
          </p>
          <ul className="flex flex-col gap-2 text-small text-card-foreground">
            {brief.evidence.map((line) => (
              <li key={line} className="flex gap-2">
                <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-brand-600" />
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </div>
        <Separator />
        <div className="flex flex-col gap-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
            Must not happen (binding guard-rails)
          </p>
          <ul className="flex flex-col gap-2 text-small text-card-foreground">
            {brief.mustNotHappen.map((line) => (
              <li key={line} className="flex gap-2">
                <span aria-hidden className="mt-1 text-brand-700">
                  ✕
                </span>
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </GlassCard>
  );
}

function ObjectionCard({ obj }: { obj: Objection }) {
  return (
    <GlassCard tone="surface" padding="md" interactive className="h-full">
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-display text-caption font-semibold uppercase tracking-[0.1em] text-brand-700">
          {obj.role}
        </span>
        <StanceBadge stance={obj.stance} />
      </div>
      <p className="text-small text-card-foreground/85">
        <span className="font-semibold">{ROLE_LONG_OVERRIDE[obj.role]}.</span> {obj.objection}
      </p>
      <div className="my-1 h-px w-full bg-gradient-to-r from-transparent via-brand-700/30 to-transparent" />
      <div className="flex flex-col gap-1">
        <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
          Evidence asked for
        </p>
        <p className="text-small text-card-foreground/80">{obj.evidenceAskedFor}</p>
      </div>
    </GlassCard>
  );
}

function ObjectionSkeleton() {
  return (
    <div className="glass-card flex h-full flex-col gap-3 rounded-2xl p-5 text-card-foreground">
      <div className="flex items-baseline justify-between">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-20" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-11/12" />
        <Skeleton className="h-3 w-4/6" />
      </div>
      <Skeleton className="h-px w-full" />
      <div className="space-y-2">
        <Skeleton className="h-3 w-3/5" />
        <Skeleton className="h-3 w-4/5" />
      </div>
    </div>
  );
}

function RulingCard({ ruling }: { ruling: Ruling }) {
  return (
    <GlassCard tone="highlight" padding="lg" className="border-brand-300/60">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-eyebrow">Elder Oracle's reconciled ruling</p>
        <VerdictBadge verdict={ruling.verdict} />
      </div>
      <h3 className="mt-3 font-display text-h2 tracking-tight text-foreground">{ruling.verdict}</h3>
      <p className="text-small text-muted-foreground">
        The Elder Oracle sides with the dissenting voices on the contested points. No averaging.
      </p>
      <div className="mt-6 flex flex-col gap-6">
        <p className="text-body-lg leading-relaxed text-card-foreground">{ruling.reconciliation}</p>
        {ruling.carriedDissent.length > 0 && (
          <>
            <Separator />
            <div className="flex flex-col gap-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                Carry-forward items (no silent drop)
              </p>
              <ul className="flex flex-col gap-3">
                {ruling.carriedDissent.map((item) => (
                  <li
                    key={item}
                    className="rounded-md border border-brand-700/30 bg-white/5 px-3 py-2 text-small text-card-foreground backdrop-blur-sm"
                  >
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}
      </div>
    </GlassCard>
  );
}

function StageCard({ stage, isLast }: { stage: Stage; isLast: boolean }) {
  return (
    <GlassCard tone="surface" padding="md" interactive className="relative h-full">
      <div className="flex items-baseline justify-between">
        <div className="flex flex-col gap-1">
          <span className="font-display text-caption font-semibold uppercase tracking-[0.1em] text-brand-700">
            Agent {stage.agentOrdinal}
          </span>
          <h3 className="font-display text-h4 tracking-tight">{stage.agentName}</h3>
        </div>
        <span className="font-display text-caption text-muted-foreground">
          {String(stage.agentOrdinal).padStart(2, '0')}/05
        </span>
      </div>
      <div className="flex flex-col gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
          Output
        </p>
        <p className="text-small text-card-foreground/85">{stage.output}</p>
      </div>
      <div className="flex flex-col gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
          Downstream handoff
        </p>
        <p className="text-small text-card-foreground/80">{stage.downstreamHandoff}</p>
      </div>
      <div className="my-1 h-px w-full bg-gradient-to-r from-transparent via-brand-700/30 to-transparent" />
      <div className="flex flex-col gap-2 rounded-md border border-brand-700/20 bg-white/5 p-3 backdrop-blur-sm">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
            Supervisor
          </p>
          <DecisionBadge decision={stage.supervisor.decision} />
        </div>
        <p className="text-small text-card-foreground">
          <span className="font-semibold">{stage.supervisor.name}</span> ·{' '}
          <span className="text-muted-foreground">{stage.supervisor.role}</span>
        </p>
        <blockquote className="border-l-2 border-brand-600/60 pl-3 text-small italic text-card-foreground">
          &ldquo;{stage.supervisor.typedReason}&rdquo;
        </blockquote>
        <p className="font-mono text-caption text-muted-foreground">
          signed {stage.supervisor.signedAt}
        </p>
      </div>
      {!isLast && (
        <span
          aria-hidden
          className="pointer-events-none absolute -right-3 top-1/2 hidden h-0.5 w-6 -translate-y-1/2 bg-brand-700/40 lg:block"
        />
      )}
    </GlassCard>
  );
}

function StageSkeleton() {
  return (
    <div className="glass-card flex h-full flex-col gap-3 rounded-2xl p-5 text-card-foreground">
      <Skeleton className="h-5 w-2/5" />
      <Skeleton className="h-4 w-3/5" />
      <div className="space-y-2 pt-2">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-4/5" />
      </div>
      <div className="space-y-2 pt-2">
        <Skeleton className="h-3 w-3/5" />
        <Skeleton className="h-3 w-3/4" />
      </div>
    </div>
  );
}

function SolutionCard({ solution }: { solution: Solution }) {
  return (
    <GlassCard tone="highlight" padding="lg" className="border-brand-300/60">
      <p className="text-eyebrow">Agent 5 · AI Build · working solution</p>
      <h3 className="mt-3 font-display text-h3 tracking-tight text-foreground">
        {solution.component} · <span className="text-brand-700">{solution.route}</span>
      </h3>
      <p className="text-small text-card-foreground/80">{solution.mechanic}</p>
      <div className="mt-4 flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
            Data plane · routes + model
          </p>
          <ul className="flex flex-col gap-2">
            {solution.dataPlane.map((line) => (
              <li
                key={line}
                className="rounded-md border border-brand-700/30 bg-white/5 px-3 py-2 font-mono text-caption text-card-foreground backdrop-blur-sm"
              >
                {line}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </GlassCard>
  );
}

function ProductionDisclaimerBanner({ text }: { text: string }) {
  return (
    <GlassPanel tone="surface" padding="lg" backdrop="soft" aria-label="Production disclaimer">
      <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-brand-700">
        Production disclaimer
      </p>
      <p className="text-small leading-relaxed text-card-foreground/90">{text}</p>
    </GlassPanel>
  );
}

function SignOffPanel({
  stages,
  reviewer,
  caseId,
  submittedOn,
  closedOn,
}: {
  stages: Stage[];
  reviewer: string;
  caseId: string;
  submittedOn: string;
  closedOn: string;
}) {
  return (
    <GlassCard tone="surface" padding="lg">
      <p className="text-eyebrow">Audit trail · supervisor sign-off</p>
      <h3 className="mt-3 font-display text-h3 tracking-tight text-foreground">
        Case file receipt
      </h3>
      <div className="mt-5 flex flex-col gap-5">
        <dl className="grid gap-4 sm:grid-cols-2">
          <MetaRow label="Case ID" value={caseId} />
          <MetaRow label="Reviewer (named human approver)" value={reviewer} />
          <MetaRow label="Submitted" value={submittedOn} />
          <MetaRow label="Closed" value={closedOn} />
        </dl>
        <Separator />
        <div className="flex flex-col gap-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
            Supervisor gate decisions (chronological)
          </p>
          <ol className="flex flex-col gap-3">
            {stages.map((stage) => (
              <li
                key={stage.agentOrdinal}
                className="rounded-md border border-brand-700/30 bg-white/5 p-3 text-card-foreground backdrop-blur-sm"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-small font-semibold">
                    Agent {stage.agentOrdinal} · {stage.agentName}
                  </p>
                  <DecisionBadge decision={stage.supervisor.decision} />
                </div>
                <p className="text-small">
                  {stage.supervisor.name} · {stage.supervisor.role}
                </p>
                <p className="mt-1 text-small italic text-card-foreground/90">
                  &ldquo;{stage.supervisor.typedReason}&rdquo;
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {stage.supervisor.signedAt}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </GlassCard>
  );
}

function BriefSkeleton() {
  return (
    <GlassCard tone="surface" padding="lg">
      <Skeleton className="h-4 w-48" />
      <Skeleton className="mt-3 h-7 w-3/5" />
      <Skeleton className="mt-2 h-4 w-4/5" />
      <div className="mt-6 space-y-2">
        <Skeleton className="h-3 w-1/4" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-11/12" />
        <Skeleton className="h-4 w-4/6" />
      </div>
      <Separator className="my-4" />
      <div className="space-y-2">
        <Skeleton className="h-3 w-1/4" />
        <Skeleton className="h-4 w-full" />
      </div>
    </GlassCard>
  );
}

export function SampleBriefDetail() {
  const [data, setData] = useState<SampleBriefType | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    apiFetch('/api/sample-brief', { schema: SampleBriefSchema })
      .then((payload) => {
        if (active) setData(payload);
      })
      .catch(() => {
        if (active) setLoadError('Could not load the worked example.');
      });
    return () => {
      active = false;
    };
  }, []);

  if (loadError) {
    return (
      <GlassPanel tone="surface" padding="md">
        <p className="text-small text-destructive">{loadError}</p>
      </GlassPanel>
    );
  }

  if (data === null) {
    return <SampleBriefDetailLoading />;
  }

  return <SampleBriefDetailLoaded data={data} />;
}

function SampleBriefDetailLoading() {
  return (
    <div className="flex flex-col gap-section">
      <section className="flex flex-col gap-8" aria-labelledby="sb-brief">
        <GlassSectionHeader
          eyebrow="§ 01 · The brief as submitted"
          title="One concrete case: an EU insurer, 3,200 monthly claims, a four-line guard-rail."
          lede="What follows is a verbatim worked example — the buyer's brief, the oracles' reading, the Elder Oracle's reconciled ruling, and the five agents that turn it into a runnable Software Build. No abstraction, no fictional narrative."
        />
        <BriefSkeleton />
      </section>
      <section className="flex flex-col gap-8" aria-labelledby="sb-council">
        <GlassSectionHeader
          eyebrow="§ 02 · The Oracles"
          title="The Oracles — five fixed-remit voices, tuned to opposing defaults."
          lede="Five oracles, fixed remits, opposing defaults. Each oracle is tuned to a single angle. They open objections by default, not by exception. If the oracles cannot settle the case after one round of debate, the Elder Oracle stops the run and asks you, the human."
        />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {['01', '02', '03', '04', '05'].map((k) => (
            <ObjectionSkeleton key={k} />
          ))}
        </div>
      </section>
      <section className="flex flex-col gap-8" aria-labelledby="sb-ruling">
        <GlassSectionHeader
          eyebrow="§ 03 · The Elder Oracle's reconciled ruling"
          title="Build — with two carried-forward items, not silently dropped."
          lede="The Elder Oracle sides with Risk (a named human-only assertion step is added to the workflow, by structure) and with Growth (a typed note goes to the buyer on what the build unlocks downstream). The case advances to the Software Build."
        />
        <GlassCard tone="highlight" padding="lg">
          <Skeleton className="h-6 w-1/3" />
          <div className="mt-4 space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-11/12" />
            <Skeleton className="h-4 w-4/6" />
          </div>
        </GlassCard>
      </section>
      <section className="flex flex-col gap-8" aria-labelledby="sb-pipeline">
        <GlassSectionHeader
          eyebrow="§ 04 · The pipeline"
          title="Five named approvals, no hidden steps — operated by the seven-agent core."
          lede="Each stage advance (1..5; stage 5 = Software Build) requires a human approval by name, with a typed reason attached verbatim. The seven-agent core — Discovery, Readiness, Workflow, Governance, AI Build, Partner, Impact — operates the pipeline; AI Build (Agent 5) runs the Software Build stage (Stage 5). Returns are cheap; stops are free. Nothing jumps a gate."
        />
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-5">
          {['01', '02', '03', '04', '05'].map((k) => (
            <StageSkeleton key={k} />
          ))}
        </div>
      </section>
      <section className="flex flex-col gap-8" aria-labelledby="sb-solution">
        <GlassSectionHeader
          eyebrow="§ 05 · Agent 5 · AI Build · working solution"
          title="The runnable output — the audit trail is the warranty."
          lede="What Stage 5 (Software Build) actually ships: a per-claim review queue with a human-in-the-loop approve / request-info / refer-to-SIU workflow, an append-only prisma audit-trail model, and an immutable per-case hash chain. Not a video. A receipt."
        />
        <GlassCard tone="highlight" padding="lg">
          <Skeleton className="h-6 w-1/3" />
          <Skeleton className="mt-3 h-4 w-full" />
          <div className="mt-4 space-y-2">
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-11/12" />
          </div>
        </GlassCard>
      </section>
      <section className="flex flex-col gap-8" aria-labelledby="sb-signoff">
        <GlassSectionHeader
          eyebrow="§ 06 · Supervisor sign-off"
          title="Read the audit trail bottom-up."
          lede="A compliance officer can read this page and trace every approval — who signed, what they wrote, when. The case file is the receipt; the receipt is the article 12 / article 14 evidence."
        />
        <GlassCard tone="surface" padding="lg">
          <div className="space-y-2">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-5 w-1/2" />
          </div>
          <Separator className="my-4" />
          <div className="space-y-3">
            {['01', '02', '03', '04', '05'].map((k) => (
              <Skeleton key={k} className="h-16 w-full" />
            ))}
          </div>
        </GlassCard>
      </section>
    </div>
  );
}

function SampleBriefDetailLoaded({ data }: { data: SampleBriefType }) {
  return (
    <div className="flex flex-col gap-section">
      <ProductionDisclaimerBanner text={data.productionDisclaimer} />
      <section className="flex flex-col gap-8" aria-labelledby="sb-brief">
        <GlassSectionHeader
          eyebrow="§ 01 · The brief as submitted"
          title="One concrete case: an EU insurer, 3,200 monthly claims, a four-line guard-rail."
          lede="What follows is a verbatim worked example — the buyer's brief, the oracles' reading, the Elder Oracle's reconciled ruling, and the five agents that turn it into a runnable Software Build. No abstraction, no fictional narrative."
        />
        <BriefCard
          brief={data.brief}
          submittedOn={data.runMetadata.submittedOn}
          buyerOrg={data.runMetadata.buyerOrg}
        />
      </section>

      <section className="flex flex-col gap-8" aria-labelledby="sb-council">
        <GlassSectionHeader
          eyebrow="§ 02 · The Oracles"
          title="The Oracles — five fixed-remit voices, tuned to opposing defaults."
          lede="Five oracles, fixed remits, opposing defaults. Each oracle is tuned to a single angle. They open objections by default, not by exception. If the oracles cannot settle the case after one round of debate, the Elder Oracle stops the run and asks you, the human."
        />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {data.council.map((obj) => (
            <ObjectionCard key={obj.role} obj={obj} />
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-8" aria-labelledby="sb-ruling">
        <GlassSectionHeader
          eyebrow="§ 03 · The Elder Oracle's reconciled ruling"
          title="Build — with two carried-forward items, not silently dropped."
          lede="The Elder Oracle sides with Risk (a named human-only assertion step is added to the workflow, by structure) and with Growth (a typed note goes to the buyer on what the build unlocks downstream). The case advances to the Software Build."
        />
        <RulingCard ruling={data.ruling} />
      </section>

      <section className="flex flex-col gap-8" aria-labelledby="sb-pipeline">
        <GlassSectionHeader
          eyebrow="§ 04 · The pipeline"
          title="Five named approvals, no hidden steps — operated by the seven-agent core."
          lede="Each stage advance (1..5; stage 5 = Software Build) requires a human approval by name, with a typed reason attached verbatim. The seven-agent core — Discovery, Readiness, Workflow, Governance, AI Build, Partner, Impact — operates the pipeline; AI Build (Agent 5) runs the Software Build stage (Stage 5). Returns are cheap; stops are free. Nothing jumps a gate."
        />
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-5">
          {data.stages.map((stage, idx) => (
            <StageCard
              key={stage.agentOrdinal}
              stage={stage}
              isLast={idx === data.stages.length - 1}
            />
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-8" aria-labelledby="sb-solution">
        <GlassSectionHeader
          eyebrow="§ 05 · Agent 5 · AI Build · working solution"
          title="The runnable output — the audit trail is the warranty."
          lede="What Stage 5 (Software Build) actually ships: a per-claim review queue with a human-in-the-loop approve / request-info / refer-to-SIU workflow, an append-only prisma audit-trail model, and an immutable per-case hash chain. Not a video. A receipt."
        />
        <SolutionCard solution={data.solution} />
      </section>

      <section className="flex flex-col gap-8" aria-labelledby="sb-signoff">
        <GlassSectionHeader
          eyebrow="§ 06 · Supervisor sign-off"
          title="Read the audit trail bottom-up."
          lede="A compliance officer can read this page and trace every approval — who signed, what they wrote, when. The case file is the receipt; the receipt is the article 12 / article 14 evidence."
        />
        <SignOffPanel
          stages={data.stages}
          reviewer={data.runMetadata.reviewer}
          caseId={data.runMetadata.caseId}
          submittedOn={data.runMetadata.submittedOn}
          closedOn={data.runMetadata.closedOn}
        />
      </section>
    </div>
  );
}
