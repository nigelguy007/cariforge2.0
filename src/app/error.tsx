// @polsia:user-owned — route error boundary (Client Component). Restyled
// to match the white-teal Liquid Glass system: aurora backdrop, centered
// glass card, brand-tinted headline + retry CTA.

'use client';

import { GlassCard, GlassChip } from '@/components/custom/glass';
import { Button } from '@/components/ui/button';

export default function RouteError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-6 py-16">
      <div aria-hidden className="pointer-events-none absolute inset-0 hero-aurora" />
      <GlassCard
        tone="surface"
        padding="lg"
        backdrop="soft"
        className="relative z-10 flex w-full max-w-xl flex-col items-center gap-4 text-center"
      >
        <GlassChip tone="brand" size="sm" className="self-center">
          Something interrupted the council
        </GlassChip>
        <h1 className="font-display text-h1 tracking-tight text-foreground">
          We hit an unexpected error.
        </h1>
        <p className="max-w-md text-body leading-relaxed text-muted-foreground">
          The page failed while loading — not because of anything you wrote. Reload the council step
          to continue, or step back to the home page and start a new brief.
        </p>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:gap-3">
          <Button type="button" onClick={() => reset()} size="lg">
            Try again
          </Button>
          <Button asChild type="button" variant="outline" size="lg">
            <a href="/">Back to home</a>
          </Button>
        </div>
      </GlassCard>
    </main>
  );
}
