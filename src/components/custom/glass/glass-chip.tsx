// @polsia:user-owned — translucent glass chip (pill, tag, badge) used for
// stance labels, sector tags, eyebrows, rating chips. Composes the
// .glass-chip utility from custom-style.css.

import { cva, type VariantProps } from 'class-variance-authority';
import type * as React from 'react';
import { cn } from '@/lib/utils';

const glassChipVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] glass-chip',
  {
    variants: {
      tone: {
        neutral: 'text-muted-foreground',
        brand: 'text-brand-700',
        strong: 'bg-brand-700/90 text-primary-foreground border-brand-700/50',
        outline: 'border-brand-500/40 text-brand-700',
        muted: 'border-border text-muted-foreground',
        destructive: 'border-destructive/40 text-destructive',
      },
      size: {
        sm: 'text-[9px] px-2 py-0.5',
        md: 'text-[10px] px-2.5 py-0.5',
        lg: 'text-caption px-3 py-1',
      },
    },
    defaultVariants: {
      tone: 'brand',
      size: 'md',
    },
  },
);

export interface GlassChipProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof glassChipVariants> {}

export function GlassChip({ className, tone, size, ...props }: GlassChipProps) {
  return <span className={cn(glassChipVariants({ tone, size }), className)} {...props} />;
}
