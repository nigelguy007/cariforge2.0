// @polsia:user-owned — /testimonials client island. Loads approved quotes
// from /api/testimonials through apiFetch + the shared TestimonialList
// contract, then renders them grouped by sector tag. When the moderation
// queue is empty we render an honest paragraph (not a 500); when the fetch
// fails we render a typed error alert; while loading we render skeleton
// cards. Matches the pricing-tiers / faq-accordion / blog-index state machine.

'use client';

import { AlertCircle, Quote as QuoteIcon } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { GlassCard, GlassChip, GlassPanel, GlassSectionHeader } from '@/components/custom/glass';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { apiFetch } from '@/lib/api-client';
import {
  sectorLabel,
  TestimonialList,
  type TestimonialList as TestimonialListType,
  type TestimonialSector,
  TestimonialSectorValues,
} from '@/lib/contracts/testimonials';

type Item = TestimonialListType['items'][number];

const dateFormatter = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

function parseDate(iso: string): Date | null {
  const parsed = new Date(iso);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function isEmailLike(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function TestimonialCard({ item }: { item: Item }) {
  const parsed = parseDate(item.quoteDate);
  const formatted = parsed ? dateFormatter.format(parsed) : item.quoteDate;
  const headline =
    item.attributedRole && item.organisation
      ? `${item.attributedRole} · ${item.organisation}`
      : item.organisation || item.attributedRole;
  const contact = item.contact ?? null;

  return (
    <GlassCard tone="surface" padding="lg" interactive className="h-full">
      <GlassChip tone="brand" size="sm" className="self-start">
        {sectorLabel(item.sector)}
      </GlassChip>
      <p className="mt-3 flex items-start gap-3 font-display text-body italic leading-relaxed text-card-foreground">
        <QuoteIcon aria-hidden className="mt-1 size-5 shrink-0 text-brand-700/70" />
        <span>&ldquo;{item.quote}&rdquo;</span>
      </p>
      <p className="text-small text-muted-foreground">
        <span className="font-semibold text-foreground">{headline}</span>
      </p>
      <div className="mt-auto flex flex-col gap-3 pt-3">
        <p className="font-mono text-caption tracking-[0.06em] text-muted-foreground">
          Submitted {formatted}
        </p>
        {contact ? (
          <p className="text-small text-muted-foreground">
            {isEmailLike(contact) ? (
              <a
                href={`mailto:${contact}?subject=CARI%20Forge%20-%20referral`}
                className="link-brand"
              >
                Reach out: {contact}
              </a>
            ) : (
              <span>
                Reach out: <span className="font-semibold text-foreground">{contact}</span>
              </span>
            )}
          </p>
        ) : null}
      </div>
    </GlassCard>
  );
}

function SkeletonCard() {
  return (
    <GlassCard tone="surface" padding="lg" className="h-full">
      <div className="h-5 w-28 animate-pulse rounded bg-muted" />
      <div className="mt-3 h-4 w-full animate-pulse rounded bg-muted" />
      <div className="mt-2 h-4 w-11/12 animate-pulse rounded bg-muted" />
      <div className="mt-2 h-4 w-2/3 animate-pulse rounded bg-muted" />
      <div className="mt-auto pt-3">
        <div className="h-4 w-32 animate-pulse rounded bg-muted" />
      </div>
    </GlassCard>
  );
}

function SkeletonGrid() {
  return (
    <output aria-live="polite" className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {[0, 1, 2].map((slot) => (
        <SkeletonCard key={slot} />
      ))}
    </output>
  );
}

interface SectorGroup {
  sector: TestimonialSector;
  label: string;
  items: Item[];
}

function groupBySector(items: Item[]): SectorGroup[] {
  const order: ReadonlyArray<TestimonialSector> = TestimonialSectorValues;
  const buckets = new Map<TestimonialSector, Item[]>();
  for (const sector of order) buckets.set(sector, []);
  for (const item of items) {
    const bucket = buckets.get(item.sector);
    if (bucket) bucket.push(item);
  }
  return order
    .map((sector) => ({
      sector,
      label: sectorLabel(sector),
      items: buckets.get(sector) ?? [],
    }))
    .filter((group) => group.items.length > 0);
}

export function TestimonialsList() {
  const [items, setItems] = useState<Item[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    apiFetch('/api/testimonials', { schema: TestimonialList })
      .then((data) => {
        if (active) setItems(data.items);
      })
      .catch(() => {
        if (active) setLoadError('Could not load the testimonials.');
      });
    return () => {
      active = false;
    };
  }, []);

  const groups = useMemo(() => (items ? groupBySector(items) : []), [items]);
  const totalApproved = items?.length ?? 0;

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
            <p className="font-semibold">Could not load the testimonials.</p>
            <p className="text-xs text-destructive/90">{loadError}</p>
          </div>
        </div>
      </GlassCard>
    );
  }

  const list = items ?? [];
  const isLoading = items === null;

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <SkeletonGrid />
      </div>
    );
  }

  if (list.length === 0) {
    return (
      <GlassPanel tone="surface" padding="lg" aria-label="Testimonials">
        <GlassChip tone="brand">No approved quotes yet</GlassChip>
        <p className="mt-3 max-w-2xl text-body leading-relaxed text-card-foreground">
          No testimonials have been approved yet. Quotes are reviewed by a human moderator before
          they appear here, and the moderation queue is empty right now. If you have a project
          narrative you would like to share, leave a brief on{' '}
          <Link href="/#how-it-works" className="link-brand">
            the front door
          </Link>{' '}
          or read{' '}
          <Link href="/pricing" className="link-brand">
            /pricing
          </Link>{' '}
          for what an engagement looks like.
        </p>
        <Separator className="my-1 max-w-[160px]" />
        <Button asChild variant="outline" size="sm" className="rounded-full">
          <Link href="/pricing">See the engagement tiers</Link>
        </Button>
      </GlassPanel>
    );
  }

  return (
    <div className="flex flex-col gap-10">
      <p className="text-small text-muted-foreground">
        {totalApproved} approved {totalApproved === 1 ? 'testimonial' : 'testimonials'} across{' '}
        {groups.length} {groups.length === 1 ? 'sector' : 'sectors'}.
      </p>
      {groups.map((group) => (
        <section
          key={group.sector}
          aria-labelledby={`testimonials-sector-${group.sector}`}
          className="flex flex-col gap-5"
        >
          <GlassSectionHeader
            eyebrow="Sector"
            title={group.label}
            lede={`${group.items.length} approved ${group.items.length === 1 ? 'quote' : 'quotes'} from regulated buyers in this sector.`}
            as="h2"
          />
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {group.items.map((item) => (
              <TestimonialCard key={item.id} item={item} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
