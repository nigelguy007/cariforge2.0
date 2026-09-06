// @polsia:user-owned — /pricing client island. Loads the three inquiry-only
// tiers from /api/pricing through apiFetch + the shared PricingTiers
// contract, then renders a Card per tier with a bullet list of inclusions and
// an inquiry CTA that anchors to the home page's brief intake form. Loading
// / empty / error guards match the faq-accordion pattern.

'use client';

import { AlertCircle, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { GlassCard, GlassChip } from '@/components/custom/glass';
import { Button } from '@/components/ui/button';
import { apiFetch } from '@/lib/api-client';
import {
  PricingTiers as PricingTiersSchema,
  type PricingTiers as PricingTiersType,
} from '@/lib/contracts/pricing';

type Tier = PricingTiersType['items'][number];

function TierCard({ tier }: { tier: Tier }) {
  return (
    <GlassCard tone="surface" padding="lg" interactive className="h-full">
      <GlassChip tone="brand" size="sm" className="self-start">
        Tier {String(tier.ordinal).padStart(2, '0')}
      </GlassChip>
      <h3 className="mt-3 font-display text-h2 tracking-tight text-foreground">{tier.name}</h3>
      <p className="font-display text-body italic text-card-foreground/80">{tier.tagline}</p>
      <div className="mt-5 flex flex-1 flex-col gap-5">
        <p className="text-body leading-relaxed text-card-foreground/85">{tier.summary}</p>
        <div className="flex flex-col gap-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
            What is included
          </p>
          <ul className="flex flex-col gap-2 text-small text-card-foreground">
            {tier.inclusions.map((line) => (
              <li key={line} className="flex gap-2">
                <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-brand-600" />
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </div>
        <p className="text-small text-muted-foreground">
          Scope and limits are defined at{' '}
          <Link href="/why-this-is-a-scaffold" className="link-brand">
            /why-this-is-a-scaffold
          </Link>
          .
        </p>
        <div className="mt-auto flex flex-col gap-2 pt-2">
          <Button asChild size="lg" variant="outline" className="w-full rounded-full">
            <Link href="/#how-it-works">
              Inquire about {tier.name}
              <ArrowRight className="size-4" />
            </Link>
          </Button>
          <Button asChild variant="ghost" size="sm" className="w-full text-muted-foreground">
            <Link href="/request-walkthrough">Request a council walkthrough</Link>
          </Button>
        </div>
      </div>
    </GlassCard>
  );
}

function SkeletonCard({ ordinal }: { ordinal: string }) {
  return (
    <GlassCard tone="surface" padding="lg" className="h-full">
      <GlassChip tone="brand" size="sm" className="self-start">
        Tier {ordinal}
      </GlassChip>
      <div className="mt-3 h-7 w-1/2 animate-pulse rounded bg-muted" />
      <div className="mt-2 h-5 w-3/4 animate-pulse rounded bg-muted" />
      <div className="mt-5 flex flex-1 flex-col gap-5">
        <div className="space-y-2">
          <div className="h-4 w-full animate-pulse rounded bg-muted" />
          <div className="h-4 w-5/6 animate-pulse rounded bg-muted" />
        </div>
        <div className="space-y-2">
          <div className="h-3 w-1/3 animate-pulse rounded bg-muted" />
          <div className="h-4 w-full animate-pulse rounded bg-muted" />
          <div className="h-4 w-11/12 animate-pulse rounded bg-muted" />
          <div className="h-4 w-full animate-pulse rounded bg-muted" />
        </div>
        <div className="mt-auto flex flex-col gap-2 pt-2">
          <div className="h-10 w-full animate-pulse rounded-md bg-muted" />
          <div className="h-8 w-full animate-pulse rounded-md bg-muted/60" />
        </div>
      </div>
    </GlassCard>
  );
}

export function PricingTiers() {
  const [items, setItems] = useState<Tier[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    apiFetch('/api/pricing', { schema: PricingTiersSchema })
      .then((data) => {
        if (active) setItems(data.items);
      })
      .catch(() => {
        if (active) setLoadError('Could not load the pricing tiers.');
      });
    return () => {
      active = false;
    };
  }, []);

  if (loadError) {
    return (
      <GlassCard
        role="alert"
        tone="surface"
        padding="md"
        className="border border-destructive/40 bg-destructive/5 text-sm text-destructive"
      >
        <div className="flex items-start gap-3">
          <AlertCircle aria-hidden className="mt-0.5 size-4 shrink-0" />
          <div className="flex flex-col gap-2">
            <p className="font-semibold">Could not load the pricing tiers.</p>
            <p className="text-xs text-destructive/90">{loadError}</p>
          </div>
        </div>
      </GlassCard>
    );
  }

  const list = items ?? [];
  const isLoading = items === null;

  return (
    <div className="grid gap-6 md:grid-cols-3">
      {isLoading
        ? ['01', '02', '03'].map((ordinal) => <SkeletonCard key={ordinal} ordinal={ordinal} />)
        : list.map((tier) => <TierCard key={tier.id} tier={tier} />)}
      {!isLoading && list.length === 0 && (
        <p className="col-span-full text-small text-muted-foreground">
          No pricing tiers published yet.
        </p>
      )}
    </div>
  );
}
