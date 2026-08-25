// @polsia:user-owned — translucent Liquid Glass card surface. Composes the
// .glass-card utility from custom-style.css with the existing shadcn
// primitives in src/components/ui so the rest of the app keeps one
// component vocabulary. Uses cva for tone/padding so callers reach for a
// prop instead of hand-tuning classes.

import { cva, type VariantProps } from 'class-variance-authority';
import type * as React from 'react';
import { cn } from '@/lib/utils';

const glassCardVariants = cva('flex flex-col glass-card rounded-2xl text-card-foreground', {
  variants: {
    tone: {
      surface: 'glass-card',
      panel: 'glass-panel',
      // highlight = the LIGHTER outcome/value surface (used by the hero form
      // shell, sample-brief cards, pricing CTA shells). Reads as the
      // destination panel — clearly lighter than the dark implementation-gap
      // page background.
      highlight: 'glass-highlight border-brand-300/60 text-card-foreground',
    },
    padding: {
      none: '',
      sm: 'p-4 sm:p-5',
      md: 'p-5 sm:p-6',
      lg: 'p-6 sm:p-8',
    },
    interactive: {
      true: 'lift-soft cursor-default',
      false: '',
    },
    backdrop: {
      none: '',
      aurora: 'hero-aurora',
      soft: 'section-aurora',
    },
  },
  defaultVariants: {
    tone: 'surface',
    padding: 'md',
    interactive: false,
    backdrop: 'none',
  },
});

export interface GlassCardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof glassCardVariants> {}

export function GlassCard({
  className,
  tone,
  padding,
  interactive,
  backdrop,
  ...props
}: GlassCardProps) {
  return (
    <div
      className={cn(glassCardVariants({ tone, padding, interactive, backdrop }), className)}
      {...props}
    />
  );
}

/* Glass header / body / footer — thin shims so a card's body uses our type
   scale and not ad-hoc text utilities. Optional, used by callers that want
   one consistent layout. */
export function GlassCardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('mb-3 flex flex-col gap-2', className)} {...props} />;
}

export function GlassCardEyebrow({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <p className={cn('text-eyebrow text-brand-700', className)} {...props} />;
}

export function GlassCardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn('font-display text-h3 tracking-tight text-foreground', className)}
      {...props}
    />
  );
}

export function GlassCardBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('flex flex-1 flex-col gap-3 text-card-foreground/85', className)}
      {...props}
    />
  );
}
