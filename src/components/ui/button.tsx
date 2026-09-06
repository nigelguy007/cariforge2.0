import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';

import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        // 2026-09-03 (signed-in-app cosmoq pass): "all the buttons" turned
        // out to mean these — the actual authenticated app (dashboard,
        // Forge Canvas, Missions, Approvals, Admin) uses this component
        // directly everywhere (25 files), never the marketing-only
        // GlassCta/.glass-cta wrapper, so a fix scoped to that would have
        // been invisible here. Each variant below carries an always-present
        // marker class (dark-liquid-btn / dark-liquid-outline / etc.) whose
        // actual styling lives ENTIRELY under `.dark` selectors in
        // custom-style.css — no unscoped rule exists for them at all, so
        // light mode's already-tuned look (near-black CTA, Apple-style) is
        // completely untouched; the marker is inert there. `destructive` is
        // deliberately excluded: its higher-contrast warning red is a
        // safety signal (delete/refuse/rollback actions), not a look to
        // soften into decoration.
        default: 'bg-primary text-primary-foreground shadow hover:bg-primary/90 dark-liquid-btn',
        destructive: 'bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90',
        outline:
          'border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground dark-liquid-outline',
        secondary:
          'bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80 dark-liquid-outline',
        ghost: 'hover:bg-accent hover:text-accent-foreground dark-liquid-ghost',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-9 px-4 py-2',
        sm: 'h-8 rounded-md px-3 text-xs',
        lg: 'h-10 rounded-md px-8',
        icon: 'h-9 w-9',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  },
);
Button.displayName = 'Button';

export { Button, buttonVariants };
