// @polsia:user-owned — /faq client island. Loads the five regulated-buyer
// objections from /api/faq through apiFetch + the shared FaqList contract,
// then renders a Radix Accordion. Loading / empty / error guards match the
// example page's pattern. Visual treatment mirrors the landing intake card.

'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { GlassCard } from '@/components/custom/glass';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { apiFetch } from '@/lib/api-client';
import { FaqList, type FaqList as FaqListType } from '@/lib/contracts/faq';

type Item = FaqListType['items'][number];

function FaqRow({ item }: { item: Item }) {
  return (
    <AccordionItem value={item.id} className="border-b border-brand-700/20 last:border-b-0">
      <AccordionTrigger className="gap-4 py-5 text-left text-h3 font-display tracking-tight text-foreground hover:no-underline">
        <span className="flex items-baseline gap-4">
          <span className="font-display text-caption font-semibold tracking-[0.1em] text-brand-700">
            № {String(item.ordinal).padStart(2, '0')}
          </span>
          <span className="flex-1">{item.question}</span>
        </span>
      </AccordionTrigger>
      <AccordionContent className="pb-5">
        <p className="max-w-3xl text-body leading-relaxed text-card-foreground/85">{item.answer}</p>
        {item.id === 'scaffold-vs-product' && (
          <p className="mt-3 text-small text-muted-foreground">
            <Link href="/why-this-is-a-scaffold" className="link-brand">
              Learn more about what's included and what isn't →
            </Link>
          </p>
        )}
      </AccordionContent>
    </AccordionItem>
  );
}

function SkeletonRow({ ordinal }: { ordinal: string }) {
  return (
    <div className="border-b border-brand-700/20 py-5 last:border-b-0">
      <div className="flex items-baseline gap-4">
        <span className="font-display text-caption font-semibold tracking-[0.1em] text-brand-700">
          № {ordinal}
        </span>
        <span className="h-5 w-2/3 animate-pulse rounded bg-muted" />
      </div>
    </div>
  );
}

export function FaqAccordion() {
  const [items, setItems] = useState<Item[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    apiFetch('/api/faq', { schema: FaqList })
      .then((data) => {
        if (active) setItems(data.items);
      })
      .catch(() => {
        if (active) setLoadError('Could not load the FAQ.');
      });
    return () => {
      active = false;
    };
  }, []);

  if (loadError) {
    return (
      <GlassCard tone="surface" padding="md">
        <p className="text-small text-destructive">{loadError}</p>
      </GlassCard>
    );
  }

  const list = items ?? [];
  const isLoading = items === null;

  return (
    <GlassCard tone="surface" padding="sm" className="sm:p-4">
      <Accordion type="single" collapsible className="w-full">
        {isLoading
          ? ['01', '02', '03', '04', '05'].map((ordinal) => (
              <SkeletonRow key={ordinal} ordinal={ordinal} />
            ))
          : list.map((item) => <FaqRow key={item.id} item={item} />)}
      </Accordion>
      {!isLoading && list.length === 0 && (
        <p className="px-2 py-4 text-small text-muted-foreground">No questions published yet.</p>
      )}
    </GlassCard>
  );
}
