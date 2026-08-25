// @polsia:user-owned — primary CTA composition with CVA for tone. Use for
// the largest, highest-intent call to action on a page (e.g. hero primary,
// row primary). Composes the Button primitive variants but visually
// pre-tunes them to the Liquid Glass brand treatment.

import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const glassCtaVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-[transform,box-shadow,background-color] duration-200 motion-safe:hover:-translate-y-0.5 motion-safe:hover:shadow-lg',
  {
    variants: {
      tone: {
        brand: 'glass-cta',
        outline: 'glass-outline-cta',
      },
      size: {
        sm: 'h-9 px-4 text-sm',
        md: 'h-11 px-5 text-sm',
        lg: 'h-12 px-7 text-base',
      },
    },
    defaultVariants: {
      tone: 'brand',
      size: 'md',
    },
  },
);

export interface GlassCtaProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof glassCtaVariants> {
  asChild?: boolean;
  href?: string;
}

/* GlassCta — a Button-shaped CTA pre-tuned to the brand treatment.
 * The Button primitive stays the import so behavior, focus rings, and
 * disabled states all flow from one place. */
export const GlassCta = React.forwardRef<HTMLButtonElement, GlassCtaProps>(
  ({ className, tone, size, asChild, children, ...props }, ref) => {
    if (tone === 'brand') {
      return (
        <Button
          asChild={asChild}
          size={size === 'lg' ? 'lg' : size === 'sm' ? 'sm' : 'default'}
          className={cn(
            glassCtaVariants({ tone, size }),
            'shadow-[0_1px_0_oklch(1_0_0/0.4)_inset,0_12px_30px_-10px_var(--glass-shadow)]',
            className,
          )}
          ref={ref}
          {...props}
        >
          {children}
        </Button>
      );
    }
    return (
      <Button
        asChild={asChild}
        variant="outline"
        size={size === 'lg' ? 'lg' : size === 'sm' ? 'sm' : 'default'}
        className={cn(glassCtaVariants({ tone, size }), className)}
        ref={ref}
        {...props}
      >
        {children}
      </Button>
    );
  },
);
GlassCta.displayName = 'GlassCta';
