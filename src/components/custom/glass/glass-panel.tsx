// @polsia:user-owned — section-level glass panel shell. Wraps a section's
// content in a .glass-panel surface, with an optional aurora backdrop for
// the higher-emphasis sections.

import { cva, type VariantProps } from 'class-variance-authority';
import type * as React from 'react';
import { cn } from '@/lib/utils';

const glassPanelVariants = cva('flex flex-col rounded-2xl text-card-foreground', {
  variants: {
    tone: {
      surface: 'glass-card',
      panel: 'glass-panel',
    },
    padding: {
      none: '',
      sm: 'p-4 sm:p-5',
      md: 'p-5 sm:p-6',
      lg: 'p-6 sm:p-8',
      xl: 'p-7 sm:p-10',
    },
    backdrop: {
      none: '',
      aurora: 'hero-aurora',
      soft: 'section-aurora',
    },
  },
  defaultVariants: {
    tone: 'panel',
    padding: 'lg',
    backdrop: 'none',
  },
});

export interface GlassPanelProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof glassPanelVariants> {}

export function GlassPanel({ className, tone, padding, backdrop, ...props }: GlassPanelProps) {
  return (
    <div className={cn(glassPanelVariants({ tone, padding, backdrop }), className)} {...props} />
  );
}
