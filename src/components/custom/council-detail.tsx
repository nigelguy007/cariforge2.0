// @polsia:user-owned — /how-the-council-works client island. Loads three
// sections of static catalog copy (advisors, chairmanship, tiebreak) from
// /api/council through apiFetch + the shared CouncilDetail contract, then
// renders them in three vertical sections. Loading / empty / error guards
// match the faq-accordion + pricing-tiers pattern.

'use client';

import { useEffect, useState } from 'react';
import { GlassCard, GlassChip, GlassPanel, GlassSectionHeader } from '@/components/custom/glass';
import { apiFetch } from '@/lib/api-client';
import { CouncilDetail, type CouncilDetail as CouncilDetailType } from '@/lib/contracts/council';

type Advisor = CouncilDetailType['advisors'][number];
type Chairmanship = CouncilDetailType['chairmanship'][number];
type Tiebreak = CouncilDetailType['tiebreak'][number];

const DEFAULT_LABEL: Record<Advisor['default'], string> = {
  Objection: 'Objection by default',
  Supports: 'Supports by default',
  Qualifies: 'Qualifies by default',
};

function AdvisorCard({ advisor }: { advisor: Advisor }) {
  return (
    <GlassCard tone="surface" padding="md" interactive className="h-full">
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-display text-caption font-semibold tracking-[0.1em] text-brand-700">
          № {String(advisor.ordinal).padStart(2, '0')}
        </span>
        <GlassChip tone="brand" size="sm">
          {DEFAULT_LABEL[advisor.default]}
        </GlassChip>
      </div>
      <h3 className="font-display text-h3 tracking-tight text-foreground">{advisor.role}</h3>
      <p className="text-small text-card-foreground/85">
        <span className="font-semibold">{advisor.roleLong}.</span> {advisor.argues}
      </p>
      <div className="my-1 h-px w-full bg-gradient-to-r from-transparent via-brand-700/30 to-transparent" />
      <div className="flex flex-col gap-1">
        <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
          Typical dissent line
        </p>
        <p className="text-small text-card-foreground/80">{advisor.dissent}</p>
      </div>
      <blockquote className="mt-auto border-l-2 border-brand-600/60 pl-3 text-small italic text-foreground">
        &ldquo;{advisor.quote}&rdquo;
      </blockquote>
    </GlassCard>
  );
}

function ChairmanshipCard({ row }: { row: Chairmanship }) {
  return (
    <GlassCard tone="surface" padding="lg" className="h-full">
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-display text-caption font-semibold tracking-[0.1em] text-brand-700">
          Verdict {String(row.ordinal).padStart(2, '0')}
        </span>
        <GlassChip tone="brand" size="sm">
          Verdict · {row.verdict}
        </GlassChip>
      </div>
      <h3 className="mt-3 font-display text-h2 tracking-tight text-foreground">{row.verdict}</h3>
      <p className="text-body leading-relaxed text-card-foreground/85">{row.whatItMeans}</p>
      <div className="my-2 h-px w-full bg-gradient-to-r from-transparent via-brand-700/30 to-transparent" />
      <div className="flex flex-col gap-1">
        <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
          Dissent recorded as
        </p>
        <p className="text-small text-card-foreground/80">{row.dissentRecordedAs}</p>
      </div>
    </GlassCard>
  );
}

function TiebreakCard({ row }: { row: Tiebreak }) {
  return (
    <GlassCard tone="surface" padding="lg" className="h-full">
      <span className="font-display text-caption font-semibold tracking-[0.1em] text-brand-700">
        Rule {String(row.ordinal).padStart(2, '0')}
      </span>
      <h3 className="mt-2 font-display text-h3 tracking-tight text-foreground">{row.rule}</h3>
      <dl className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <dt className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
            Mechanism
          </dt>
          <dd className="text-small text-card-foreground/85">{row.mechanism}</dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
            Who signs
          </dt>
          <dd className="text-small text-card-foreground">{row.whoSigns}</dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
            What they attach
          </dt>
          <dd className="text-small text-card-foreground/85">{row.whatTheyAttach}</dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
            Applies to
          </dt>
          <dd className="text-small text-card-foreground/80">{row.appliesTo}</dd>
        </div>
      </dl>
    </GlassCard>
  );
}

