// @polsia:user-owned — hero composition (eyebrow + headline + lede +
// CTAs + form/panel) used by the home page. Grid is two columns at lg and
// stacks on smaller breakpoints; the form shell uses a glass card so the
// "leave a brief" surface reads as the highest-emphasis element.

import type * as React from 'react';
import { GlassCard } from '@/components/custom/glass/glass-card';
import { GlassChip } from '@/components/custom/glass/glass-chip';
import { cn } from '@/lib/utils';

interface GlassHeroProps {
  eyebrow: React.ReactNode;
  title: React.ReactNode;
  accent?: React.ReactNode;
  lede?: React.ReactNode;
  ctas?: React.ReactNode;
  meta?: React.ReactNode;
  sideEyebrow?: React.ReactNode;
  sideTitle?: React.ReactNode;
  sideLede?: React.ReactNode;
  side?: React.ReactNode;
  id?: string;
  className?: string;
}

/* GlassHero — hero composition for the home/landing page. The left column
 * is editorial copy + CTAs; the right column is a glass card holding a
 * form/panel. Backdrop is the .hero-aurora radial-gradient pair defined
 * in custom-style.css — placed behind the section via the wrapper. */
export function GlassHero({
  eyebrow,
  title,
  accent,
  lede,
  ctas,
  meta,
  sideEyebrow,
  sideTitle,
  sideLede,
  side,
  id,
  className,
}: GlassHeroProps) {
  return (
    <section
      className={cn(
        'section-lg relative overflow-hidden hero-aurora border-b border-white/10',
        className,
      )}
      id={id}
    >
      <div className="container-page grid items-start gap-12 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="flex flex-col gap-6">
          {eyebrow ? (
            <GlassChip tone="brand" size="lg" className="self-start">
              {eyebrow}
            </GlassChip>
          ) : null}
          <h1 className="text-h1 font-display tracking-tight text-foreground">
            {title}
            {accent ? (
              <>
                <br />
                <span className="text-brand-600">{accent}</span>
              </>
            ) : null}
          </h1>
          {lede ? <p className="max-w-xl text-body-lg text-foreground/85">{lede}</p> : null}
          {ctas ? <div className="flex flex-wrap items-center gap-3">{ctas}</div> : null}
          {meta ? meta : null}
        </div>

        {side ? (
          <GlassCard
            tone="highlight"
            padding="lg"
            id={id ? `${id}-form` : undefined}
            aria-label={typeof sideTitle === 'string' ? sideTitle : undefined}
            className="self-start"
          >
            {(sideEyebrow || sideTitle || sideLede) && (
              <header className="mb-4 flex flex-col gap-2">
                {sideEyebrow ? <GlassChip tone="brand">{sideEyebrow}</GlassChip> : null}
                {sideTitle ? (
                  <h2 className="font-display text-h3 tracking-tight text-foreground">
                    {sideTitle}
                  </h2>
                ) : null}
                {sideLede ? <p className="text-small text-card-foreground/80">{sideLede}</p> : null}
              </header>
            )}
            {side}
          </GlassCard>
        ) : null}
      </div>
    </section>
  );
}
