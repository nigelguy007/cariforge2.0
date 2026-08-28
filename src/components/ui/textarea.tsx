import * as React from 'react';

import { cn } from '@/lib/utils';

const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<'textarea'>>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          // Real, user-reported bug: no explicit text color here meant the
          // typed value fell back to plain CSS inheritance from `color`,
          // NOT `var(--foreground)` — so it never picked up the local
          // --foreground rescue that .glass-panel/.glass-card already do
          // for everything else (see custom-style.css's own comment on
          // that fix, "caught on /pricing"). Same root cause, different
          // element: a textarea inside a themed glass panel could inherit
          // a near-white body text color while sitting on that panel's
          // fixed pale background — invisible typed text.
          'flex min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-base text-foreground shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Textarea.displayName = 'Textarea';

export { Textarea };