function SkeletonCard({
  variant,
  ordinal,
}: {
  variant: 'advisor' | 'chair' | 'tie';
  ordinal: string;
}) {
  return (
    <div className="glass-card flex h-full flex-col gap-3 rounded-2xl p-5 text-card-foreground">
      <div className="flex items-baseline justify-between">
        <span className="font-display text-caption font-semibold tracking-[0.1em] text-brand-700">
          {variant === 'advisor' ? '№ ' : variant === 'chair' ? 'Verdict ' : 'Rule '}
          {ordinal}
        </span>
        <span className="h-4 w-24 animate-pulse rounded bg-muted" />
      </div>
      <div className="h-6 w-3/5 animate-pulse rounded bg-muted" />
      <div className="space-y-2">
        <div className="h-3 w-full animate-pulse rounded bg-muted" />
        <div className="h-3 w-5/6 animate-pulse rounded bg-muted" />
        <div className="h-3 w-4/6 animate-pulse rounded bg-muted" />
      </div>
    </div>
  );
}

function SkeletonTiebreakCard({ ordinal }: { ordinal: string }) {
  return (
    <div className="glass-card flex h-full flex-col gap-3 rounded-2xl p-6 text-card-foreground">
      <span className="font-display text-caption font-semibold tracking-[0.1em] text-brand-700">
        Rule {ordinal}
      </span>
      <div className="h-6 w-3/4 animate-pulse rounded bg-muted" />
      <div className="space-y-2">
        <div className="h-3 w-full animate-pulse rounded bg-muted" />
        <div className="h-3 w-11/12 animate-pulse rounded bg-muted" />
        <div className="h-3 w-4/6 animate-pulse rounded bg-muted" />
      </div>
    </div>
  );
}

export function CouncilSections() {
  const [data, setData] = useState<CouncilDetailType | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    apiFetch('/api/council', { schema: CouncilDetail })
      .then((payload) => {
        if (active) setData(payload);
      })
      .catch(() => {
        if (active) setLoadError('Could not load the council detail.');
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

  const advisors = data?.advisors ?? [];
  const chairmanship = data?.chairmanship ?? [];
  const tiebreak = data?.tiebreak ?? [];
  const isLoading = data === null;

  return (
    <div className="flex flex-col gap-16">
      <section className="flex flex-col gap-8" aria-labelledby="council-advisors">
        <GlassSectionHeader
          eyebrow="§ 01 · The council"
          title="Five agents with fixed remits, opening objections by default."
          lede="Each agent is tuned to a single angle and opens dissent first, demands evidence next, and only then supports. The five are deliberately not optimisable away from one another — opposing defaults is the point."
        />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {isLoading
            ? ['01', '02', '03', '04', '05'].map((o) => (
                <SkeletonCard key={o} variant="advisor" ordinal={o} />
              ))
            : advisors.map((a) => <AdvisorCard key={a.id} advisor={a} />)}
        </div>
        {!isLoading && advisors.length === 0 && (
          <p className="text-small text-muted-foreground">No advisor entries published yet.</p>
        )}
      </section>

      <section className="flex flex-col gap-8" aria-labelledby="council-chairmanship">
        <GlassSectionHeader
          eyebrow="§ 02 · The chairman’s ruling"
          title="Build · Test first · Walk away — and the dissent is filed before the forge advances."
          lede="The chair never overrides an unresolved objection. When the council cannot settle, and any verdict is contested, the case is held at the current stage and the dissent is written into the audit trail before the run moves on."
        />
        <div className="grid gap-6 md:grid-cols-3">
          {isLoading
            ? ['01', '02', '03'].map((o) => <SkeletonCard key={o} variant="chair" ordinal={o} />)
            : chairmanship.map((row) => <ChairmanshipCard key={row.id} row={row} />)}
        </div>
        {!isLoading && chairmanship.length === 0 && (
          <p className="text-small text-muted-foreground">No chairman rulings published yet.</p>
        )}
      </section>

      <section className="flex flex-col gap-8" aria-labelledby="council-tiebreak">
        <GlassSectionHeader
          eyebrow="§ 03 · The human tiebreaker"
          title="When the council cannot settle, the named human decides — with a typed reason attached."
          lede="The named human approver attached to the case file signs the ruling — approve, return, or refuse — with a typed reason recorded verbatim. The same named-human + typed-reason mechanic applies to every stage gate, not only to the chair’s tiebreak."
        />
        <div className="grid gap-6 md:grid-cols-3">
          {isLoading
            ? ['01', '02', '03'].map((o) => <SkeletonTiebreakCard key={o} ordinal={o} />)
            : tiebreak.map((row) => <TiebreakCard key={row.id} row={row} />)}
        </div>
        {!isLoading && tiebreak.length === 0 && (
          <p className="text-small text-muted-foreground">No tiebreak rules published yet.</p>
        )}
      </section>
    </div>
  );
}
